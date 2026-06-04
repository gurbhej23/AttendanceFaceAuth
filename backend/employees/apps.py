import os

from django.apps import AppConfig


class EmployeesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "employees"

    def ready(self):
        import sys

        is_dev_server = "runserver" in sys.argv
        if is_dev_server and os.environ.get("RUN_MAIN") != "true":
            return
        if os.environ.get("PRELOAD_FACE_MODEL", "true").lower() not in (
            "1",
            "true",
            "yes",
        ):
            return
        try:
            from employees.face_utils import ensure_facenet_loaded

            ensure_facenet_loaded()
        except Exception as exc:
            print(f"[Face] Model preload skipped or failed: {exc}")
