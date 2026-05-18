import cv2

try:
    import mediapipe as mp
except ImportError:
    mp = None

face_mesh = None
if mp is not None:
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(
        static_image_mode=True, max_num_faces=1, refine_landmarks=True
    )


def detect_face_landmarks(image_path):
    if face_mesh is None:
        return False

    image = cv2.imread(image_path)
    if image is None:
        return False

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    results = face_mesh.process(rgb)

    return results.multi_face_landmarks is not None
