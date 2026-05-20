# employees/views.py

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

from .models import Employee
from .face_utils import extract_and_save_embedding, verify_face_match

CV_DIR = settings.MEDIA_ROOT / "cv_files"
CV_DIR.mkdir(parents=True, exist_ok=True)
PROFILE_DIR = settings.MEDIA_ROOT / "profile_images"
PROFILE_DIR.mkdir(parents=True, exist_ok=True)
FACE_DUPLICATE_THRESHOLD = 0.58


# ─── Helpers ──────────────────────────────────────────────────────────────────


def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_employee_id() -> str:
    year = datetime.now().year
    for _ in range(20):
        suffix = "".join(random.choices(string.digits, k=4))
        candidate = f"EMP-{year}-{suffix}"
        if not Employee.objects(employee_id=candidate).first():
            return candidate
    raise ValueError("Could not generate a unique Employee ID.")


def generate_password(length: int = 10) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(random.choices(chars, k=length))
        if (
            any(c.isupper() for c in pwd)
            and any(c.islower() for c in pwd)
            and any(c.isdigit() for c in pwd)
            and any(c in "!@#$%" for c in pwd)
        ):
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
    return f"/media/{normalized.lstrip('/')}"


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


def save_base64_profile_image(data_url: str) -> str:
    if not data_url:
        return ""
    raw_data = data_url
    extension = ".jpg"
    if "," in data_url:
        header, raw_data = data_url.split(",", 1)
        if "png" in header:
            extension = ".png"
        elif "webp" in header:
            extension = ".webp"
    file_bytes = base64.b64decode(raw_data)
    filename = f"profile_{uuid.uuid4().hex}{extension}"
    file_path = PROFILE_DIR / filename
    file_path.write_bytes(file_bytes)
    return f"media/profile_images/{filename}"


def employee_payload(employee: Employee) -> dict:
    return {
        "employee_id": employee.employee_id,
        "name": employee.name,
        "email": employee.email,
        "phone": getattr(employee, "phone", "") or "",
        "role": employee.role,
        "department": employee.department,
        "designation": employee.designation,
        "is_active": employee.is_active,
        "profile_img": media_url(employee.profile_img or employee.photo_path or ""),
        "cv_file": media_url(employee.cv_file or ""),
    }


def find_employee(employee_id: str):
    return Employee.objects(employee_id=employee_id).first()


# ─── Admin Creates Employee (NO OTP, NO self-registration) ────────────────────


