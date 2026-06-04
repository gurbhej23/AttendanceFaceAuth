import base64
import os
import tempfile
import time
import traceback
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from django.conf import settings
from PIL import Image, ImageOps

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
os.environ.setdefault(
    "DEEPFACE_HOME",
    os.getenv("DEEPFACE_HOME")
    or str(getattr(settings, "DEEPFACE_HOME", Path(tempfile.gettempdir()) / "deepface")),
)

MEDIA_DIR = settings.MEDIA_ROOT / "faces"
MAX_FACE_IMAGE_SIDE = int(os.getenv("MAX_FACE_IMAGE_SIDE", "960"))
Path(os.environ["DEEPFACE_HOME"]).mkdir(parents=True, exist_ok=True)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

_deepface = None
_facenet_loaded = False
_facenet_load_error = None


def get_deepface():
    global _deepface
    if _deepface is None:
        from deepface import DeepFace

        _deepface = DeepFace
    return _deepface


def ensure_facenet_loaded():
    global _facenet_loaded, _facenet_load_error
    if _facenet_loaded:
        return
    if _facenet_load_error is not None:
        raise RuntimeError(_facenet_load_error) from _facenet_load_error

    try:
        print(f"Loading FaceNet model... DEEPFACE_HOME={os.environ['DEEPFACE_HOME']}")
        get_deepface().build_model("Facenet")
        _facenet_loaded = True
        print("FaceNet model loaded")
    except Exception as exc:
        _facenet_load_error = exc
        print(f"FaceNet model load failed: {type(exc).__name__}: {exc}")
        traceback.print_exc()
        raise RuntimeError(
            "Face model could not load on the server. Check Render logs for model download/cache errors."
        ) from exc


def facenet_is_ready() -> bool:
    return _facenet_loaded


def resize_for_face(image_bgr: np.ndarray) -> np.ndarray:
    height, width = image_bgr.shape[:2]
    max_side = max(height, width)
    if max_side <= MAX_FACE_IMAGE_SIDE:
        return image_bgr
    scale = MAX_FACE_IMAGE_SIDE / max_side
    new_size = (int(width * scale), int(height * scale))
    return cv2.resize(image_bgr, new_size, interpolation=cv2.INTER_AREA)


def get_detector_attempts():
    configured = os.getenv("FACE_DETECTOR_BACKENDS", "").strip()
    if configured:
        backends = [item.strip() for item in configured.split(",") if item.strip()]
        return [
            {
                "detector_backend": backend,
                "enforce_detection": backend != "skip",
            }
            for backend in backends
        ]

    # Render and other small hosts: avoid heavy MTCNN/RetinaFace chains that OOM or time out.
    if os.getenv("RENDER") or os.getenv("FACE_LIGHTWEIGHT_DETECTORS", "").lower() in (
        "1",
        "true",
        "yes",
    ):
        return [
            {"detector_backend": "opencv", "enforce_detection": True},
            {"detector_backend": "skip", "enforce_detection": False},
        ]

    return [
        {"detector_backend": "opencv", "enforce_detection": True},
        {"detector_backend": "mtcnn", "enforce_detection": True},
        {"detector_backend": "retinaface", "enforce_detection": True},
        {"detector_backend": "skip", "enforce_detection": False},
    ]


def extract_embedding_with_fallbacks(image_bgr: np.ndarray):
    deepface = get_deepface()
    ensure_facenet_loaded()
    image_bgr = resize_for_face(image_bgr)

    attempts = get_detector_attempts()

    last_error = None
    for attempt in attempts:
        try:
            print(
                "   Trying detector:",
                attempt["detector_backend"],
                "| enforce_detection:",
                attempt["enforce_detection"],
            )
            result = deepface.represent(
                img_path=image_bgr,
                model_name="Facenet",
                detector_backend=attempt["detector_backend"],
                enforce_detection=attempt["enforce_detection"],
                align=True,
            )
            if result and result[0].get("embedding"):
                print(f"   Detector worked: {attempt['detector_backend']}")
                return result[0]["embedding"], None
        except Exception as exc:
            last_error = exc
            print(f"   Detector failed: {attempt['detector_backend']} -> {exc}")

    return None, last_error


