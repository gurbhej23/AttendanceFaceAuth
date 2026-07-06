import logging
import os

from django.apps import AppConfig

logger = logging.getLogger(__name__)


def _should_preload_face_model() -> bool:
    import sys

    preload_env = os.environ.get("PRELOAD_FACE_MODEL", "").strip().lower()
    if preload_env in ("0", "false", "no"):
        return False
    if preload_env in ("1", "true", "yes"):
        return True

    # Render: bind HTTP/WebSocket port first; load FaceNet on first face request.
    if os.environ.get("RENDER"):
        return False
    if any("gunicorn" in arg or "daphne" in arg for arg in sys.argv):
        return False

    # Local `runserver` only (optional warm-up).
    return "runserver" in sys.argv


class EmployeesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "employees"

    def ready(self):
        import sys

        if "runserver" in sys.argv and os.environ.get("RUN_MAIN") != "true":
            return
        if not _should_preload_face_model():
            return
        try:
            from employees.face_utils import ensure_facenet_loaded

            ensure_facenet_loaded()
        except Exception as exc:
            logger.warning("Face model preload skipped or failed: %s", exc)
