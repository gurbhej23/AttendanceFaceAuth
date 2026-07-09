from pathlib import Path

from django.conf import settings


from django.core.files.storage import default_storage

def normalize_media_path(path: str) -> str:
    """Turn stored profile paths into a browser-safe /media/... URL path."""
    if not path:
        return ""
    normalized = path.replace("\\", "/")
    if normalized.startswith(("http://", "https://")):
        return normalized
    # Remove prefix if it exists to get the real storage path
    media_marker = "/media/"
    idx = normalized.lower().find(media_marker)
    if idx >= 0:
        return normalized[idx + len(media_marker):]
    if normalized.startswith("media/"):
        return normalized[len("media/"):]
    return normalized

def media_url(path: str) -> str:
    """Return a browser-loadable path using default_storage."""
    if not path:
        return ""
    normalized = normalize_media_path(path)
    if not normalized:
        return ""
    if normalized.startswith(("http://", "https://")):
        return normalized
    try:
        return default_storage.url(normalized)
    except Exception:
        return f"{settings.MEDIA_URL}{normalized}"


def resolve_employee_profile_url(employee) -> str:
    """Profile photo only (Profile page upload), not face-capture enrollment images."""
    if not employee:
        return ""
    return media_url(employee.profile_img or "")


def delete_chat_attachment_files(attachments) -> None:
    """Remove stored chat attachment files from disk."""
    if not attachments:
        return
    base = Path(settings.MEDIA_ROOT) / "chat_attachments"
    for item in attachments:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url", "") or "").replace("\\", "/")
        if "chat_attachments/" not in url:
            continue
        filename = url.split("chat_attachments/")[-1].split("?")[0].strip()
        if not filename or ".." in filename:
            continue
        path = base / filename
        try:
            if path.is_file():
                path.unlink()
        except OSError:
            pass


def clear_message_attachments(message) -> None:
    """Delete attachment files and clear them on a chat message document."""
    delete_chat_attachment_files(getattr(message, "attachments", []) or [])
    message.attachments = []
