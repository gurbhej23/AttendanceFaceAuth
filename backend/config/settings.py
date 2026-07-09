import os
from pathlib import Path

import mongoengine as me
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, ".env"))

_IS_RENDER = os.getenv("RENDER", "").lower() in ("1", "true", "yes")
_ENVIRONMENT = os.getenv("DJANGO_ENV", "development").strip().lower()
_DEBUG_FLAG = os.getenv("DEBUG", "").strip().lower()

me.connect(
    db="attendance_system",
    host=os.getenv("MONGO_URI"),
    tz_aware=True,
    serverSelectionTimeoutMS=int(
        os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000")
    ),
    connectTimeoutMS=int(os.getenv("MONGO_CONNECT_TIMEOUT_MS", "5000")),
    socketTimeoutMS=int(os.getenv("MONGO_SOCKET_TIMEOUT_MS", "10000")),
)

SECRET_KEY = os.getenv("SECRET_KEY", "django-insecure-9hkbfp9ssh4%(k5ae=s88se+^q81_-=e#vee!c1#uk(qh#gfhy")
if _DEBUG_FLAG in ("1", "true", "yes", "on"):
    DEBUG = True
elif _DEBUG_FLAG in ("0", "false", "no", "off"):
    DEBUG = False
else:
    DEBUG = _ENVIRONMENT != "production"

ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
    ".ngrok-free.dev",
    ".ngrok-free.app",
    ".onrender.com",
    ".vercel.app",
    "attendanceauth.vercel.app",
    "attendance-face-auth.vercel.app",
]

_render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if _render_host:
    ALLOWED_HOSTS.append(_render_host)

_extra_hosts = os.getenv("ALLOWED_HOSTS_EXTRA", "").strip()
if _extra_hosts:
    ALLOWED_HOSTS.extend(h.strip() for h in _extra_hosts.split(",") if h.strip())

# Explicit hostname used by the live Render service
ALLOWED_HOSTS.append("attendancefaceauth.onrender.com")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "channels",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "employees.apps.EmployeesConfig",
    "attendance",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

_redis_url = os.getenv("REDIS_URL", "").strip()
if _redis_url:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [_redis_url]},
        }
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

CORS_ALLOWED_ORIGINS = [
    "https://attendanceauth.vercel.app",  # <--- Added your actual live Vercel domain!
    "https://attendance-face-auth.vercel.app",
    "https://attendance-face-auth-7wxl1qus7-gurbhej-singhs-projects.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

_extra_cors = os.getenv("FRONTEND_ORIGINS", "").strip()
if _extra_cors:
    CORS_ALLOWED_ORIGINS.extend(
        o.strip().rstrip("/") for o in _extra_cors.split(",") if o.strip()
    )

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if origin.strip()
]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = _IS_RENDER or os.getenv("SECURE_SSL_REDIRECT", "false").lower() in ("1", "true", "yes")
SESSION_COOKIE_SECURE = _IS_RENDER or os.getenv("SESSION_COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
CSRF_COOKIE_SECURE = _IS_RENDER or os.getenv("CSRF_COOKIE_SECURE", "false").lower() in ("1", "true", "yes")
SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000" if _IS_RENDER else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

CORS_ALLOW_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "ngrok-skip-browser-warning",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
]

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": [
        "employees.permissions.EmployeeAccessPermission",
    ],
}
 
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "") 
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "")
SENDGRID_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "Attendance System")

# Keep DEFAULT_FROM_EMAIL for any Django internals that need it
DEFAULT_FROM_EMAIL = SENDGRID_FROM_EMAIL

USE_I18N = True
USE_TZ = True

# Render reverse proxy (required for HTTPS + WebSocket behind load balancer)
USE_X_FORWARDED_HOST = True

# WebSocket Origin validation — set CHANNEL_ALLOWED_ORIGINS on Render if needed.
_ws_origins = os.getenv("CHANNEL_ALLOWED_ORIGINS", "").strip()
CHANNEL_ALLOWED_ORIGINS = [
    o.strip().rstrip("/")
    for o in _ws_origins.split(",")
    if o.strip()
]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {"class": "logging.StreamHandler"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}
_media_root = os.getenv("MEDIA_ROOT", "").strip()
MEDIA_ROOT = Path(_media_root) if _media_root else BASE_DIR / "media"
MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
SERVE_MEDIA = (
    DEBUG
    or _IS_RENDER
    or os.getenv("SERVE_MEDIA", "").lower() in ("1", "true", "yes")
)
DEEPFACE_HOME = Path(
    os.getenv("DEEPFACE_HOME", str(BASE_DIR / ".deepface"))
)
FACE_MATCH_THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "0.65"))
DATA_UPLOAD_MAX_MEMORY_SIZE = int(
    os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(15 * 1024 * 1024))
)

# Cloudinary configuration (Only active in production / Render)
if _IS_RENDER:
    INSTALLED_APPS.extend([
        "cloudinary_storage",
        "cloudinary",
    ])
    CLOUDINARY_STORAGE = {
        "CLOUD_NAME": os.getenv("CLOUDINARY_CLOUD_NAME", ""),
        "API_KEY": os.getenv("CLOUDINARY_API_KEY", ""),
        "API_SECRET": os.getenv("CLOUDINARY_API_SECRET", ""),
    }
    DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"


