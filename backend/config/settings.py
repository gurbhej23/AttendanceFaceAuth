from pathlib import Path
import mongoengine as me
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(os.path.join(BASE_DIR, ".env"))

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

SECRET_KEY = "django-insecure-9hkbfp9ssh4%(k5ae=s88se+^q81_-=e#vee!c1#uk(qh#gfhy"
DEBUG = True

ALLOWED_HOSTS = [
    ".ngrok-free.dev",
    ".ngrok-free.app",
    ".onrender.com",
    "127.0.0.1",
    "localhost",
    "*",
]

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
    "employees",
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
    "https://attendance-face-auth.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "https://override-jawless-boogieman.ngrok-free.dev",
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_METHODS = ["DELETE", "GET", "OPTIONS", "PATCH", "POST", "PUT"]
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
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
        "rest_framework.permissions.AllowAny",
    ],
}
 
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "") 
SENDGRID_FROM_EMAIL = os.getenv("SENDGRID_FROM_EMAIL", "")
SENDGRID_FROM_NAME = os.getenv("SENDGRID_FROM_NAME", "Attendance System")

# Keep DEFAULT_FROM_EMAIL for any Django internals that need it
DEFAULT_FROM_EMAIL = SENDGRID_FROM_EMAIL

USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
