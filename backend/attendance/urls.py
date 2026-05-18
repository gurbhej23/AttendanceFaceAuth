from . import views
from django.urls import path
from .views import (
    attendance_report,
    admin_attendance_sheet,
    check_in_face,
    check_out_face,
    mark_absent,
    mark_half_day,
    mark_present,
    resign_employee,
    verify_face,
)

urlpatterns = [
    path("verify-face/", views.verify_face, name="verify-face"),
    path("check-in/", views.check_in_face, name="check-in"),
    path("check-out/", views.check_out_face, name="check-out"),
    path("mark-report/", views.attendance_report, name="mark-report"),
    path("admin-sheet/", views.admin_attendance_sheet, name="admin-sheet"),
    path("mark-absent/", views.mark_absent, name="mark-absent"),
    path("mark-half-day/", views.mark_half_day, name="mark-half-day"),
    path("mark-present/", views.mark_present, name="mark-present"),
    path("mark-resign/", views.resign_employee, name="mark-resign"),
]
    
