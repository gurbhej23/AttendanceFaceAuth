from django.conf import settings


def normalize_media_path(path: str) -> str:
    """Turn stored profile paths into a browser-safe /media/... URL path."""
    if not path:
        return ""
    normalized = path.replace("\\", "/").strip()
    if not normalized:
        return ""
    if normalized.startswith(("http://", "https://")):
        from urllib.parse import urlparse

        normalized = urlparse(normalized).path or ""
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
    """Return a browser-loadable /media/... path (never a localhost absolute URL)."""
    if not path:
        return ""
    normalized = normalize_media_path(path)
    if not normalized:
        return ""
    if normalized.startswith(("http://", "https://")):
        return normalized
    if not normalized.startswith("/media/"):
        normalized = f"/media/{normalized.lstrip('/')}"
    return normalized
