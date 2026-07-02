from django.conf import settings


def normalize_media_path(path: str) -> str:
    """Turn stored profile paths into a browser-safe /media/... URL path."""
    if not path:
        return ""
    normalized = path.replace("\\", "/")
    if normalized.startswith(("http://", "https://")):
        return normalized
    media_marker = "/media/"
    idx = normalized.lower().find(media_marker)
    if idx >= 0:
        return normalized[idx:]
    if normalized.startswith("/media/"):
        return normalized
    if normalized.startswith("media/"):
        return f"/{normalized}"
    return f"{settings.MEDIA_URL}{normalized.lstrip('/')}"


def media_url(path: str) -> str:
    """Return a browser-loadable /media/... path."""
    if not path:
        return ""
    normalized = normalize_media_path(path)
    if not normalized:
        return ""
    if normalized.startswith(("http://", "https://")):
        return normalized
    if normalized.startswith("/media/"):
        rel = normalized[len("/media/") :]
        if (settings.MEDIA_ROOT / rel).exists():
            return normalized
        # Return the path even when the file is missing so clients can still try.
        return normalized
    rel = normalized.lstrip("/")
    if (settings.MEDIA_ROOT / rel).exists():
        return normalized
    return normalized


def _media_file_exists(normalized: str) -> bool:
    if not normalized or normalized.startswith(("http://", "https://")):
        return bool(normalized)
    rel = normalized[len("/media/") :] if normalized.startswith("/media/") else normalized.lstrip("/")
    return (settings.MEDIA_ROOT / rel).exists()


def resolve_employee_profile_url(employee) -> str:
    """Resolve a loadable profile image path, including face-enrollment fallbacks."""
    if not employee:
        return ""

    for raw in (employee.profile_img, employee.photo_path):
        if not raw or not str(raw).strip():
            continue
        normalized = normalize_media_path(str(raw))
        if normalized and _media_file_exists(normalized):
            return normalized

    employee_id = getattr(employee, "employee_id", "") or ""
    if employee_id:
        faces_dir = settings.MEDIA_ROOT / "faces"
        if faces_dir.is_dir():
            prefix = f"{employee_id}_"
            matches = sorted(
                (
                    p
                    for p in faces_dir.iterdir()
                    if p.is_file() and p.name.startswith(prefix)
                ),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
            if matches:
                return f"/media/faces/{matches[0].name}"

    return media_url(employee.profile_img or employee.photo_path or "")
