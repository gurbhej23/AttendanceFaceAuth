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


import sys

# Ensure stdout handles UTF-8 on Windows without UnicodeEncodeError
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def get_detector_attempts():
    configured = os.getenv("FACE_DETECTOR_BACKENDS", "").strip()
    if configured:
        backends = [item.strip() for item in configured.split(",") if item.strip() and item.strip() != "skip"]
        return [
            {
                "detector_backend": backend,
                "enforce_detection": True,
            }
            for backend in backends
        ]

    # Prioritize deep-learning neural detectors (retinaface, mtcnn) first to prevent false detections on non-face objects.
    return [
        {"detector_backend": "retinaface", "enforce_detection": True},
        {"detector_backend": "mtcnn", "enforce_detection": True},
        {"detector_backend": "opencv", "enforce_detection": True},
    ]


def extract_embedding_with_fallbacks(
    image_bgr: np.ndarray,
    require_single_face: bool = False,
):
    """
    Extract an embedding from an image using a cascade of face detectors.

    If require_single_face is True and multiple faces are detected, the function
    returns (None, "Multiple faces detected").
    """
    deepface = get_deepface()
    ensure_facenet_loaded()
    image_bgr = resize_for_face(image_bgr)

    attempts = get_detector_attempts()

    if require_single_face:
        attempts = [
            attempt 
            for attempt in attempts
            if attempt["detector_backend"] not in ("skip", "opencv")
        ]
    last_error = None
    for attempt in attempts:
        try:
            detector = attempt["detector_backend"]
            print(
                "   Trying detector:",
                detector,
                "| enforce_detection:",
                attempt["enforce_detection"],
            )
            result = deepface.represent(
                img_path=image_bgr,
                model_name="Facenet",
                detector_backend=detector,
                enforce_detection=attempt["enforce_detection"],
                align=True,
            )
            if result:
                valid_candidates = []
                for item in result:
                    emb = item.get("embedding")
                    if not emb:
                        continue

                    area_info = item.get("facial_area", {})
                    w = area_info.get("w", 0)
                    h = area_info.get("h", 0)
                    area = w * h

                    if detector == "opencv" and (w < 60 or h < 60):
                        print(f"   Discarding tiny OpenCV detection ({w}x{h} px)")
                        continue

                    valid_candidates.append((area, emb))

                if require_single_face:
                    if len(valid_candidates) == 0:
                        print("   Detected faces: 0 -> REJECTED")
                        return (
                            None,
                            "No face detected. Please position your face clearly in the camera.",
                        )
                    if len(valid_candidates) > 1:
                        print(f"   Detected faces: {len(valid_candidates)} -> REJECTED")
                        return (
                            None,
                            "Multiple faces detected. Only the employee marking attendance should be visible.",
                        )

                if valid_candidates:
                    primary_embedding = valid_candidates[0][1]
                    print(
                        f"   Detector worked: {detector} (Detected faces: {len(valid_candidates)})"
                    )
                    return primary_embedding, None

        except Exception as exc:
            last_error = exc
            print(f"   Detector failed: {attempt['detector_backend']} -> {exc}")

    return None, last_error


def extract_and_save_embedding(
    base64_image: str, 
    employee_id: str,
    require_single_face: bool = False,    
) -> tuple: 
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
            embedding, detector_error = extract_embedding_with_fallbacks(
                image_bgr,
                require_single_face=require_single_face,
            )

            if not embedding:
                print("Face extraction returned empty result or error:", detector_error)
                err_str = str(detector_error) if detector_error else ""
                if "Multiple faces detected" in err_str:
                    err_msg = "Multiple faces detected. Only the employee marking attendance should be visible."
                else:
                    err_msg = "No face detected. Please position your face clearly in the camera."
                return (
                    None,
                    err_msg,
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
    threshold: float = 0.35 
    ) -> bool: 
    try:
        print(f"\n{'=' * 60}")
        print("Comparing face embeddings (Cosine Distance)")
        print(f"{'=' * 60}")

        if not uploaded_embedding or not stored_embedding:
            print("Missing embeddings")
            return False

        current = np.array(uploaded_embedding, dtype=np.float32)
        stored = np.array(stored_embedding, dtype=np.float32)

        print(f"Current embedding shape: {current.shape}")
        print(f"Stored embedding shape: {stored.shape}")

        if current.shape != stored.shape or current.size == 0 or stored.size == 0:
            print(f"Shape mismatch: {current.shape} vs {stored.shape}")
            return False

        current_norm = np.linalg.norm(current)
        stored_norm = np.linalg.norm(stored)

        if current_norm == 0 or stored_norm == 0:
            print("Invalid embedding (zero norm)")
            return False

        current = current / current_norm
        stored = stored / stored_norm

        # Cosine distance = 1 - dot_product(unit_vectors)
        cosine_sim = float(np.dot(current, stored))
        cosine_distance = max(0.0, 1.0 - cosine_sim)

        is_match = cosine_distance < threshold
        print(
            f"Cosine Distance: {cosine_distance:.4f} | Cosine Sim: {cosine_sim:.4f} | Threshold: {threshold} | Match: {'YES' if is_match else 'NO'}"
        )
        print(f"{'=' * 60}\n")

        return is_match

    except Exception as exc:
        print(f"Error in verify_face_match: {exc}")
        traceback.print_exc()
        return False
