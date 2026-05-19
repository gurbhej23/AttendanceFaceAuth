import base64
import os
import random
import string
import uuid
from datetime import datetime

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password

from .models import Employee, RegistrationOTP
from .face_utils import extract_and_save_embedding

CV_DIR = settings.MEDIA_ROOT / "cv_files"
CV_DIR.mkdir(parents=True, exist_ok=True)

# ─── Helpers ───────────────────────────────────────────────────────────────────


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_employee_id() -> str:
    """Generate a unique Employee ID like EMP-2025-XXXX"""
    year = datetime.now().year
    for _ in range(20):  # max 20 attempts to find unique ID
        suffix = "".join(random.choices(string.digits, k=4))
        candidate = f"EMP-{year}-{suffix}"
        if not Employee.objects(employee_id=candidate).first():
            return candidate
    raise ValueError("Could not generate a unique Employee ID. Please try again.")


def generate_password(length: int = 10) -> str:
    """Generate a strong random password with letters, digits, and symbols"""
    chars = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(random.choices(chars, k=length))
        # Ensure at least one of each type
        has_upper = any(c.isupper() for c in pwd)
        has_lower = any(c.islower() for c in pwd)
        has_digit = any(c.isdigit() for c in pwd)
        has_symbol = any(c in "!@#$%" for c in pwd)
        if has_upper and has_lower and has_digit and has_symbol:
            return pwd


def create_access_token(employee: Employee) -> str:
    token = AccessToken()
    token["employee_id"] = employee.employee_id
    token["name"] = employee.name
    token["email"] = employee.email
    token["role"] = employee.role
    return str(token)


def media_url(path: str) -> str:
    if not path:
        return ""
    normalized = path.replace("\\", "/")
    if normalized.startswith("/media/"):
        return normalized
    if normalized.startswith("media/"):
        return f"/{normalized}"
    return f"{settings.MEDIA_URL}{normalized.lstrip('/')}"


def save_base64_cv(data_url: str, original_name: str = "") -> str:
    if not data_url:
        return ""

    raw_data = data_url
    extension = os.path.splitext(original_name or "")[1].lower()
    if "," in data_url:
        header, raw_data = data_url.split(",", 1)
        if not extension:
            if "pdf" in header:
                extension = ".pdf"
            elif "wordprocessingml" in header:
                extension = ".docx"
            elif "msword" in header:
                extension = ".doc"

    if extension not in {".pdf", ".doc", ".docx"}:
        extension = ".pdf"

    file_bytes = base64.b64decode(raw_data)
    filename = f"cv_{uuid.uuid4().hex}{extension}"
    file_path = CV_DIR / filename
    file_path.write_bytes(file_bytes)
    return f"media/cv_files/{filename}"


def employee_payload(employee: Employee) -> dict:
    return {
        "employee_id": employee.employee_id,
        "name": employee.name,
        "email": employee.email,
        "role": employee.role,
        "department": employee.department,
        "designation": employee.designation,
        "profile_img": media_url(employee.profile_img or employee.photo_path or ""),
        "cv_file": media_url(employee.cv_file or ""),
    }


# ─── Register Employee ─────────────────────────────────────────────────────────