def extract_and_save_embedding(base64_image: str, employee_id: str) -> tuple:
    """
    Extract a FaceNet embedding from a base64 image and save the image to disk.
    Returns: (embedding_list, error_message, image_path)
    """
    try:
        print(f"\n{'=' * 60}")
        print(f"Processing image for {employee_id}")
        print(f"{'=' * 60}")

        if not base64_image:
            print("No image provided")
            return None, "No image provided", None

        if "," in base64_image:
            base64_image = base64_image.split(",", 1)[1]

        try:
            image_data = base64.b64decode(base64_image)
            print(f"Base64 decoded: {len(image_data)} bytes")
        except Exception as exc:
            print(f"Base64 decode failed: {exc}")
            return None, f"Invalid image format: {exc}", None

        try:
            image = ImageOps.exif_transpose(Image.open(BytesIO(image_data))).convert(
                "RGB"
            )
            image_np = np.array(image)
            print(f"Image loaded: {image_np.shape}")
        except Exception as exc:
            print(f"Image load failed: {exc}")
            return None, f"Invalid image file: {exc}", None

        if image_np.shape[0] < 200 or image_np.shape[1] < 200:
            print(f"Image too small: {image_np.shape}")
            return None, "Image too small - face must be larger in frame", None

        image_bgr = resize_for_face(cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR))
        print("Color converted to BGR")

        image_path = None
        try:
            filename = f"{employee_id}_{int(time.time())}.jpg"
            image_path = str(MEDIA_DIR / filename)
            success = cv2.imwrite(image_path, image_bgr)
            if success:
                print(f"Image saved: {image_path}")
            else:
                print("Image save returned False, continuing anyway")
        except Exception as exc:
            print(f"Image save failed: {exc}")

        print("Extracting face embedding...")
        try:
            print(f"   Input shape: {image_bgr.shape}")
            embedding, detector_error = extract_embedding_with_fallbacks(image_bgr)

            if not embedding:
                print("DeepFace returned empty result")
                detail = f": {detector_error}" if detector_error else ""
                return (
                    None,
                    "Could not detect a clear face. Move closer, face the camera, and use better lighting"
                    + detail,
                    image_path,
                )

            print(f"Embedding extracted: {len(embedding)} dimensions")
            print(f"   First 5 values: {embedding[:5]}")

            print(f"\n{'=' * 60}")
            print("SUCCESS")
            print(f"{'=' * 60}\n")

            return embedding, None, image_path

        except Exception as exc:
            print(f"DeepFace error: {type(exc).__name__}: {exc}")
            traceback.print_exc()
            return None, f"Face extraction failed: {exc}", image_path

    except Exception as exc:
        print(f"\n{'=' * 60}")
        print(f"CRITICAL ERROR: {type(exc).__name__}")
        print(str(exc))
        traceback.print_exc()
        print(f"{'=' * 60}\n")
        return None, f"Image processing failed: {exc}", None


def verify_face_match(
    uploaded_embedding: list, 
    stored_embedding: list, 
    threshold: float = 0.45 
    ) -> bool: 
    try:
        print(f"\n{'=' * 60}")
        print("Comparing face embeddings")
        print(f"{'=' * 60}")

        if not uploaded_embedding or not stored_embedding:
            print("Missing embeddings")
            return False

        current = np.array(uploaded_embedding, dtype=np.float32)
        stored = np.array(stored_embedding, dtype=np.float32)

        print(f"Current embedding shape: {current.shape}")
        print(f"Stored embedding shape: {stored.shape}")

        current_norm = np.linalg.norm(current)
        stored_norm = np.linalg.norm(stored)

        if current_norm == 0 or stored_norm == 0:
            print("Invalid embedding (zero norm)")
            return False

        current = current / current_norm
        stored = stored / stored_norm

        distance = np.linalg.norm(current - stored)

        print(f"Face distance: {distance:.4f}")
        print(f"   Threshold: {threshold}")
        print(f"   Match: {'YES' if distance < threshold else 'NO'}")
        print(f"{'=' * 60}\n")

        return distance < threshold

    except Exception as exc:
        print(f"Error in verify_face_match: {exc}")
        traceback.print_exc()
        return False
