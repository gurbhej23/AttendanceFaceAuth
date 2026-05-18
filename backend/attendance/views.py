import os

from rest_framework import status
from employees.models import Employee
from attendance.models import AttendanceRecord
from datetime import datetime, timedelta

import pytz
from rest_framework.decorators import api_view
from employees.face_utils import extract_and_save_embedding, verify_face_match
from rest_framework.response import Response

IST = pytz.timezone("Asia/Kolkata")
TEMP_DIR = "media/temp"
ATTENDANCE_START_HOUR = 10
ATTENDANCE_START_MINUTE = 0

os.makedirs(TEMP_DIR, exist_ok=True)

THRESHOLD = 0.35


def media_url(path):
    if not path:
        return ""
    normalized = path.replace("\\", "/")
    if normalized.startswith("/media/"):
        return normalized
    if normalized.startswith("media/"):
        return f"/{normalized}"
    return f"/media/{normalized.lstrip('/')}"


def current_ist():
    return datetime.now(IST)


def today_ist():
    return current_ist().strftime("%Y-%m-%d")


def attendance_start_time(now=None):
    now = now or current_ist()
    return now.replace(
        hour=ATTENDANCE_START_HOUR,
        minute=ATTENDANCE_START_MINUTE,
    )


def is_before_attendance_start(now=None):
    now = now or current_ist()
    return now < attendance_start_time(now)


def attendance_start_message():
    return "Attendance starts at 10:00 AM. You cannot mark attendance before that."


def as_ist(value):
    if not value:
        return None
    if value.tzinfo is None:
        return IST.localize(value)
    return value.astimezone(IST)


def format_time(value):
    value = as_ist(value)
    return value.strftime("%I:%M %p") if value else "--"


def format_duration(minutes):
    if minutes is None or minutes <= 0:
        return "--"

    hours = minutes // 60
    mins = minutes % 60

    return f"{hours}h {mins}m"


