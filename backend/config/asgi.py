import os

from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_app = get_asgi_application()

from django.conf import settings
from config.routing import websocket_urlpatterns

websocket_stack = AuthMiddlewareStack(URLRouter(websocket_urlpatterns))
allowed_origins = getattr(settings, "CHANNEL_ALLOWED_ORIGINS", None)
if allowed_origins:
    websocket_stack = OriginValidator(websocket_stack, allowed_origins)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": websocket_stack,
    }
)