@api_view(["POST"])
def create_employee(request): 
    try:
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip().lower()
        department = request.data.get("department", "General").strip()
        designation = request.data.get("designation", "Employee").strip()
        phone = request.data.get("phone", "").strip()
        role = request.data.get("role", "employee").strip()
        image = request.data.get("image", "").strip()
        cv_file = request.data.get("cv_file", "").strip()
        cv_file_name = request.data.get("cv_file_name", "").strip()

        print(f"📋 Admin creating employee: {email}")

        # ── Validate ──────────────────────────────────────────────────────────
        if not all([name, email, department, designation]):
            return Response(
                {
                    "success": False,
                    "error": "Name, email, department and designation are required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if role not in ("employee", "hr", "admin"):
            role = "employee"

        if Employee.objects(email=email).first():
            return Response(
                {"success": False, "error": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Face embedding (optional at creation) ─────────────────────────────
        embedding = []
        photo_path = ""
        if image:
            print(f"🔍 Extracting face embedding for {email}...")
            embedding, error, photo_path = extract_and_save_embedding(image, email)
            if error:
                return Response(
                    {"success": False, "error": f"Face processing failed: {error}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            print(f"✅ Embedding extracted: {len(embedding)} dimensions")

        # ── CV ────────────────────────────────────────────────────────────────
        cv_path = save_base64_cv(cv_file, cv_file_name) if cv_file else ""

        # ── Auto-generate credentials ─────────────────────────────────────────
        employee_id = generate_employee_id()
        raw_password = generate_password()
        hashed = make_password(raw_password)

        print(f"🆔 Generated Employee ID: {employee_id}")

        # ── Save employee ─────────────────────────────────────────────────────
        employee = Employee(
            name=name,
            email=email,
            phone=phone,
            employee_id=employee_id,
            password=hashed,
            profile_img=photo_path or "",
            cv_file=cv_path,
            photo_path=photo_path or "",
            face_embedding=embedding,
            department=department,
            designation=designation,
            role=role,
            is_active=True,
        )
        employee.save()

        # ── Try sending email (non-blocking) ──────────────────────────────────
        try:
            send_mail(
                subject="Welcome! Your Employee Account Credentials",
                message=(
                    f"Hello {name},\n\n"
                    f"Your employee account has been created.\n\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                    f"  Employee ID : {employee_id}\n"
                    f"  Password    : {raw_password}\n"
                    f"━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
                    f"Please keep these credentials safe.\n"
                    f"We recommend changing your password after your first login.\n\n"
                    f"Regards,\nAttendance System"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )
            print(f"✅ Credentials emailed to {email}")
        except Exception as mail_err:
            print(f"⚠️ Email failed (non-critical): {mail_err}")

        print(f"✅ Employee created: {employee_id}")

        return Response(
            {
                "success": True,
                "message": f"Employee {name} created successfully!",
                "employee_id": employee_id,
                "password": raw_password,  # shown once on screen
                "name": name,
                "email": email,
                "department": department,
                "designation": designation,
                "role": role,
            },
            status=status.HTTP_201_CREATED,
        )

    except Exception as e:
        print(f"❌ Create employee error: {str(e)}")
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
                "phone": getattr(employee, "phone", "") or "",
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
        return Response({"success": False, "error": str(e)}, status=500)


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
                {"success": False, "error": "Account not found"}, status=404
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
            return Response({"success": False, "error": "Invalid password"}, status=401)

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
                "phone": getattr(employee, "phone", "") or "",
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
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Send OTP (Password Reset only) ───────────────────────────────────────────


@api_view(["POST"])
def send_otp(request):
    try:
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response(
                {"success": False, "error": "Email is required"}, status=400
            )

        employee = Employee.objects(email=email, is_active=True).first()
        if not employee:
            return Response(
                {
                    "success": True,
                    "message": "If this email is registered, an OTP has been sent.",
                }
            )

        otp = generate_otp()
        employee.reset_otp = otp
        employee.save()

        send_mail(
            subject="Your Password Reset OTP",
            message=(
                f"Hello {employee.name},\n\n"
                f"Your OTP for password reset is: {otp}\n\n"
                f"This OTP is valid for 10 minutes.\n\n"
                f"Regards,\nAttendance System"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )

        print(f"✅ OTP email sent to {email}")
        return Response(
            {"success": True, "message": "OTP sent to your registered email"}
        )

    except Exception as e:
        print(f"❌ Send OTP error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": "Failed to send OTP."}, status=500)


# ─── Reset Password ────────────────────────────────────────────────────────────


@api_view(["POST"])
def reset_password(request):
    try:
        email = request.data.get("email", "").strip().lower()
        otp = request.data.get("otp", "").strip()
        new_password = request.data.get("new_password", "").strip()

        if not all([email, otp, new_password]):
            return Response(
                {
                    "success": False,
                    "error": "Email, OTP, and new password are required",
                },
                status=400,
            )

        if len(new_password) < 6:
            return Response(
                {"success": False, "error": "Password must be at least 6 characters"},
                status=400,
            )

        employee = Employee.objects(email=email, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Account not found"}, status=404
            )

        if not employee.reset_otp or employee.reset_otp != otp:
            return Response(
                {"success": False, "error": "Invalid or expired OTP"}, status=400
            )

        employee.password = make_password(new_password)
        employee.reset_otp = ""
        employee.save()

        print(f"✅ Password reset for {email}")
        return Response({"success": True, "message": "Password reset successfully."})

    except Exception as e:
        print(f"❌ Reset password error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Profile ───────────────────────────────────────────────────────────────────


@api_view(["GET"])
def get_profile(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    if not employee_id:
        return Response(
            {"success": False, "error": "employee_id is required"}, status=400
        )
    employee = find_employee(employee_id)
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)
    return Response({"success": True, "employee": employee_payload(employee)})


@api_view(["POST"])
def update_profile(request):
    employee_id = request.data.get("employee_id", "").strip()
    if not employee_id:
        return Response(
            {"success": False, "error": "employee_id is required"}, status=400
        )

    employee = find_employee(employee_id)
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    name = request.data.get("name", "").strip()
    phone = request.data.get("phone", "").strip()
    department = request.data.get("department", "").strip()
    designation = request.data.get("designation", "").strip()
    current_password = request.data.get("current_password", "").strip()
    new_password = request.data.get("new_password", "").strip()

    if name:
        employee.name = name
    employee.phone = phone
    if department:
        employee.department = department
    if designation:
        employee.designation = designation

    if new_password:
        if len(new_password) < 6:
            return Response(
                {"success": False, "error": "Password must be at least 6 characters"},
                status=400,
            )
        if not current_password or not check_password(
            current_password, employee.password
        ):
            return Response(
                {"success": False, "error": "Current password is incorrect"}, status=400
            )
        employee.password = make_password(new_password)

    employee.save()
    return Response(
        {
            "success": True,
            "message": "Profile updated successfully",
            "employee": employee_payload(employee),
        }
    )


@api_view(["POST"])
def update_profile_photo(request):
    employee_id = request.data.get("employee_id", "").strip()
    image = request.data.get("image", "").strip()

    if not employee_id or not image:
        return Response(
            {"success": False, "error": "employee_id and image are required"},
            status=400,
        )

    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    try:
        employee.profile_img = save_base64_profile_image(image)
        employee.save()
    except Exception as exc:
        return Response(
            {"success": False, "error": f"Could not save photo: {exc}"}, status=400
        )

    return Response(
        {
            "success": True,
            "message": "Profile photo updated",
            "employee": employee_payload(employee),
        }
    )


@api_view(["POST"])
def update_face(request):
    employee_id = request.data.get("employee_id", "").strip()
    image = request.data.get("image", "").strip()

    if not employee_id or not image:
        return Response(
            {"success": False, "error": "employee_id and image are required"},
            status=400,
        )

    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    embedding, error, photo_path = extract_and_save_embedding(image, employee_id)
    if error or not embedding:
        return Response(
            {"success": False, "error": error or "Could not extract face features"},
            status=400,
        )

    employee.face_embedding = embedding
    employee.photo_path = photo_path or employee.photo_path
    employee.profile_img = photo_path or employee.profile_img
    employee.save()

    return Response(
        {
            "success": True,
            "message": "Face updated successfully",
            "employee": employee_payload(employee),
        }
    )


# ─── Admin Employee Management ────────────────────────────────────────────────


@api_view(["GET"])
def admin_employees(request):
    search = request.query_params.get("search", "").strip().lower()
    role = request.query_params.get("role", "").strip()
    status_filter = request.query_params.get("status", "active").strip()

    employees = Employee.objects.order_by("employee_id")
    if role and role != "all":
        employees = employees.filter(role=role)
    if status_filter == "active":
        employees = employees.filter(is_active=True)
    elif status_filter == "inactive":
        employees = employees.filter(is_active=False)

    data = []
    for emp in employees:
        payload = employee_payload(emp)
        haystack = " ".join(
            [
                payload["employee_id"],
                payload["name"],
                payload["email"],
                payload.get("phone", ""),
                payload.get("department", ""),
                payload.get("designation", ""),
                payload.get("role", ""),
            ]
        ).lower()
        if search and search not in haystack:
            continue
        data.append(payload)

    return Response({"success": True, "employees": data, "total": len(data)})


@api_view(["POST"])
def admin_update_employee(request):
    employee_id = request.data.get("employee_id", "").strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    for field in ["name", "phone", "department", "designation", "role"]:
        if field in request.data:
            value = str(request.data.get(field, "")).strip()
            if field == "role" and value not in {"employee", "admin", "hr"}:
                continue
            setattr(employee, field, value)

    if "is_active" in request.data:
        employee.is_active = bool(request.data.get("is_active"))

    employee.save()
    return Response(
        {
            "success": True,
            "message": "Employee updated",
            "employee": employee_payload(employee),
        }
    )


@api_view(["POST"])
def admin_reset_employee_password(request):
    employee_id = request.data.get("employee_id", "").strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    raw_password = generate_password()
    employee.password = make_password(raw_password)
    employee.save()

    try:
        send_mail(
            subject="Your Attendance System Password Was Reset",
            message=(
                f"Hello {employee.name},\n\n"
                f"Your password was reset by an administrator.\n\n"
                f"Employee ID  : {employee.employee_id}\n"
                f"New Password : {raw_password}\n\n"
                f"Please log in and change this password from your profile.\n\n"
                f"Regards,\nAttendance System"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[employee.email],
            fail_silently=True,
        )
    except Exception as exc:
        print(f"Password reset email failed: {exc}")

    return Response(
        {
            "success": True,
            "message": "Password reset successfully",
            "temporary_password": raw_password,
        }
    )
