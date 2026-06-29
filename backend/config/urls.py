from django.contrib import admin
from django.http import JsonResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


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
    path("admin/", admin.site.urls),
    path("api/employees/", include("employees.urls")),
    path("api/attendance/", include("attendance.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
