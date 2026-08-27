from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from healthcheck import healthcheck


def api_root(_request):
    return JsonResponse(
        {
            "message": "Attendance backend is running",
            "endpoints": {
                "employees": "/api/employees/",
                "attendance": "/api/attendance/",
                "admin": "/admin/",
            },
        }
    )


urlpatterns = [
    path("", api_root, name="api-root"),
    path("health/", healthcheck, name="healthcheck"),
    path("admin/", admin.site.urls),
    path("api/employees/", include("employees.urls")),
    path("api/attendance/", include("attendance.urls")),
]

from django.urls import re_path
from django.views.static import serve

if getattr(settings, "SERVE_MEDIA", False) or settings.DEBUG:
    urlpatterns += [
        re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
    ]

