from django.urls import path
from .views import (
    register_employee,
    login_employee,
    admin_login,
    send_otp,
    reset_password,
    send_registration_otp,
    verify_registration_otp,
)

urlpatterns = [
    path("register/", register_employee, name="register"),
    path("login/", login_employee, name="login"),
    path("admin-login/", admin_login, name="admin-login"),
    path("send-otp/", send_otp, name="send-otp"),
    path("reset-password/", reset_password, name="reset-password"),
    path("send-registration-otp/", send_registration_otp, name="send_registration_otp"),
    path(
        "verify-registration-otp/",
        verify_registration_otp,
        name="verify-registration-otp",
    ),
]