@api_view(["POST"])
def verify_face(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        image = request.data.get("image", "").strip()

        print(f"Face verification attempt: {employee_id}")

        if not employee_id or not image:
            return Response(
                {"success": False, "error": "Employee ID and image required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if is_before_attendance_start():
            return Response(
                {"success": False, "error": attendance_start_message()},
                status=status.HTTP_403_FORBIDDEN,
            )

        uploaded_embedding, error, _ = extract_and_save_embedding(image, employee_id)
        if error:
            return Response(
                {"success": False, "error": error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_match = verify_face_match(uploaded_embedding, employee.face_embedding)
        if not is_match:
            return Response(
                {"success": False, "error": "Face does not match. Access denied."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(
            {
                "success": True,
                "message": "Face verified",
                "employee_id": employee_id,
                "employee_name": employee.name,
                "profile_img": media_url(employee.profile_img or employee.photo_path or ""),
                "cv_file": media_url(employee.cv_file or ""),
            }
        )

    except Exception as e:
        print(f"Face verification error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def check_in_face(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        image = request.data.get("image", "").strip()

        print(f"👤 Check-in attempt: {employee_id}")

        if not employee_id or not image:
            return Response(
                {"success": False, "error": "Employee ID and image required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get employee
        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Extract embedding from uploaded image
        print(f"🔍 Extracting embedding...")
        uploaded_embedding, error, check_in_image_path = extract_and_save_embedding(
            image, employee_id
        )
        if error:
            print(f"❌ Embedding error: {error}")
            return Response(
                {"success": False, "error": error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify face matches stored embedding
        print(f"📏 Comparing embeddings...")
        is_match = verify_face_match(uploaded_embedding, employee.face_embedding)
        if not is_match:
            print(f"❌ Face mismatch")
            return Response(
                {
                    "success": False,
                    "error": "❌ Face does not match. Access denied.",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Get current time
        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        # Check if already checked in today
        existing = AttendanceRecord.objects(
            employee_id=employee_id,
            date=today,
            check_in_time__ne=None,
        ).first()

        if existing and not existing.check_out_time:
            return Response(
                {
                    "success": True,
                    "message": f"⚠️ Already checked in at {existing.check_in_time.strftime('%H:%M')}",
                    "already_checked_in": True,
                }
            )

        # Determine status (on-time vs late)
        EXPECTED_START_HOUR = 9
        EXPECTED_START_MIN = 0
        GRACE_PERIOD_MIN = 15

        expected_time = now.replace(hour=EXPECTED_START_HOUR, minute=EXPECTED_START_MIN)
        grace_deadline = expected_time + timedelta(minutes=GRACE_PERIOD_MIN)

        attendance_status = "present" if now <= grace_deadline else "late"

        # Create attendance record
        record = AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=today,
            check_in_time=now,
            check_in_image=check_in_image_path,
            status=attendance_status,
            is_verified=True,
        )
        record.save()

        print(
            f"{employee_id} checked in at {now.strftime('%H:%M')} - Status: {attendance_status}"
        )

        message = f"Welcome {employee.name}! Checked in at {now.strftime('%H:%M')}"
        if attendance_status == "late":
            message += " (⚠️ Late)"

        return Response(
            {
                "success": True,
                "message": message,
                "employee_id": employee_id,
                "employee_name": employee.name,
                "status": attendance_status,
                "check_in_time": now.strftime("%H:%M"),
            }
        )

    except Exception as e:
        print(f"❌ Check-in error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# check out
@api_view(["POST"])
def check_out_face(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        image = request.data.get("image", "").strip()

        print(f"👤 Check-out attempt: {employee_id}")

        if not employee_id or not image:
            return Response(
                {"success": False, "error": "Employee ID and image required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Extract embedding from uploaded image
        print(f"🔍 Extracting embedding...")
        uploaded_embedding, error, _ = extract_and_save_embedding(image, employee_id)
        if error:
            print(f"❌ Embedding error: {error}")
            return Response(
                {"success": False, "error": error},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify face
        print(f"📏 Comparing embeddings...")
        is_match = verify_face_match(uploaded_embedding, employee.face_embedding)
        if not is_match:
            print(f"❌ Face mismatch")
            return Response(
                {"success": False, "error": "❌ Face does not match. Access denied."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Get today's record
        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        record = AttendanceRecord.objects(
            employee_id=employee_id,
            date=today,
            check_in_time__ne=None,
        ).first()

        if not record:
            return Response(
                {
                    "success": False,
                    "error": "No check-in found for today",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if record.check_out_time:
            return Response(
                {
                    "success": True,
                    "message": f"⚠️ Already checked out at {record.check_out_time.strftime('%H:%M')}",
                    "already_checked_out": True,
                }
            )

        # Calculate duration from the actual check-in time to the current checkout time.
        # Calculate duration
        check_in = record.check_in_time

        if check_in.tzinfo is None:
            check_in = IST.localize(check_in)

        duration = int((now - check_in).total_seconds() / 60)

        if duration < 0:
            duration = 0

        # SAVE CHECK OUT
        record.check_out_time = now
        record.duration_minutes = duration

        record.save()

        hours = duration // 60
        minutes = duration % 60

        print(
            f"{employee_id} checked out at {now.strftime('%H:%M')} - Duration: {hours}h {minutes}m"
        )

        return Response(
            {
                "success": True,
                "message": f"Goodbye {employee.name}! Worked for {hours}h {minutes}m",
                "employee_id": employee_id,
                "employee_name": employee.name,
                "check_out_time": format_time(now),
                "duration": format_duration(duration),
            }
        )

    except Exception as e:
        print(f"❌ Check-out error: {str(e)}")
        import traceback

        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# attendance
@api_view(["GET"])
def attendance_report(request):
    """
    Get attendance records for a date.
    """
    try:
        date = request.query_params.get("date", today_ist())
        employee_id = request.query_params.get("employee_id")

        query = AttendanceRecord.objects(date=date)
        if employee_id:
            query = query.filter(employee_id=employee_id)

        records = []
        for r in query:
            employee = Employee.objects(employee_id=r.employee_id).first()
            records.append(
                {
                    "employee_id": r.employee_id,
                    "employee_name": r.employee_name,
                    "date": r.date,
                    "check_in": format_time(r.check_in_time),
                    "check_out": format_time(r.check_out_time),
                    "duration": format_duration(r.duration_minutes),
                    "status": r.status,
                    "reason": getattr(r, "reason", None) or "--",
                    "half_day_until": getattr(r, "half_day_until", None) or "--",
                    "profile_img": media_url(
                        (employee.profile_img or employee.photo_path)
                        if employee
                        else ""
                    ),
                    "cv_file": media_url(employee.cv_file if employee else ""),
                }
            )

        return Response(
            {
                "success": True,
                "date": date,
                "total_employees": len(records),
                "records": records,
            }
        )

    except Exception as e:
        print(f"❌ Report error: {str(e)}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["GET"])
def admin_attendance_sheet(request):
    try:
        date = request.query_params.get("date", today_ist())
        employees = Employee.objects(is_active=True, role__ne="admin").order_by(
            "employee_id"
        )
        attendance_records = AttendanceRecord.objects(date=date)
        records_by_employee_id = {
            record.employee_id: record for record in attendance_records
        }

        rows = []
        present_count = 0
        absent_count = 0
        half_day_count = 0
        not_marked_count = 0

        for index, employee in enumerate(employees, start=1):
            record = records_by_employee_id.get(employee.employee_id)

            if not record:
                sheet_status = "not_marked"
                not_marked_count += 1
                check_in = "--"
                check_out = "--"
                duration = "--"
                reason = "--"
                half_day_until = "--"
            else:
                sheet_status = record.status or "not_marked"
                if sheet_status in ["present", "late"]:
                    present_count += 1
                elif sheet_status == "half_day":
                    half_day_count += 1
                elif sheet_status in ["absent", "leave"]:
                    absent_count += 1
                else:
                    not_marked_count += 1

                check_in = format_time(record.check_in_time)
                check_out = format_time(record.check_out_time)
                duration = format_duration(record.duration_minutes)
                reason = getattr(record, "reason", None) or "--"
                half_day = getattr(record, "half_day_until", None) or "--"
                if sheet_status == "half_day" and half_day != "--":
                    reason = f"{reason}"

            rows.append(
                {
                    "serial_no": index,
                    "employee_id": employee.employee_id,
                    "employee_name": employee.name,
                    "email": employee.email,
                    "department": employee.department,
                    "designation": employee.designation,
                    "profile_img": media_url(employee.profile_img or employee.photo_path or ""),
                    "cv_file": media_url(employee.cv_file or ""),
                    "date": date,
                    "status": sheet_status,
                    "check_in": check_in,
                    "check_out": check_out,
                    "duration": duration,
                    "reason": reason,
                    "half_day": half_day,
                    "half_day_until": half_day,
                }
            )

        return Response(
            {
                "success": True,
                "sheet_name": f"Attendance Sheet - {date}",
                "date": date,
                "total_employees": len(rows),
                "present_count": present_count,
                "absent_count": absent_count,
                "leave_count": absent_count,
                "half_day_count": half_day_count,
                "not_marked_count": not_marked_count,
                "records": rows,
            }
        )

    except Exception as e:
        print(f"Admin attendance sheet error: {str(e)}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# mark absent
@api_view(["POST"])
def mark_absent(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        reason = request.data.get("reason", "").strip()

        print(f"📋 Marking leave: {employee_id}")

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        if is_before_attendance_start(now):
            return Response(
                {"success": False, "error": attendance_start_message()},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not reason:
            return Response(
                {"success": False, "error": "Reason is required for absence"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = AttendanceRecord.objects(
            employee_id=employee_id,
            date=today,
        ).first()

        if existing:
            return Response(
                {"success": False, "error": "Attendance already marked for today"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record = AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=today,
            status="absent",
            reason=reason,
        )
        record.save()

        print(f"{employee_id} marked absent")

        return Response(
            {
                "success": True,
                "message": "Marked as absent",
            }
        )

    except Exception as e:
        print(f"❌ Mark leave error: {str(e)}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(["POST"])
def mark_half_day(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        reason = request.data.get("reason", "").strip()
        half_day_until = request.data.get("half_day_until", "").strip()

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()

        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=404,
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        # remove old today's record if exists
        AttendanceRecord.objects(employee_id=employee_id, date=today).delete()

        # convert HH:MM
        hour, minute = map(int, half_day_until.split(":"))

        check_out_dt = now.replace(
            hour=hour,
            minute=minute,
            second=0,
            microsecond=0,
        )

        duration = int((check_out_dt - now).total_seconds() / 60)

        if duration < 0:
            duration = 0

        record = AttendanceRecord(
            employee_id=employee.employee_id,
            employee_name=employee.name,
            date=today,
            check_in_time=now,
            check_out_time=check_out_dt,
            duration_minutes=duration,
            status="half_day",
            reason=reason,
            half_day_until=half_day_until,
        )

        record.save()

        print(record.to_json())

        return Response(
            {
                "success": True,
                "message": "Half day marked",
                "check_in": format_time(now),
                "check_out": format_time(check_out_dt),
                "duration": format_duration(duration),
                "status": "half_day",
            }
        )

    except Exception as e:
        print(str(e))
        return Response(
            {"success": False, "error": str(e)},
            status=500,
        )


# mark present
@api_view(["POST"])
def mark_present(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()

        print(f"📋 Marking present: {employee_id}")

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        if is_before_attendance_start(now):
            return Response(
                {"success": False, "error": attendance_start_message()},
                status=status.HTTP_403_FORBIDDEN,
            )

        existing = AttendanceRecord.objects(employee_id=employee_id, date=today).first()
        if existing:
            return Response({"success": True, "message": "⚠️ Already marked for today"})

        record = AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=today,
            check_in_time=now,
            status="present",
        )
        record.save()

        print(f" {employee_id} marked present")

        return Response(
            {
                "success": True,
                "message": "Marked as present",
            }
        )

    except Exception as e:
        print(f"❌ Mark present error: {str(e)}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# resign
@api_view(["POST"])
def resign_employee(request):
    """
    Deactivate employee account.
    """
    try:
        employee_id = request.data.get("employee_id", "").strip()

        print(f"🚪 Resign: {employee_id}")

        employee = Employee.objects(employee_id=employee_id).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        employee.is_active = False
        employee.save()

        print(f"{employee_id} resigned")

        return Response(
            {
                "success": True,
                "message": "Employee resigned successfully",
            }
        )

    except Exception as e:
        print(f"❌ Resign error: {str(e)}")
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
