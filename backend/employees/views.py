import base64
import binascii
import os
import random
import string
import traceback
import uuid
from datetime import datetime

import pytz
import sendgrid
from sendgrid.helpers.mail import Mail, To

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import AccessToken
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password

from .models import (
    ChatClearState,
    ChatMessage,
    ChatGroup,
    Employee,
    GroupChatClearState,
    GroupMessage,
    RegistrationOTP,
)
from .face_utils import extract_and_save_embedding, verify_face_match

CV_DIR = settings.MEDIA_ROOT / "cv_files"
PROFILE_DIR = settings.MEDIA_ROOT / "profile_images"
GROUP_IMG_DIR = settings.MEDIA_ROOT / "group_images"
CV_DIR.mkdir(parents=True, exist_ok=True)
PROFILE_DIR.mkdir(parents=True, exist_ok=True)
GROUP_IMG_DIR.mkdir(parents=True, exist_ok=True)

FACE_DUPLICATE_THRESHOLD = 0.58


# ─── SendGrid email helper ─────────────────────────────────────────────────────


def send_email(
    to: str,
    subject: str,
    text: str,
    html: str = "",
) -> tuple[bool, str]:
    api_key = getattr(settings, "SENDGRID_API_KEY", "")
    from_email = getattr(settings, "SENDGRID_FROM_EMAIL", "")
    from_name = getattr(settings, "SENDGRID_FROM_NAME", "Attendance System")

    if not api_key:
        msg = "SENDGRID_API_KEY not set in settings/env"
        print(f"[Email] ❌ {msg}")
        return False, msg

    if not from_email:
        msg = "SENDGRID_FROM_EMAIL not set in settings/env"
        print(f"[Email] ❌ {msg}")
        return False, msg

    try:
        sg = sendgrid.SendGridAPIClient(api_key=api_key)

        mail = Mail(
            from_email=(from_email, from_name),
            to_emails=To(to),
            subject=subject,
            plain_text_content=text,
            html_content=(
                html if html else f"<pre style='font-family:sans-serif'>{text}</pre>"
            ),
        )

        response = sg.send(mail)
        success = response.status_code in (200, 201, 202)

        print(
            f"[Email] {'✅' if success else '❌'} to={to} status={response.status_code}"
        )
        return success, "" if success else f"SendGrid returned {response.status_code}"

    except Exception as e:
        print(f"[Email] ❌ Exception: {e}")
        traceback.print_exc()
        return False, str(e)


# ─── OTP email templates ───────────────────────────────────────────────────────


