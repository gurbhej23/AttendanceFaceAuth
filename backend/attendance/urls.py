# attendance/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Face
    path("verify-face/", views.verify_face, name="verify-face"),
    path("check-in/", views.check_in_face, name="check-in"),
    path("check-out/", views.check_out_face, name="check-out"),
    # Reports
    path("mark-report/", views.attendance_report, name="mark-report"),
    path("admin-sheet/", views.admin_attendance_sheet, name="admin-sheet"),
    path("export-csv/", views.export_attendance_csv, name="export-csv"),
    path("monthly-summary/", views.monthly_summary, name="monthly-summary"),
    path("admin-analytics/", views.admin_analytics, name="admin-analytics"),
    path("late-comers/", views.late_comers_report, name="late-comers"),
    # Mark attendance
    path("mark-present/", views.mark_present, name="mark-present"),
    path("mark-absent/", views.mark_absent, name="mark-absent"),
    path("mark-half-day/", views.mark_half_day, name="mark-half-day"),
    path("mark-resign/", views.resign_employee, name="mark-resign"),
    # Leave management
    path("request-leave/", views.request_leave, name="request-leave"),
    path("my-leave-requests/", views.my_leave_requests, name="my-leave-requests"),
    path(
        "admin-leave-requests/", views.admin_leave_requests, name="admin-leave-requests"
    ),
    path("approve-leave/", views.approve_leave, name="approve-leave"),
]