@api_view(["POST"])
def register_employee(request):
    try:
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip().lower()
        image = request.data.get("image", "").strip()
        cv_file = request.data.get("cv_file", "").strip()
        cv_file_name = request.data.get("cv_file_name", "").strip()
        department = request.data.get("department", "General").strip()
        designation = request.data.get("designation", "Employee").strip()

        print(f"📋 Register attempt: {email}")

        # ── Validate required fields ──────────────────────────────────────────
        if not all([name, email, image]):
            return Response(
                {
                    "success": False,
                    "error": "Name, email, and face image are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Check email duplicate ─────────────────────────────────────────────
        if Employee.objects(email=email).first():
            return Response(
                {"success": False, "error": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Check OTP was verified ────────────────────────────────────────────
        otp_record = RegistrationOTP.objects(email=email, verified=True).first()
        if not otp_record:
            return Response(
                {
                    "success": False,
                    "error": "Email not verified. Please complete OTP verification first.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Extract face embedding ────────────────────────────────────────────
        print(f"🔍 Extracting face embedding for {email}...")
        embedding, error, photo_path = extract_and_save_embedding(image, email)

        if error:
            print(f"❌ Embedding error: {error}")
            return Response(
                {"success": False, "error": f"Face processing failed: {error}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not embedding:
            return Response(
                {
                    "success": False,
                    "error": "Could not extract face features. Please use a clear photo.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        print(f"✅ Embedding extracted: {len(embedding)} dimensions")

        # ── Auto-generate Employee ID and Password ────────────────────────────
        employee_id = generate_employee_id()
        raw_password = generate_password()
        hashed = make_password(raw_password)
        cv_path = save_base64_cv(cv_file, cv_file_name) if cv_file else ""

        print(f"🆔 Generated Employee ID: {employee_id}")

        # ── Save employee ─────────────────────────────────────────────────────
        employee = Employee(
            name=name,
            email=email,
            employee_id=employee_id,
            password=hashed,
            profile_img=photo_path or "",
            cv_file=cv_path,
            photo_path=photo_path or "",
            face_embedding=embedding,
            department=department,
            designation=designation,
            role="employee",
            is_active=True,
        )
        employee.save()

        # ── Clean up OTP record ───────────────────────────────────────────────
        otp_record.delete()

        # ── Email credentials to employee ─────────────────────────────────────
        send_mail(
            subject="Welcome! Your Employee Account Credentials",
            message=(
                f"Hello {name},\n\n"
                f"Your employee account has been created successfully.\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"  Employee ID : {employee_id}\n"
                f"  Password    : {raw_password}\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                f"Please keep these credentials safe.\n"
                f"We recommend changing your password after your first login.\n\n"
                f"Regards,\n"
                f"Attendance System"
            ),
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )

        print(f"✅ Employee registered: {employee_id} | Credentials emailed to {email}")

        return Response(
            {
                "success": True,
                "message": f"Registration successful! Your Employee ID and password have been sent to {email}.",
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        print(f"❌ Register error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Login Employee ────────────────────────────────────────────────────────────


@api_view(["POST"])
def login_employee(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        password = request.data.get("password", "").strip()

        print(f"🔐 Login attempt: {employee_id}")

        if not employee_id or not password:
            return Response(
                {"success": False, "error": "Employee ID and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()

        if not employee:
            return Response(
                {"success": False, "error": "Employee not found or account inactive"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not check_password(password, employee.password):
            return Response(
                {"success": False, "error": "Invalid password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token = create_access_token(employee)

        print(f"✅ Login success: {employee_id} | role: {employee.role}")

        return Response(
            {
                "success": True,
                "message": f"Welcome back, {employee.name}",
                "access": token,
                "employee_id": employee.employee_id,
                "name": employee.name,
                "email": employee.email,
                "role": employee.role,
                "department": employee.department,
                "designation": employee.designation,
                "profile_img": media_url(
                    employee.profile_img or employee.photo_path or ""
                ),
                "cv_file": media_url(employee.cv_file or ""),
            }
        )

    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Admin Login ───────────────────────────────────────────────────────────────


@api_view(["POST"])
def admin_login(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        password = request.data.get("password", "").strip()

        print(f"🔐 Admin login attempt: {employee_id}")

        if not employee_id or not password:
            return Response(
                {"success": False, "error": "Employee ID and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()

        if not employee:
            return Response(
                {"success": False, "error": "Account not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if employee.role not in ("admin", "hr"):
            return Response(
                {
                    "success": False,
                    "error": "Access denied. Admin or HR role required.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        if not check_password(password, employee.password):
            return Response(
                {"success": False, "error": "Invalid password"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        token = create_access_token(employee)

        print(f"✅ Admin login success: {employee_id} | role: {employee.role}")

        return Response(
            {
                "success": True,
                "message": f"Welcome, {employee.name}",
                "access": token,
                "employee_id": employee.employee_id,
                "name": employee.name,
                "email": employee.email,
                "role": employee.role,
                "department": employee.department,
                "designation": employee.designation,
                "profile_img": media_url(
                    employee.profile_img or employee.photo_path or ""
                ),
                "cv_file": media_url(employee.cv_file or ""),
            }
        )

    except Exception as e:
        print(f"❌ Admin login error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Send OTP (Password Reset) ─────────────────────────────────────────────────


@api_view(["POST"])
def send_otp(request):
    try:
        email = request.data.get("email", "").strip().lower()

        print(f"📧 OTP request for: {email}")

        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects(email=email, is_active=True).first()

        if not employee:
            # Don't reveal whether email exists — security best practice
            return Response(
                {
                    "success": True,
                    "message": "If this email is registered, an OTP has been sent.",
                },
            )

        otp = generate_otp()
        employee.reset_otp = otp
        employee.save()

        print(f"🔑 OTP for {email}: {otp}")

        send_mail(
            subject="Your Password Reset OTP",
            message=(
                f"Hello {employee.name},\n\n"
                f"Your OTP for password reset is: {otp}\n\n"
                f"This OTP is valid for 10 minutes.\n"
                f"If you did not request this, please ignore this email.\n\n"
                f"Regards,\nAttendance System"
            ),
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        )

        print(f"✅ OTP email sent to {email}")

        return Response(
            {"success": True, "message": "OTP sent to your registered email"},
        )

    except Exception as e:
        print(f"❌ Send OTP error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": "Failed to send OTP. Please try again."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Reset Password ────────────────────────────────────────────────────────────


@api_view(["POST"])
def reset_password(request):
    try:
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()
        new_password = request.data.get("new_password", "").strip()

        print(f"🔑 Password reset attempt for: {email}")

        if not all([email, otp, new_password]):
            return Response(
                {
                    "success": False,
                    "error": "Email, OTP, and new password are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {"success": False, "error": "Password must be at least 6 characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects(email=email, is_active=True).first()

        if not employee:
            return Response(
                {"success": False, "error": "Account not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not employee.reset_otp or employee.reset_otp != otp:
            return Response(
                {"success": False, "error": "Invalid or expired OTP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee.password = make_password(new_password)
        employee.reset_otp = ""
        employee.save()

        print(f"✅ Password reset success for {email}")

        return Response(
            {
                "success": True,
                "message": "Password reset successfully. You can now log in.",
            },
        )

    except Exception as e:
        print(f"❌ Reset password error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Send Registration OTP ─────────────────────────────────────────────────────


@api_view(["POST"])
def send_registration_otp(request):
    try:
        email = request.data.get("email", "").strip().lower()

        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Employee.objects(email=email).first():
            return Response(
                {"success": False, "error": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = generate_otp()

        # Clear old OTP and create new one
        RegistrationOTP.objects(email=email).delete()
        RegistrationOTP(email=email, otp=otp).save()

        send_mail(
            subject="Your Registration OTP",
            message=(
                f"Hello,\n\n"
                f"Your OTP to verify your email for registration is: {otp}\n\n"
                f"This OTP is valid for 1 minutes.\n"
                f"If you did not request this, please ignore this email.\n\n"
                f"Regards,\nAttendance System"
            ),
            from_email=settings.EMAIL_HOST_USER,
            recipient_list=[email],
            fail_silently=False,
        ) 
        print(f"📧 Registration OTP for {email}: {otp}")
        print("Using SMTP:", settings.EMAIL_HOST)

        return Response(
            {
                "success": True,
                "message": "OTP sent to your email for registration verification",
            }
        )
        

    except Exception as e:
        print(f"❌ Send registration OTP error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": "Failed to send registration OTP"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Verify Registration OTP ───────────────────────────────────────────────────


@api_view(["POST"])
def verify_registration_otp(request):
    try:
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()

        if not email or not otp:
            return Response(
                {"success": False, "error": "Email and OTP are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record = RegistrationOTP.objects(email=email).first()

        if not record or record.otp != otp:
            return Response(
                {"success": False, "error": "Invalid or expired OTP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Mark as verified — register_employee will delete it after use
        record.verified = True
        record.save()

        return Response(
            {"success": True, "message": "Email verified successfully"},
        )

    except Exception as e:
        print(f"❌ Verify OTP error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
