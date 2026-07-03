# attendance/urls.py
from django.urls import path
from . import views
from . import hr_views

urlpatterns = [
    # Face
    path("verify-face/", views.verify_face, name="verify-face"),
    path("send-verify-otp/", views.send_verify_otp, name="send-verify-otp"),
    path("verify-otp/", views.verify_otp, name="verify-otp"),
    path("verify-pin/", views.verify_pin, name="verify-pin"),
    path("today-marked/", views.today_attendance_marked, name="today-marked"),
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
    # Leave management
    path("request-leave/", views.request_leave, name="request-leave"),
    path("my-leave-requests/", views.my_leave_requests, name="my-leave-requests"),
    path("admin-leave-requests/", views.admin_leave_requests, name="admin-leave-requests"),
    path("approve-leave/", views.approve_leave, name="approve-leave"),
    path("leave-notifications/", views.leave_notifications, name="leave-notifications"),
    path(
        "mark-leave-notifications-read/",
        views.mark_leave_notifications_read,
        name="mark-leave-notifications-read",
    ),
    # HR: Shifts & roster
    path("hr/shifts/", hr_views.shifts_list_create, name="hr-shifts"),
    path("hr/shifts/<str:code>/", hr_views.shift_detail, name="hr-shift-detail"),
    path("hr/roster/", hr_views.roster_manage, name="hr-roster"),
    path("hr/employee-shift/", hr_views.employee_shift_info, name="hr-employee-shift"),
    # HR: Holidays
    path("hr/holidays/", hr_views.holidays_list_create, name="hr-holidays"),
    path("hr/holidays/<str:holiday_id>/", hr_views.holiday_delete, name="hr-holiday-delete"),
    # HR: Leave balance
    path("hr/leave-balance/", hr_views.leave_balance_view, name="hr-leave-balance"),
    path("hr/leave-balance/update/", hr_views.leave_balance_update, name="hr-leave-balance-update"),
    # HR: Break time
    path("hr/break/", hr_views.break_action, name="hr-break"),
    path("hr/break/status/", hr_views.break_status, name="hr-break-status"),
    # HR: Regularization
    path("hr/regularization/request/", hr_views.request_regularization, name="hr-reg-request"),
    path("hr/regularization/mine/", hr_views.my_regularizations, name="hr-reg-mine"),
    path("hr/regularization/admin/", hr_views.admin_regularizations, name="hr-reg-admin"),
    path("hr/regularization/resolve/", hr_views.resolve_regularization, name="hr-reg-resolve"),
    # HR: Overtime
    path("hr/overtime/admin/", hr_views.admin_overtime_requests, name="hr-ot-admin"),
    path("hr/overtime/resolve/", hr_views.resolve_overtime, name="hr-ot-resolve"),
]