def otp_html(otp: str, title: str, subtitle: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;
                border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
        <h2 style="color:#1e293b;margin-top:0;">{title}</h2>
        <p style="color:#475569;">{subtitle}</p>
        <div style="text-align:center;margin:28px 0;padding:20px;
                    background:#fff;border-radius:12px;border:1px solid #e2e8f0;">
            <span style="font-size:44px;font-weight:bold;letter-spacing:14px;color:#3b82f6;">
                {otp}
            </span>
        </div>
        <p style="color:#94a3b8;font-size:13px;">
            Valid for 10 minutes. If you did not request this, ignore this email.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
            Regards,<br/><strong>Attendance System</strong>
        </p>
    </div>
    """


def credentials_html(name: str, employee_id: str, password: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;
                border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
        <h2 style="color:#1e293b;margin-top:0;">Welcome, {name}! 🎉</h2>
        <p style="color:#475569;">Your employee account has been created successfully.</p>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;
                    padding:20px;margin:20px 0;">
            <p style="margin:0 0 12px;color:#64748b;font-size:12px;text-transform:uppercase;
                      letter-spacing:1px;">Your Credentials</p>
            <p style="margin:6px 0;font-size:15px;">
                <strong>Employee ID:</strong>&nbsp;
                <code style="background:#e2e8f0;padding:3px 10px;border-radius:6px;
                             font-size:15px;">{employee_id}</code>
            </p>
            <p style="margin:6px 0;font-size:15px;">
                <strong>Password:</strong>&nbsp;
                <code style="background:#e2e8f0;padding:3px 10px;border-radius:6px;
                             font-size:15px;">{password}</code>
            </p>
        </div>
        <p style="color:#ef4444;font-size:13px;">
            ⚠️ Please change your password after your first login.
        </p>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
            Regards,<br/><strong>Attendance System</strong>
        </p>
    </div>
    """


# ─── Other helpers ─────────────────────────────────────────────────────────────


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


def chat_datetime_iso(value) -> str:
    if not value:
        return ""
    if value.tzinfo is None:
        value = pytz.UTC.localize(value)
    return value.astimezone(pytz.UTC).isoformat()


from .media_utils import media_url


def save_base64_cv(data_url: str, original_name: str = "") -> str:
    if not data_url:
        return ""
    raw_data = data_url
    extension = os.path.splitext(original_name or "")[1].lower()
    if "," in data_url:
        header, raw_data = data_url.split(",", 1)
        if "pdf" not in header.lower():
            raise ValueError("CV / Resume must be a PDF file")
        if not extension:
            extension = ".pdf"
    if extension != ".pdf":
        raise ValueError("CV / Resume must be a PDF file")
    try:
        file_bytes = base64.b64decode(raw_data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Invalid PDF file") from exc
    if not file_bytes.startswith(b"%PDF-"):
        raise ValueError("Invalid PDF file")
    filename = f"cv_{uuid.uuid4().hex}{extension}"
    (CV_DIR / filename).write_bytes(file_bytes)
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
    filename = f"profile_{uuid.uuid4().hex}{extension}"
    (PROFILE_DIR / filename).write_bytes(base64.b64decode(raw_data))
    return f"media/profile_images/{filename}"


def save_base64_group_image(data_url: str) -> str:
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
    filename = f"group_{uuid.uuid4().hex}{extension}"
    (GROUP_IMG_DIR / filename).write_bytes(base64.b64decode(raw_data))
    return f"media/group_images/{filename}"


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
        "is_online": getattr(employee, "is_online", False),
        "last_seen": chat_datetime_iso(getattr(employee, "last_seen", None)),
        "profile_img": media_url(employee.profile_img or employee.photo_path or ""),
        "cv_file": media_url(employee.cv_file or ""),
    }


def chat_payload(message: ChatMessage) -> dict:
    return {
        "id": str(message.id),
        "sender_id": message.sender_id,
        "sender_name": message.sender_name,
        "sender_role": message.sender_role,
        "recipient_id": message.recipient_id,
        "recipient_name": message.recipient_name,
        "message": message.message,
        "is_read": message.is_read,
        "is_edited": getattr(message, "is_edited", False),
        "is_deleted": getattr(message, "is_deleted", False),
        "reactions": getattr(message, "reactions", {}) or {},
        "created_at": chat_datetime_iso(message.created_at),
    }


def group_message_payload(message: GroupMessage, group: ChatGroup | None = None) -> dict:
    read_by = list(getattr(message, "read_by", []) or [])
    recipients = []
    if group:
        recipients = [m for m in group.members if m != message.sender_id]
    read_count = len([member_id for member_id in read_by if member_id != message.sender_id])
    total_recipients = len(recipients)
    is_fully_read = total_recipients > 0 and all(
        member_id in read_by for member_id in recipients
    )
    return {
        "id": str(message.id),
        "group_id": message.group_id,
        "sender_id": message.sender_id,
        "sender_name": message.sender_name,
        "message": message.message,
        "is_edited": getattr(message, "is_edited", False),
        "is_deleted": getattr(message, "is_deleted", False),
        "message_type": getattr(message, "message_type", "user") or "user",
        "read_by": read_by,
        "read_count": read_count,
        "total_recipients": total_recipients,
        "is_fully_read": is_fully_read,
        "reactions": getattr(message, "reactions", {}) or {},
        "created_at": chat_datetime_iso(message.created_at),
    }


def group_payload(group: ChatGroup) -> dict:
    member_details = []
    for member_id in group.members:
        employee = Employee.objects(employee_id=member_id).first()
        if employee:
            member_details.append(employee_payload(employee))
    return {
        "id": str(group.id),
        "group_name": group.group_name,
        "group_img": media_url(getattr(group, "group_img", "") or ""),
        "created_by": group.created_by,
        "members": list(group.members),
        "member_count": len(group.members),
        "member_details": member_details,
        "created_at": chat_datetime_iso(group.created_at),
    }


def mark_group_messages_read(group: ChatGroup, reader_id: str) -> None:
    messages = GroupMessage.objects(group_id=str(group.id), is_deleted=False)
    for message in messages:
        if message.sender_id == reader_id:
            continue
        read_by = list(getattr(message, "read_by", []) or [])
        if reader_id not in read_by:
            read_by.append(reader_id)
            message.read_by = read_by
            message.save()


def get_chat_cleared_at(employee_id: str, contact_id: str):
    state = ChatClearState.objects(
        employee_id=employee_id, contact_id=contact_id
    ).first()
    return state.cleared_at if state else None


def get_group_cleared_at(employee_id: str, group_id: str):
    state = GroupChatClearState.objects(
        employee_id=employee_id, group_id=group_id
    ).first()
    return state.cleared_at if state else None


def is_group_message_visible_to_reader(
    message: GroupMessage, reader_id: str, group_id: str
) -> bool:
    cleared_at = get_group_cleared_at(reader_id, group_id)
    if not cleared_at:
        return True
    return message.created_at > cleared_at


def is_message_visible_to_reader(message: ChatMessage, reader_id: str) -> bool:
    contact_id = (
        message.sender_id
        if message.recipient_id == reader_id
        else message.recipient_id
    )
    cleared_at = get_chat_cleared_at(reader_id, contact_id)
    if not cleared_at:
        return True
    return message.created_at > cleared_at


def count_unread_messages(employee: Employee) -> dict:
    direct_messages = ChatMessage.objects(
        recipient_id=employee.employee_id, is_read=False, is_deleted=False
    )

    direct_by_sender: dict[str, int] = {}
    direct_count = 0
    for message in direct_messages:
        if not is_message_visible_to_reader(message, employee.employee_id):
            continue
        direct_count += 1
        direct_by_sender[message.sender_id] = direct_by_sender.get(message.sender_id, 0) + 1

    direct_contacts = []
    for sender_id, unread in direct_by_sender.items():
        sender = Employee.objects(employee_id=sender_id).first()
        if sender:
            direct_contacts.append(
                {
                    "employee_id": sender_id,
                    "name": sender.name,
                    "unread": unread,
                }
            )
    direct_contacts.sort(key=lambda item: item["unread"], reverse=True)

    if employee.role in ("admin", "hr"):
        groups = ChatGroup.objects()
    else:
        groups = ChatGroup.objects(members=employee.employee_id)

    group_count = 0
    group_unread = []
    for group in groups:
        group_id = str(group.id)
        unread_in_group = 0
        for message in GroupMessage.objects(group_id=group_id, is_deleted=False):
            if message.sender_id == employee.employee_id:
                continue
            if not is_group_message_visible_to_reader(
                message, employee.employee_id, group_id
            ):
                continue
            read_by = getattr(message, "read_by", []) or []
            if employee.employee_id not in read_by:
                unread_in_group += 1
        if unread_in_group:
            group_unread.append(
                {
                    "group_id": group_id,
                    "group_name": group.group_name,
                    "unread": unread_in_group,
                }
            )
        group_count += unread_in_group

    return {
        "total": direct_count + group_count,
        "direct": direct_count,
        "group": group_count,
        "direct_contacts": direct_contacts,
        "group_unread": group_unread,
    }


def can_access_group(employee: Employee, group: ChatGroup) -> bool:
    if employee.role in ("admin", "hr"):
        return True
    return employee.employee_id in group.members


def can_manage_group(employee: Employee) -> bool:
    return employee.role in ("admin", "hr")


def broadcast_employee_event(employee_id: str, payload: dict) -> None:
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer or not employee_id:
            return
        async_to_sync(channel_layer.group_send)(
            f"chat_{employee_id}",
            {"type": "chat.raw", "payload": payload},
        )
    except Exception:
        pass


def broadcast_group_event(group_id: str, event_type: str, message_payload: dict) -> None:
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return
        async_to_sync(channel_layer.group_send)(
            f"group_{group_id}",
            {
                "type": "group.event",
                "event_type": event_type,
                "message": message_payload,
            },
        )
    except Exception:
        pass


def broadcast_direct_chat_event(event_type: str, message_payload: dict) -> None:
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer or not message_payload:
            return
        event = {
            "type": "chat.event",
            "event_type": event_type,
            "message": message_payload,
        }
        async_to_sync(channel_layer.group_send)(
            f"chat_{message_payload['recipient_id']}", event
        )
        async_to_sync(channel_layer.group_send)(
            f"chat_{message_payload['sender_id']}", event
        )
    except Exception:
        pass


def create_system_group_message(group_id: str, text: str) -> GroupMessage:
    message = GroupMessage(
        group_id=group_id,
        sender_id="system",
        sender_name="System",
        message=text.strip(),
        message_type="system",
        created_at=datetime.now(pytz.UTC),
    )
    message.save()
    return message


def find_employee(employee_id: str):
    return Employee.objects(employee_id=employee_id).first()


# ─── Register Employee ─────────────────────────────────────────────────────────


@api_view(["POST"])
def register_employee(request):
    try:
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip().lower()
        phone = request.data.get("phone", "").strip()
        image = request.data.get("image", "").strip()
        cv_file = request.data.get("cv_file", "").strip()
        cv_file_name = request.data.get("cv_file_name", "").strip()
        department = request.data.get("department", "General").strip()
        designation = request.data.get("designation", "Employee").strip()

        print(f"Register attempt: {email}")

        if not all([name, email, image]):
            return Response(
                {"success": False, "error": "Name, email, and face image are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if Employee.objects(email=email).first():
            return Response(
                {"success": False, "error": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_record = RegistrationOTP.objects(email=email, verified=True).first()
        if not otp_record:
            return Response(
                {
                    "success": False,
                    "error": "Email not verified. Please complete OTP verification first.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        print(f"Extracting face embedding for {email}...")
        embedding, error, photo_path = extract_and_save_embedding(image, email)

        if error:
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

        # Check for duplicate face
        for existing in Employee.objects(face_embedding__ne=[]):
            if not getattr(existing, "face_embedding", None):
                continue
            if verify_face_match(
                embedding, existing.face_embedding, FACE_DUPLICATE_THRESHOLD
            ):
                return Response(
                    {
                        "success": False,
                        "error": "This face is already registered. Please log in with your existing account.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        employee_id = generate_employee_id()
        raw_password = generate_password()
        hashed = make_password(raw_password)
        try:
            cv_path = save_base64_cv(cv_file, cv_file_name) if cv_file else ""
        except ValueError as exc:
            return Response(
                {"success": False, "error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        Employee(
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
            role="employee",
            is_active=True,
        ).save()

        otp_record.delete()

        # Send credentials via SendGrid
        email_ok, email_err = send_email(
            to=email,
            subject="Welcome! Your Employee Account Credentials",
            text=(
                f"Hello {name},\n\n"
                f"Your account has been created.\n\n"
                f"Employee ID : {employee_id}\n"
                f"Password    : {raw_password}\n\n"
                f"Please change your password after first login.\n\n"
                f"Regards,\nAttendance System"
            ),
            html=credentials_html(name, employee_id, raw_password),
        )

        print(f"Employee registered: {employee_id} | email sent: {email_ok}")

        response_data: dict = {
            "success": True,
            "message": f"Registration successful! Credentials sent to {email}.",
        }
        if not email_ok:
            response_data["message"] = (
                "Registration successful, but credentials email failed. "
                "Please save these credentials now."
            )
            response_data["credentials"] = {
                "employee_id": employee_id,
                "password": raw_password,
            }
            response_data["email_error"] = email_err

        return Response(response_data, status=status.HTTP_201_CREATED)

    except Exception as e:
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
        print(f"Login success: {employee_id}")

        return Response(
            {
                "success": True,
                "message": f"Welcome back, {employee.name}",
                "access": token,
                **employee_payload(employee),
            }
        )

    except Exception as e:
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
        print(f"Admin login success: {employee_id}")

        return Response(
            {
                "success": True,
                "message": f"Welcome, {employee.name}",
                "access": token,
                **employee_payload(employee),
            }
        )

    except Exception as e:
        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Send OTP — Password Reset ─────────────────────────────────────────────────


@api_view(["POST"])
def send_otp(request):
    try:
        email = request.data.get("email", "").strip().lower()
        if not email:
            return Response(
                {"success": False, "error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
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

        send_email(
            to=email,
            subject="Your Password Reset OTP",
            text=f"Hello {employee.name},\n\nYour OTP for password reset is: {otp}\n\nValid for 10 minutes.\n\nRegards,\nAttendance System",
            html=otp_html(
                otp,
                "Password Reset",
                f"Hello {employee.name}, your OTP to reset your password:",
            ),
        )

        return Response(
            {"success": True, "message": "OTP sent to your registered email"}
        )

    except Exception as e:
        traceback.print_exc()
        return Response(
            {"success": False, "error": "Failed to send OTP."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


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

        return Response(
            {
                "success": True,
                "message": "Password reset successfully. You can now log in.",
            }
        )

    except Exception as e:
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
        RegistrationOTP.objects(email=email).delete()
        RegistrationOTP(email=email, otp=otp).save()

        ok, err = send_email(
            to=email,
            subject="Your Registration OTP — Attendance System",
            text=f"Your OTP to verify your email for registration is: {otp}\n\nValid for 10 minutes.\n\nRegards,\nAttendance System",
            html=otp_html(
                otp, "Email Verification", "Your OTP to complete registration:"
            ),
        )

        if not ok:
            return Response(
                {"success": False, "error": f"Failed to send OTP: {err}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        print(f"Registration OTP for {email}: {otp}")
        return Response({"success": True, "message": "OTP sent to your email"})

    except Exception as e:
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

        record.verified = True
        record.save()
        return Response({"success": True, "message": "Email verified successfully"})

    except Exception as e:
        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ─── Profile views ─────────────────────────────────────────────────────────────


@api_view(["GET"])
def get_profile(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    if not employee_id:
        return Response(
            {"success": False, "error": "employee_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({"success": True, "employee": employee_payload(employee)})


@api_view(["POST"])
def update_profile(request):
    employee_id = request.data.get("employee_id", "").strip()
    if not employee_id:
        return Response(
            {"success": False, "error": "employee_id is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if name := request.data.get("name", "").strip():
        employee.name = name
    employee.phone = request.data.get("phone", "").strip()
    if dept := request.data.get("department", "").strip():
        employee.department = dept
    if desig := request.data.get("designation", "").strip():
        employee.designation = desig

    new_password = request.data.get("new_password", "").strip()
    if new_password:
        if len(new_password) < 6:
            return Response(
                {"success": False, "error": "Password must be at least 6 characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        current = request.data.get("current_password", "").strip()
        if not current or not check_password(current, employee.password):
            return Response(
                {"success": False, "error": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        employee.password = make_password(new_password)

    if cv_file := request.data.get("cv_file", "").strip():
        try:
            employee.cv_file = save_base64_cv(
                cv_file, request.data.get("cv_file_name", "").strip()
            )
        except Exception as exc:
            return Response(
                {"success": False, "error": f"Could not save CV: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            status=status.HTTP_400_BAD_REQUEST,
        )
    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    try:
        employee.profile_img = save_base64_profile_image(image)
        employee.save()
    except Exception as exc:
        return Response(
            {"success": False, "error": f"Could not save photo: {exc}"},
            status=status.HTTP_400_BAD_REQUEST,
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
            status=status.HTTP_400_BAD_REQUEST,
        )
    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    embedding, error, photo_path = extract_and_save_embedding(image, employee_id)
    if error or not embedding:
        return Response(
            {"success": False, "error": error or "Could not extract face features"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    employee.face_embedding = embedding
    employee.photo_path = photo_path or employee.photo_path
    employee.profile_img = photo_path or employee.profile_img
    employee.save()
    return Response(
        {
            "success": True,
            "message": "Face profile updated",
            "employee": employee_payload(employee),
        }
    )


# ─── Admin views ───────────────────────────────────────────────────────────────


@api_view(["GET"])
def admin_employees(request):
    search = request.query_params.get("search", "").strip().lower()
    role_filter = request.query_params.get("role", "").strip()
    status_filter = request.query_params.get("status", "active").strip()

    employees = Employee.objects.order_by("employee_id")
    if role_filter and role_filter != "all":
        employees = employees.filter(role=role_filter)
    if status_filter == "active":
        employees = employees.filter(is_active=True)
    elif status_filter == "inactive":
        employees = employees.filter(is_active=False)

    data = []
    for emp in employees:
        p = employee_payload(emp)
        if (
            search
            and search
            not in " ".join(
                [
                    p["employee_id"],
                    p["name"],
                    p["email"],
                    p.get("phone", ""),
                    p.get("department", ""),
                    p.get("designation", ""),
                    p.get("role", ""),
                ]
            ).lower()
        ):
            continue
        data.append(p)

    return Response({"success": True, "employees": data, "total": len(data)})


@api_view(["POST"])
def admin_update_employee(request):
    employee = find_employee(request.data.get("employee_id", "").strip())
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
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
    employee = find_employee(request.data.get("employee_id", "").strip())
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    raw_password = generate_password()
    employee.password = make_password(raw_password)
    employee.save()

    # Send new password via SendGrid
    send_email(
        to=employee.email,
        subject="Your Password Was Reset — Attendance System",
        text=(
            f"Hello {employee.name},\n\nYour password was reset by an administrator.\n\n"
            f"Employee ID: {employee.employee_id}\nNew Password: {raw_password}\n\n"
            f"Please log in and change this password from your profile."
        ),
        html=credentials_html(employee.name, employee.employee_id, raw_password),
    )

    return Response(
        {
            "success": True,
            "message": "Password reset successfully",
            "temporary_password": raw_password,
        }
    )


# ─── Chat views ────────────────────────────────────────────────────────────────


@api_view(["GET"])
def chat_contacts(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if employee.role in ("admin", "hr"):
        contacts = Employee.objects(
            is_active=True, employee_id__ne=employee_id
        ).order_by("role", "name")
    else:
        contacts = Employee.objects(is_active=True, role__in=["admin", "hr"]).order_by(
            "role", "name"
        )

    return Response(
        {"success": True, "contacts": [employee_payload(c) for c in contacts]}
    )


@api_view(["GET"])
def chat_history(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    contact_id = request.query_params.get("contact_id", "").strip()
    if not employee_id or not contact_id:
        return Response(
            {"success": False, "error": "employee_id and contact_id are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    messages = ChatMessage.objects(
        __raw__={
            "$or": [
                {"sender_id": employee_id, "recipient_id": contact_id},
                {"sender_id": contact_id, "recipient_id": employee_id},
            ]
        }
    ).order_by("created_at")
    cleared_at = get_chat_cleared_at(employee_id, contact_id)
    if cleared_at:
        messages = [message for message in messages if message.created_at > cleared_at]

    ChatMessage.objects(
        sender_id=contact_id, recipient_id=employee_id, is_read=False
    ).update(set__is_read=True)
    return Response({"success": True, "messages": [chat_payload(m) for m in messages]})


@api_view(["DELETE"])
def chat_history_clear(request):
    employee_id = request.data.get("employee_id", "").strip()
    contact_id = request.data.get("contact_id", "").strip()
    if not employee_id or not contact_id:
        return Response(
            {"success": False, "error": "employee_id and contact_id are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    employee = find_employee(employee_id)
    contact = find_employee(contact_id)
    if not employee or not contact:
        return Response(
            {"success": False, "error": "Employee or contact not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    now = datetime.now(pytz.UTC)
    existing = ChatClearState.objects(
        employee_id=employee_id, contact_id=contact_id
    ).first()
    if existing:
        existing.cleared_at = now
        existing.save()
    else:
        ChatClearState(
            employee_id=employee_id,
            contact_id=contact_id,
            cleared_at=now,
        ).save()
    return Response({"success": True})


@api_view(["POST"])
def chat_message_send(request):
    sender_id = request.data.get("sender_id", "").strip()
    recipient_id = request.data.get("recipient_id", "").strip()
    text = request.data.get("message", "").strip()

    if not all([sender_id, recipient_id, text]):
        return Response(
            {
                "success": False,
                "error": "sender_id, recipient_id, and message are required",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    sender = find_employee(sender_id)
    recipient = find_employee(recipient_id)
    if not sender or not recipient:
        return Response(
            {"success": False, "error": "Sender or recipient not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    msg = ChatMessage(
        sender_id=sender.employee_id,
        sender_name=sender.name,
        sender_role=sender.role,
        recipient_id=recipient.employee_id,
        recipient_name=recipient.name,
        message=text,
        created_at=datetime.now(pytz.UTC),
    )
    msg.save()
    saved = ChatMessage.objects(id=msg.id).first()
    payload = chat_payload(saved or msg)
    broadcast_direct_chat_event("message", payload)
    return Response({"success": True, "message": payload})


@api_view(["PATCH", "DELETE"])
def chat_message_detail(request, message_id):
    employee_id = request.data.get("employee_id", "").strip()
    msg = ChatMessage.objects(id=message_id).first()
    if not msg:
        return Response(
            {"success": False, "error": "Message not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    if msg.sender_id != employee_id:
        return Response(
            {"success": False, "error": "You can only change your own messages"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "DELETE":
        msg.is_deleted = True
        msg.message = "This message was deleted"
        msg.save()
        return Response({"success": True, "message": chat_payload(msg)})

    new_text = request.data.get("message", "").strip()
    if not new_text:
        return Response(
            {"success": False, "error": "Message text is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    msg.message = new_text
    msg.is_edited = True
    msg.save()
    return Response({"success": True, "message": chat_payload(msg)})


@api_view(["POST"])
def chat_message_react(request, message_id):
    employee_id = request.data.get("employee_id", "").strip()
    emoji = request.data.get("emoji", "").strip()
    msg = ChatMessage.objects(id=message_id).first()
    if not msg:
        return Response(
            {"success": False, "error": "Message not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    if employee_id not in {msg.sender_id, msg.recipient_id}:
        return Response(
            {"success": False, "error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN
        )
    if not emoji:
        return Response(
            {"success": False, "error": "Emoji is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    reactions = getattr(msg, "reactions", {}) or {}
    users = list(reactions.get(emoji, []))
    if employee_id in users:
        users.remove(employee_id)
    else:
        users.append(employee_id)
    if users:
        reactions[emoji] = users
    elif emoji in reactions:
        del reactions[emoji]

    msg.reactions = reactions
    msg.save()
    return Response({"success": True, "message": chat_payload(msg)})


# ─── Create Group ────────────────────────────────────────────────────────────────


@api_view(["GET"])
def list_groups(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if employee.role in ("admin", "hr"):
        groups = ChatGroup.objects().order_by("-created_at")
    else:
        groups = ChatGroup.objects(members=employee_id).order_by("-created_at")

    return Response(
        {"success": True, "groups": [group_payload(group) for group in groups]}
    )


@api_view(["POST"])
def create_group(request):

    employee_id = request.data.get("employee_id")

    admin = Employee.objects(employee_id=employee_id).first()

    if not admin:
        return Response({"error": "User not found"}, status=404)

    if admin.role not in ["admin", "hr"]:
        return Response({"error": "Only admin/hr can create group"}, status=403)

    group_name = str(request.data.get("group_name", "")).strip()
    if not group_name:
        return Response(
            {"success": False, "error": "group_name is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    members = list(request.data.get("members", []) or [])
    if employee_id not in members:
        members.append(employee_id)

    group = ChatGroup(group_name=group_name, created_by=employee_id, members=members)

    group.save()

    return Response({"success": True, "group": group_payload(group)})


@api_view(["GET"])
def group_history(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    group_id = request.query_params.get("group_id", "").strip()

    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    group = ChatGroup.objects(id=group_id).first()
    if not group:
        return Response(
            {"success": False, "error": "Group not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not can_access_group(employee, group):
        return Response(
            {"success": False, "error": "Access denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    mark_group_messages_read(group, employee_id)
    messages = GroupMessage.objects(group_id=group_id).order_by("created_at")
    cleared_at = get_group_cleared_at(employee_id, group_id)
    if cleared_at:
        messages = [message for message in messages if message.created_at > cleared_at]
    return Response(
        {
            "success": True,
            "group": group_payload(group),
            "messages": [
                group_message_payload(message, group) for message in messages
            ],
        }
    )


@api_view(["DELETE"])
def group_chat_history_clear(request):
    employee_id = str(request.data.get("employee_id", "")).strip()
    group_id = str(request.data.get("group_id", "")).strip()
    if not employee_id or not group_id:
        return Response(
            {"success": False, "error": "employee_id and group_id are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    employee = find_employee(employee_id)
    group = ChatGroup.objects(id=group_id).first()
    if not employee or not group:
        return Response(
            {"success": False, "error": "Employee or group not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not can_access_group(employee, group):
        return Response(
            {"success": False, "error": "Access denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    now = datetime.now(pytz.UTC)
    existing = GroupChatClearState.objects(
        employee_id=employee_id, group_id=group_id
    ).first()
    if existing:
        existing.cleared_at = now
        existing.save()
    else:
        GroupChatClearState(
            employee_id=employee_id,
            group_id=group_id,
            cleared_at=now,
        ).save()
    return Response({"success": True})


@api_view(["POST"])
def group_message_send(request):
    sender_id = str(request.data.get("sender_id", "")).strip()
    group_id = str(request.data.get("group_id", "")).strip()
    text = str(request.data.get("message", "")).strip()

    if not all([sender_id, group_id, text]):
        return Response(
            {
                "success": False,
                "error": "sender_id, group_id, and message are required",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    sender = find_employee(sender_id)
    group = ChatGroup.objects(id=group_id).first()
    if not sender or not group:
        return Response(
            {"success": False, "error": "Sender or group not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if not can_access_group(sender, group):
        return Response(
            {"success": False, "error": "Access denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    message = GroupMessage(
        group_id=group_id,
        sender_id=sender.employee_id,
        sender_name=sender.name,
        message=text,
        created_at=datetime.now(pytz.UTC),
    )
    message.save()
    group = ChatGroup.objects(id=group_id).first()
    payload = group_message_payload(message, group)
    broadcast_group_event(group_id, "message", payload)
    return Response({"success": True, "message": payload})


@api_view(["GET"])
def chat_unread_count(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )
    counts = count_unread_messages(employee)
    return Response({"success": True, **counts})


@api_view(["GET"])
def dashboard_notifications(request):
    from attendance.models import AttendanceRecord

    employee_id = request.query_params.get("employee_id", "").strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    notifications = []
    counts = count_unread_messages(employee)

    for contact in counts.get("direct_contacts", []):
        sender_id = contact.get("employee_id", "")
        unread = int(contact.get("unread", 0) or 0)
        if unread <= 0:
            continue
        notifications.append(
            {
                "id": f"chat-direct-{sender_id}",
                "type": "message",
                "title": contact.get("name") or sender_id,
                "message": f"You have {unread} unread message{'s' if unread != 1 else ''}.",
                "contact_id": sender_id,
                "time": "",
            }
        )

    for group in counts.get("group_unread", []):
        unread = int(group.get("unread", 0) or 0)
        if unread <= 0:
            continue
        group_id = group.get("group_id", "")
        notifications.append(
            {
                "id": f"chat-group-{group_id}",
                "type": "group_message",
                "title": group.get("group_name") or "Group chat",
                "message": f"{unread} unread group message{'s' if unread != 1 else ''}.",
                "group_id": group_id,
                "time": "",
            }
        )

    if employee.role in ("admin", "hr"):
        pending = AttendanceRecord.objects(status="leave_pending").order_by("-date")
        for record in pending[:20]:
            notifications.append(
                {
                    "id": f"leave-req-{record.id}",
                    "type": "leave_request",
                    "title": record.employee_name or record.employee_id,
                    "message": f"{getattr(record, 'leave_type', 'casual') or 'casual'} leave on {record.date}: {record.reason or 'No reason'}",
                    "contact_id": record.employee_id,
                    "time": record.date,
                }
            )
    else:
        leave_rows = AttendanceRecord.objects(
            employee_id=employee.employee_id,
            status__in=["leave_pending", "leave_approved", "leave_rejected"],
        ).order_by("-date")[:10]
        for record in leave_rows:
            status_label = str(record.status or "").replace("leave_", "")
            notifications.append(
                {
                    "id": f"leave-status-{record.id}",
                    "type": "leave_status",
                    "title": f"Leave {status_label}",
                    "message": f"{getattr(record, 'leave_type', 'casual') or 'casual'} leave on {record.date}: {record.reason or 'No reason'}",
                    "time": record.date,
                }
            )

    return Response({"success": True, "notifications": notifications})


@api_view(["PATCH"])
def update_group(request, group_id):
    admin_id = str(request.data.get("employee_id", "")).strip()
    admin = find_employee(admin_id)
    if not admin or not can_manage_group(admin):
        return Response(
            {"success": False, "error": "Access denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    group = ChatGroup.objects(id=group_id).first()
    if not group:
        return Response(
            {"success": False, "error": "Group not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    group_name = request.data.get("group_name")
    if group_name is not None:
        cleaned = str(group_name).strip()
        if cleaned:
            group.group_name = cleaned

    image = request.data.get("group_img", request.data.get("image", ""))
    if image:
        try:
            group.group_img = save_base64_group_image(str(image).strip())
        except Exception as exc:
            return Response(
                {"success": False, "error": f"Could not save group photo: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    group.save()
    return Response({"success": True, "group": group_payload(group)})


@api_view(["PATCH", "DELETE"])
def group_message_detail(request, message_id):
    employee_id = str(request.data.get("employee_id", "")).strip()
    employee = find_employee(employee_id)
    if not employee:
        return Response(
            {"success": False, "error": "Employee not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    message = GroupMessage.objects(id=message_id).first()
    if not message:
        return Response(
            {"success": False, "error": "Message not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    group = ChatGroup.objects(id=message.group_id).first()
    if not group or not can_access_group(employee, group):
        return Response(
            {"success": False, "error": "Access denied"},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == "DELETE":
        if message.sender_id != employee_id:
            return Response(
                {"success": False, "error": "Only sender can delete"},
                status=status.HTTP_403_FORBIDDEN,
            )
        message.message = "This message was deleted"
        message.is_deleted = True
        message.save()
        return Response(
            {"success": True, "message": group_message_payload(message, group)}
        )

    if message.sender_id != employee_id:
        return Response(
            {"success": False, "error": "Only sender can edit"},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_text = str(request.data.get("message", "")).strip()
    if not new_text:
        return Response(
            {"success": False, "error": "message is required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    message.message = new_text
    message.is_edited = True
    message.save()
    return Response(
        {"success": True, "message": group_message_payload(message, group)}
    )


@api_view(["POST"])
def add_group_member(request):
    admin_id = request.data.get("employee_id")
    group_id = request.data.get("group_id")
    member_id = request.data.get("member_id")

    admin = Employee.objects(employee_id=admin_id).first()

    if admin.role not in ["admin", "hr"]:
        return Response({"error": "Access denied"}, status=403)

    group = ChatGroup.objects(id=group_id).first()

    if not group:
        return Response({"error": "Group not found"}, status=404)

    system_message = None
    if member_id not in group.members:
        group.members.append(member_id)
        group.save()
        member = Employee.objects(employee_id=member_id).first()
        member_name = member.name if member else member_id
        sys_msg = create_system_group_message(
            str(group.id),
            f"{admin.name} added {member_name} to the group",
        )
        group = ChatGroup.objects(id=group_id).first()
        system_message = group_message_payload(sys_msg, group)
        broadcast_group_event(str(group.id), "message", system_message)
        broadcast_employee_event(
            member_id,
            {
                "type": "group_added",
                "group": group_payload(group),
                "message": f"{admin.name} added you to {group.group_name}",
            },
        )

    return Response(
        {
            "success": True,
            "group": group_payload(group),
            "system_message": system_message,
        }
    )


@api_view(["POST"])
def remove_group_member(request):

    admin_id = request.data.get("employee_id")

    group_id = request.data.get("group_id")

    member_id = request.data.get("member_id")

    admin = Employee.objects(employee_id=admin_id).first()

    if admin.role not in ["admin", "hr"]:
        return Response({"error": "Access denied"}, status=403)

    group = ChatGroup.objects(id=group_id).first()

    if not group:
        return Response({"error": "Group not found"}, status=404)

    system_message = None
    if member_id in group.members:
        group.members.remove(member_id)
        group.save()
        member = Employee.objects(employee_id=member_id).first()
        member_name = member.name if member else member_id
        sys_msg = create_system_group_message(
            str(group.id),
            f"{admin.name} removed {member_name} from the group",
        )
        group = ChatGroup.objects(id=group_id).first()
        system_message = group_message_payload(sys_msg, group)
        broadcast_group_event(str(group.id), "message", system_message)

    return Response(
        {
            "success": True,
            "group": group_payload(group),
            "system_message": system_message,
        }
    )


@api_view(["DELETE"])
def delete_group(request, group_id):

    admin_id = request.data.get("employee_id")

    admin = Employee.objects(employee_id=admin_id).first()

    if admin.role not in ["admin", "hr"]:
        return Response({"error": "Access denied"}, status=403)

    group = ChatGroup.objects(id=group_id).first()

    if not group:
        return Response({"error": "Group not found"}, status=404)

    group.delete()
    GroupMessage.objects(group_id=group_id).delete()

    return Response({"success": True})
