import csv
import os
from rest_framework import status
from employees.models import Employee
from attendance.models import AttendanceRecord
from datetime import datetime, timedelta
from django.http import HttpResponse

import pytz
from rest_framework.decorators import api_view
from employees.face_utils import extract_and_save_embedding, verify_face_match
from rest_framework.response import Response

IST = pytz.timezone("Asia/Kolkata")
TEMP_DIR = "media/temp"
ATTENDANCE_START_HOUR = 9
ATTENDANCE_START_MINUTE = 0
LATE_GRACE_MINUTES = 15  # grace period before marking late

os.makedirs(TEMP_DIR, exist_ok=True)

FACE_MATCH_THRESHOLD = 0.62


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
    return now.replace(hour=ATTENDANCE_START_HOUR, minute=ATTENDANCE_START_MINUTE)


def is_before_attendance_start(now=None):
    now = now or current_ist()
    return now < attendance_start_time(now)


def attendance_start_message():
    return "Attendance starts at 9:00 AM. You cannot mark attendance before that."


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


# ─── Face Verify ──────────────────────────────────────────────────────────────


@api_view(["POST"])
def verify_face(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        image = request.data.get("image", "").strip()

        if not employee_id or not image:
            return Response(
                {"success": False, "error": "Employee ID and image required"},
                status=400,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        if is_before_attendance_start():
            return Response(
                {"success": False, "error": attendance_start_message()}, status=403
            )

        uploaded_embedding, error, _ = extract_and_save_embedding(image, employee_id)
        if error:
            return Response({"success": False, "error": error}, status=400)

        is_match = verify_face_match(
            uploaded_embedding, employee.face_embedding, FACE_MATCH_THRESHOLD
        )
        if not is_match:
            return Response(
                {"success": False, "error": "Face does not match. Access denied."},
                status=401,
            )

        return Response(
            {
                "success": True,
                "message": "Face verified",
                "employee_id": employee_id,
                "employee_name": employee.name,
                "profile_img": media_url(
                    employee.profile_img or employee.photo_path or ""
                ),
                "cv_file": media_url(employee.cv_file or ""),
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Check In ────────────────────────────────────────────────────────────────


@api_view(["POST"])
def check_in_face(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        image = request.data.get("image", "").strip()

        if not employee_id or not image:
            return Response(
                {"success": False, "error": "Employee ID and image required"},
                status=400,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        uploaded_embedding, error, check_in_image_path = extract_and_save_embedding(
            image, employee_id
        )
        if error:
            return Response({"success": False, "error": error}, status=400)

        is_match = verify_face_match(
            uploaded_embedding, employee.face_embedding, FACE_MATCH_THRESHOLD
        )
        if not is_match:
            return Response(
                {"success": False, "error": "❌ Face does not match. Access denied."},
                status=401,
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        existing = AttendanceRecord.objects(
            employee_id=employee_id, date=today, check_in_time__ne=None
        ).first()
        if existing and not existing.check_out_time:
            return Response(
                {
                    "success": True,
                    "message": f"⚠️ Already checked in at {existing.check_in_time.strftime('%H:%M')}",
                    "already_checked_in": True,
                }
            )

        # Determine late status
        expected_time = now.replace(
            hour=ATTENDANCE_START_HOUR, minute=ATTENDANCE_START_MINUTE
        )
        grace_deadline = expected_time + timedelta(minutes=LATE_GRACE_MINUTES)
        attendance_status = "present" if now <= grace_deadline else "late"

        minutes_late = 0
        if attendance_status == "late":
            minutes_late = int((now - grace_deadline).total_seconds() / 60)

        record = AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=today,
            check_in_time=now,
            check_in_image=check_in_image_path,
            status=attendance_status,
            minutes_late=minutes_late,
            is_verified=True,
        )
        record.save()

        message = f"Welcome {employee.name}! Checked in at {now.strftime('%H:%M')}"
        if attendance_status == "late":
            message += f" (⚠️ {minutes_late} mins late)"

        return Response(
            {
                "success": True,
                "message": message,
                "employee_id": employee_id,
                "employee_name": employee.name,
                "status": attendance_status,
                "check_in_time": now.strftime("%H:%M"),
                "is_late": attendance_status == "late",
                "minutes_late": minutes_late,
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Check Out ───────────────────────────────────────────────────────────────


@api_view(["POST"])
def check_out_face(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        image = request.data.get("image", "").strip()

        if not employee_id or not image:
            return Response(
                {"success": False, "error": "Employee ID and image required"},
                status=400,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        uploaded_embedding, error, _ = extract_and_save_embedding(image, employee_id)
        if error:
            return Response({"success": False, "error": error}, status=400)

        is_match = verify_face_match(
            uploaded_embedding, employee.face_embedding, FACE_MATCH_THRESHOLD
        )
        if not is_match:
            return Response(
                {"success": False, "error": "❌ Face does not match. Access denied."},
                status=401,
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        record = AttendanceRecord.objects(
            employee_id=employee_id, date=today, check_in_time__ne=None
        ).first()
        if not record:
            return Response(
                {"success": False, "error": "No check-in found for today"}, status=400
            )

        if record.check_out_time:
            return Response(
                {
                    "success": True,
                    "message": f"⚠️ Already checked out at {record.check_out_time.strftime('%H:%M')}",
                    "already_checked_out": True,
                }
            )

        check_in = record.check_in_time
        if check_in.tzinfo is None:
            check_in = IST.localize(check_in)

        duration = max(0, int((now - check_in).total_seconds() / 60))
        record.check_out_time = now
        record.duration_minutes = duration
        record.save()

        hours = duration // 60
        minutes = duration % 60

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
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Attendance Report (Employee Dashboard) ───────────────────────────────────


@api_view(["GET"])
def attendance_report(request):
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
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Monthly Attendance Summary ───────────────────────────────────────────────


@api_view(["GET"])
def monthly_summary(request):
    """
    Returns monthly attendance summary for an employee.
    Params: employee_id, year, month
    """
    try:
        employee_id = request.query_params.get("employee_id")
        year = int(request.query_params.get("year", current_ist().year))
        month = int(request.query_params.get("month", current_ist().month))

        if not employee_id:
            return Response(
                {"success": False, "error": "employee_id required"}, status=400
            )

        # Get all records for the month
        prefix = f"{year}-{str(month).zfill(2)}"
        records = AttendanceRecord.objects(
            employee_id=employee_id, date__startswith=prefix
        )

        counts = {"present": 0, "late": 0, "absent": 0, "half_day": 0, "leave": 0}
        total_minutes = 0
        late_details = []

        for r in records:
            s = (r.status or "").lower()
            if s in ("present",):
                counts["present"] += 1
            elif s == "late":
                counts["late"] += 1
                late_details.append(
                    {
                        "date": r.date,
                        "check_in": format_time(r.check_in_time),
                        "minutes_late": getattr(r, "minutes_late", 0) or 0,
                    }
                )
            elif s == "absent":
                counts["absent"] += 1
            elif s in ("half_day", "half day"):
                counts["half_day"] += 1
            elif s == "leave":
                counts["leave"] += 1

            total_minutes += r.duration_minutes or 0

        total_hours = total_minutes // 60
        total_mins = total_minutes % 60

        return Response(
            {
                "success": True,
                "year": year,
                "month": month,
                "employee_id": employee_id,
                "present_count": counts["present"],
                "late_count": counts["late"],
                "absent_count": counts["absent"],
                "half_day_count": counts["half_day"],
                "leave_count": counts["leave"],
                "total_working_hours": f"{total_hours}h {total_mins}m",
                "late_details": late_details,
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Admin Attendance Sheet ───────────────────────────────────────────────────


@api_view(["GET"])
def admin_attendance_sheet(request):
    try:
        date = request.query_params.get("date", today_ist())
        department_filter = request.query_params.get("department", "")

        query = Employee.objects(is_active=True, role__ne="admin")
        if department_filter and department_filter != "all":
            query = query.filter(department=department_filter)
        employees = query.order_by("employee_id")

        attendance_records = AttendanceRecord.objects(date=date)
        records_by_id = {r.employee_id: r for r in attendance_records}

        rows = []
        present_count = absent_count = half_day_count = not_marked_count = (
            leave_count
        ) = late_count = 0

        for index, employee in enumerate(employees, start=1):
            record = records_by_id.get(employee.employee_id)

            if not record:
                sheet_status = "not_marked"
                not_marked_count += 1
                check_in = check_out = duration = reason = half_day = "--"
                minutes_late = 0
            else:
                sheet_status = record.status or "not_marked"
                if sheet_status == "present":
                    present_count += 1
                elif sheet_status == "late":
                    late_count += 1
                    present_count += 1  # late counts as present
                elif sheet_status in ("half_day", "half day"):
                    half_day_count += 1
                elif sheet_status == "absent":
                    absent_count += 1
                elif sheet_status == "leave":
                    leave_count += 1
                else:
                    not_marked_count += 1

                check_in = format_time(record.check_in_time)
                check_out = format_time(record.check_out_time)
                duration = format_duration(record.duration_minutes)
                reason = getattr(record, "reason", None) or "--"
                half_day = getattr(record, "half_day_until", None) or "--"
                minutes_late = getattr(record, "minutes_late", 0) or 0

            rows.append(
                {
                    "serial_no": index,
                    "employee_id": employee.employee_id,
                    "employee_name": employee.name,
                    "email": employee.email,
                    "department": employee.department,
                    "designation": employee.designation,
                    "profile_img": media_url(
                        employee.profile_img or employee.photo_path or ""
                    ),
                    "cv_file": media_url(employee.cv_file or ""),
                    "date": date,
                    "status": sheet_status,
                    "check_in": check_in,
                    "check_out": check_out,
                    "duration": duration,
                    "reason": reason,
                    "half_day_until": half_day,
                    "minutes_late": minutes_late,
                }
            )

        # Get all unique departments for filter dropdown
        all_departments = list(
            set(
                e.department
                for e in Employee.objects(is_active=True, role__ne="admin")
                if e.department
            )
        )
        all_departments.sort()

        return Response(
            {
                "success": True,
                "sheet_name": f"Attendance Sheet - {date}",
                "date": date,
                "total_employees": len(rows),
                "present_count": present_count,
                "absent_count": absent_count,
                "half_day_count": half_day_count,
                "not_marked_count": not_marked_count,
                "leave_count": leave_count,
                "late_count": late_count,
                "departments": all_departments,
                "records": rows,
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


@api_view(["GET"])
def export_attendance_csv(request):
    try:
        date = request.query_params.get("date", today_ist())
        department_filter = request.query_params.get("department", "")

        query = Employee.objects(is_active=True, role__ne="admin")
        if department_filter and department_filter != "all":
            query = query.filter(department=department_filter)

        attendance_records = AttendanceRecord.objects(date=date)
        records_by_id = {r.employee_id: r for r in attendance_records}

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="attendance-{date}.csv"'
        )
        writer = csv.writer(response)
        writer.writerow(
            [
                "Employee ID",
                "Name",
                "Email",
                "Department",
                "Designation",
                "Date",
                "Status",
                "Check In",
                "Check Out",
                "Duration",
                "Minutes Late",
                "Reason",
            ]
        )

        for employee in query.order_by("employee_id"):
            record = records_by_id.get(employee.employee_id)
            writer.writerow(
                [
                    employee.employee_id,
                    employee.name,
                    employee.email,
                    employee.department,
                    employee.designation,
                    date,
                    record.status if record else "not_marked",
                    format_time(record.check_in_time) if record else "--",
                    format_time(record.check_out_time) if record else "--",
                    format_duration(record.duration_minutes) if record else "--",
                    getattr(record, "minutes_late", 0) if record else 0,
                    record.reason if record and record.reason else "--",
                ]
            )

        return response

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Late Comers Report ───────────────────────────────────────────────────────


@api_view(["GET"])
def late_comers_report(request):
    """
    Returns late arrivals for a month with per-employee breakdown.
    Params: year, month, department (optional)
    """
    try:
        year = int(request.query_params.get("year", current_ist().year))
        month = int(request.query_params.get("month", current_ist().month))
        department_filter = request.query_params.get("department", "")

        prefix = f"{year}-{str(month).zfill(2)}"
        late_records = AttendanceRecord.objects(date__startswith=prefix, status="late")

        # Group by employee
        emp_map = {}
        for r in late_records:
            eid = r.employee_id
            if eid not in emp_map:
                emp = Employee.objects(employee_id=eid).first()
                if not emp:
                    continue
                if (
                    department_filter
                    and department_filter != "all"
                    and emp.department != department_filter
                ):
                    continue
                emp_map[eid] = {
                    "employee_id": eid,
                    "employee_name": r.employee_name,
                    "department": emp.department if emp else "--",
                    "designation": emp.designation if emp else "--",
                    "profile_img": (
                        media_url(emp.profile_img or emp.photo_path or "")
                        if emp
                        else ""
                    ),
                    "late_count": 0,
                    "total_minutes_late": 0,
                    "late_days": [],
                }
            emp_map[eid]["late_count"] += 1
            mins_late = getattr(r, "minutes_late", 0) or 0
            emp_map[eid]["total_minutes_late"] += mins_late
            emp_map[eid]["late_days"].append(
                {
                    "date": r.date,
                    "check_in": format_time(r.check_in_time),
                    "minutes_late": mins_late,
                }
            )

        # Sort by late count desc
        result = sorted(emp_map.values(), key=lambda x: x["late_count"], reverse=True)

        # All departments for filter
        all_departments = list(
            set(
                e.department
                for e in Employee.objects(is_active=True, role__ne="admin")
                if e.department
            )
        )
        all_departments.sort()

        return Response(
            {
                "success": True,
                "year": year,
                "month": month,
                "total_late_employees": len(result),
                "departments": all_departments,
                "records": result,
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Leave Requests (Employee) ────────────────────────────────────────────────


@api_view(["POST"])
def request_leave(request):
    """
    Employee requests leave. Requires admin approval.
    Required: employee_id, reason, leave_date (YYYY-MM-DD), leave_type
    """
    try:
        employee_id = request.data.get("employee_id", "").strip()
        reason = request.data.get("reason", "").strip()
        leave_date = request.data.get("leave_date", "").strip()
        leave_type = request.data.get("leave_type", "casual").strip()

        if not all([employee_id, reason, leave_date]):
            return Response(
                {
                    "success": False,
                    "error": "employee_id, reason, and leave_date are required",
                },
                status=400,
            )

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        # Check if already applied for this date
        existing = AttendanceRecord.objects(
            employee_id=employee_id, date=leave_date
        ).first()
        if existing:
            return Response(
                {"success": False, "error": "Attendance already marked for this date"},
                status=400,
            )

        record = AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=leave_date,
            status="leave_pending",  # pending approval
            reason=reason,
            leave_type=leave_type,
        )
        record.save()

        return Response(
            {
                "success": True,
                "message": f"Leave requested for {leave_date}. Awaiting admin approval.",
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


@api_view(["GET"])
def my_leave_requests(request):
    """Employee's own leave requests."""
    try:
        employee_id = request.query_params.get("employee_id")
        if not employee_id:
            return Response(
                {"success": False, "error": "employee_id required"}, status=400
            )

        records = AttendanceRecord.objects(
            employee_id=employee_id,
            status__in=["leave_pending", "leave_approved", "leave_rejected", "leave"],
        ).order_by("-date")

        data = [
            {
                "date": r.date,
                "status": r.status,
                "reason": r.reason or "--",
                "leave_type": getattr(r, "leave_type", "") or "casual",
            }
            for r in records
        ]

        return Response({"success": True, "records": data})

    except Exception as e:
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Leave Management (Admin) ─────────────────────────────────────────────────


@api_view(["GET"])
def admin_leave_requests(request):
    """All pending + recent leave requests for admin."""
    try:
        status_filter = request.query_params.get("status", "leave_pending")

        if status_filter == "all":
            records = AttendanceRecord.objects(
                status__in=["leave_pending", "leave_approved", "leave_rejected"]
            ).order_by("-date")
        else:
            records = AttendanceRecord.objects(status=status_filter).order_by("-date")

        data = []
        for r in records:
            emp = Employee.objects(employee_id=r.employee_id).first()
            data.append(
                {
                    "id": str(r.id),
                    "employee_id": r.employee_id,
                    "employee_name": r.employee_name,
                    "department": emp.department if emp else "--",
                    "designation": emp.designation if emp else "--",
                    "profile_img": (
                        media_url(emp.profile_img or emp.photo_path or "")
                        if emp
                        else ""
                    ),
                    "date": r.date,
                    "status": r.status,
                    "reason": r.reason or "--",
                    "leave_type": getattr(r, "leave_type", "") or "casual",
                }
            )

        return Response({"success": True, "records": data, "total": len(data)})

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


@api_view(["POST"])
def approve_leave(request):
    """Admin approves a leave request."""
    try:
        record_id = request.data.get("record_id", "").strip()
        action = request.data.get("action", "").strip()  # "approve" or "reject"

        if not record_id or action not in ("approve", "reject"):
            return Response(
                {
                    "success": False,
                    "error": "record_id and action (approve/reject) required",
                },
                status=400,
            )

        record = AttendanceRecord.objects(id=record_id).first()
        if not record:
            return Response(
                {"success": False, "error": "Leave request not found"}, status=404
            )

        if record.status not in ("leave_pending",):
            return Response(
                {"success": False, "error": "This request has already been processed"},
                status=400,
            )

        record.status = "leave_approved" if action == "approve" else "leave_rejected"
        record.save()

        return Response(
            {
                "success": True,
                "message": f"Leave {'approved' if action == 'approve' else 'rejected'} for {record.employee_name} on {record.date}",
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Mark Present ─────────────────────────────────────────────────────────────


@api_view(["POST"])
def mark_present(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        if is_before_attendance_start(now):
            return Response(
                {"success": False, "error": attendance_start_message()}, status=403
            )

        existing = AttendanceRecord.objects(employee_id=employee_id, date=today).first()
        if existing:
            return Response({"success": True, "message": "⚠️ Already marked for today"})

        expected_time = now.replace(
            hour=ATTENDANCE_START_HOUR, minute=ATTENDANCE_START_MINUTE
        )
        grace_deadline = expected_time + timedelta(minutes=LATE_GRACE_MINUTES)
        att_status = "present" if now <= grace_deadline else "late"
        minutes_late = (
            max(0, int((now - grace_deadline).total_seconds() / 60))
            if att_status == "late"
            else 0
        )

        record = AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=today,
            check_in_time=now,
            status=att_status,
            minutes_late=minutes_late,
        )
        record.save()

        msg = "Marked as present"
        if att_status == "late":
            msg = f"Marked as present (⚠️ {minutes_late} mins late)"

        return Response(
            {
                "success": True,
                "message": msg,
                "is_late": att_status == "late",
                "minutes_late": minutes_late,
            }
        )

    except Exception as e:
        import traceback

        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Mark Absent ─────────────────────────────────────────────────────────────


@api_view(["POST"])
def mark_absent(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        reason = request.data.get("reason", "").strip()

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        if is_before_attendance_start(now):
            return Response(
                {"success": False, "error": attendance_start_message()}, status=403
            )

        if not reason:
            return Response(
                {"success": False, "error": "Reason is required for absence"},
                status=400,
            )

        existing = AttendanceRecord.objects(employee_id=employee_id, date=today).first()
        if existing:
            return Response(
                {"success": False, "error": "Attendance already marked for today"},
                status=400,
            )

        AttendanceRecord(
            employee_id=employee_id,
            employee_name=employee.name,
            date=today,
            status="absent",
            reason=reason,
        ).save()

        return Response({"success": True, "message": "Marked as absent"})

    except Exception as e:
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Mark Half Day ────────────────────────────────────────────────────────────


@api_view(["POST"])
def mark_half_day(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        reason = request.data.get("reason", "").strip()
        half_day_until = request.data.get("half_day_until", "").strip()

        employee = Employee.objects(employee_id=employee_id, is_active=True).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )

        now = current_ist()
        today = now.strftime("%Y-%m-%d")

        AttendanceRecord.objects(employee_id=employee_id, date=today).delete()

        hour, minute = map(int, half_day_until.split(":"))
        check_out_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        duration = max(0, int((check_out_dt - now).total_seconds() / 60))

        record = AttendanceRecord(
            employee_id=employee_id,
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
        return Response({"success": False, "error": str(e)}, status=500)


# ─── Resign ───────────────────────────────────────────────────────────────────


@api_view(["POST"])
def resign_employee(request):
    try:
        employee_id = request.data.get("employee_id", "").strip()
        employee = Employee.objects(employee_id=employee_id).first()
        if not employee:
            return Response(
                {"success": False, "error": "Employee not found"}, status=404
            )
        employee.is_active = False
        employee.save()
        return Response({"success": True, "message": "Employee resigned successfully"})
    except Exception as e:
        return Response({"success": False, "error": str(e)}, status=500)
