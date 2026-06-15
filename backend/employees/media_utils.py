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
