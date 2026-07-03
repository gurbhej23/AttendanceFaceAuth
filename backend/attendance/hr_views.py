"""HR API endpoints: shifts, holidays, roster, leave balance, OT, regularization."""

from datetime import datetime, timedelta

import pytz
from rest_framework.decorators import api_view
from rest_framework.response import Response

from employees.models import Employee
from attendance.models import AttendanceRecord
from attendance.hr_models import (
    Shift,
    EmployeeRoster,
    Holiday,
    LeaveBalance,
    RegularizationRequest,
    OvertimeRequest,
)
from attendance.hr_utils import (
    ensure_default_shifts,
    get_shift_for_employee,
    get_or_create_leave_balance,
    leave_balance_payload,
    check_leave_balance,
    apply_leave_balance,
    leave_days_between,
    is_holiday,
    compute_work_duration_minutes,
    maybe_create_overtime_request,
)

IST = pytz.timezone("Asia/Kolkata")


def _shift_payload(shift: Shift) -> dict:
    return {
        "code": shift.code,
        "name": shift.name,
        "start_hour": shift.start_hour,
        "start_minute": shift.start_minute,
        "end_hour": shift.end_hour,
        "end_minute": shift.end_minute,
        "grace_minutes": shift.grace_minutes,
        "departments": shift.departments or [],
        "is_active": shift.is_active,
    }


def _require_staff(request_data=None):
    return None


# ─── Shifts ───────────────────────────────────────────────────────────────────


@api_view(["GET", "POST"])
def shifts_list_create(request):
    ensure_default_shifts()
    if request.method == "GET":
        shifts = Shift.objects(is_active=True).order_by("start_hour")
        return Response({"success": True, "shifts": [_shift_payload(s) for s in shifts]})

    data = request.data
    code = str(data.get("code", "")).strip().lower()
    name = str(data.get("name", "")).strip()
    if not code or not name:
        return Response({"success": False, "error": "code and name required"}, status=400)
    if Shift.objects(code=code).first():
        return Response({"success": False, "error": "Shift code already exists"}, status=400)
    shift = Shift(
        code=code,
        name=name,
        start_hour=int(data.get("start_hour", 9)),
        start_minute=int(data.get("start_minute", 0)),
        end_hour=int(data.get("end_hour", 18)),
        end_minute=int(data.get("end_minute", 0)),
        grace_minutes=int(data.get("grace_minutes", 15)),
        departments=data.get("departments") or [],
    )
    shift.save()
    return Response({"success": True, "shift": _shift_payload(shift)})


@api_view(["PATCH", "DELETE"])
def shift_detail(request, code):
    shift = Shift.objects(code=code).first()
    if not shift:
        return Response({"success": False, "error": "Shift not found"}, status=404)
    if request.method == "DELETE":
        shift.is_active = False
        shift.save()
        return Response({"success": True, "message": "Shift deactivated"})
    data = request.data
    for field in ("name", "start_hour", "start_minute", "end_hour", "end_minute", "grace_minutes"):
        if field in data:
            setattr(shift, field, data[field])
    if "departments" in data:
        shift.departments = data["departments"] or []
    shift.save()
    return Response({"success": True, "shift": _shift_payload(shift)})


# ─── Roster ───────────────────────────────────────────────────────────────────


@api_view(["GET", "POST"])
def roster_manage(request):
    ensure_default_shifts()
    if request.method == "GET":
        department = request.query_params.get("department", "").strip()
        employees = Employee.objects(is_active=True, role="employee")
        if department and department != "all":
            employees = employees.filter(department=department)
        rosters = {r.employee_id: r for r in EmployeeRoster.objects()}
        rows = []
        for emp in employees.order_by("name"):
            roster = rosters.get(emp.employee_id)
            shift = get_shift_for_employee(emp)
            rows.append(
                {
                    "employee_id": emp.employee_id,
                    "name": emp.name,
                    "department": emp.department,
                    "shift_code": roster.shift_code if roster else shift.code,
                    "shift_name": shift.name,
                    "work_mode_default": roster.work_mode_default if roster else "office",
                }
            )
        return Response({"success": True, "roster": rows})

    employee_id = str(request.data.get("employee_id", "")).strip()
    shift_code = str(request.data.get("shift_code", "morning")).strip()
    work_mode = str(request.data.get("work_mode_default", "office")).strip()
    if not employee_id:
        return Response({"success": False, "error": "employee_id required"}, status=400)
    roster = EmployeeRoster.objects(employee_id=employee_id).first()
    if not roster:
        roster = EmployeeRoster(employee_id=employee_id)
    roster.shift_code = shift_code
    roster.work_mode_default = work_mode
    roster.updated_at = datetime.now(IST)
    roster.save()
    return Response({"success": True, "message": "Roster updated"})


@api_view(["GET"])
def employee_shift_info(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)
    shift = get_shift_for_employee(employee)
    roster = EmployeeRoster.objects(employee_id=employee_id).first()
    return Response(
        {
            "success": True,
            "shift": _shift_payload(shift),
            "work_mode_default": roster.work_mode_default if roster else "office",
        }
    )


# ─── Holidays ─────────────────────────────────────────────────────────────────


@api_view(["GET", "POST"])
def holidays_list_create(request):
    if request.method == "GET":
        year = request.query_params.get("year", str(datetime.now(IST).year))
        holidays = Holiday.objects(date__startswith=str(year)).order_by("date")
        return Response(
            {
                "success": True,
                "holidays": [
                    {
                        "id": str(h.id),
                        "date": h.date,
                        "name": h.name,
                        "description": h.description,
                        "applies_to": h.applies_to,
                    }
                    for h in holidays
                ],
            }
        )

    date = str(request.data.get("date", "")).strip()
    name = str(request.data.get("name", "")).strip()
    if not date or not name:
        return Response({"success": False, "error": "date and name required"}, status=400)
    holiday = Holiday(
        date=date,
        name=name,
        description=str(request.data.get("description", "")),
        applies_to=str(request.data.get("applies_to", "all")),
    )
    holiday.save()
    return Response({"success": True, "id": str(holiday.id), "message": "Holiday added"})


@api_view(["DELETE"])
def holiday_delete(request, holiday_id):
    holiday = Holiday.objects(id=holiday_id).first()
    if not holiday:
        return Response({"success": False, "error": "Holiday not found"}, status=404)
    holiday.delete()
    return Response({"success": True, "message": "Holiday removed"})


# ─── Leave balance ────────────────────────────────────────────────────────────


@api_view(["GET"])
def leave_balance_view(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    year = int(request.query_params.get("year", datetime.now(IST).year))
    if not employee_id:
        return Response({"success": False, "error": "employee_id required"}, status=400)
    balance = get_or_create_leave_balance(employee_id, year)
    return Response({"success": True, "balance": leave_balance_payload(balance)})


@api_view(["POST"])
def leave_balance_update(request):
    employee_id = str(request.data.get("employee_id", "")).strip()
    year = int(request.data.get("year", datetime.now(IST).year))
    if not employee_id:
        return Response({"success": False, "error": "employee_id required"}, status=400)
    balance = get_or_create_leave_balance(employee_id, year)
    for field in ("casual_total", "sick_total", "annual_total"):
        if field in request.data:
            setattr(balance, field, int(request.data[field]))
    balance.save()
    return Response({"success": True, "balance": leave_balance_payload(balance)})


# ─── Break time ───────────────────────────────────────────────────────────────


@api_view(["POST"])
def break_action(request):
    employee_id = str(request.data.get("employee_id", "")).strip()
    action = str(request.data.get("action", "")).strip()
    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)

    today = datetime.now(IST).strftime("%Y-%m-%d")
    record = AttendanceRecord.objects(employee_id=employee_id, date=today).first()
    if not record or not record.check_in_time:
        return Response({"success": False, "error": "Check in first before taking a break"}, status=400)

    now = datetime.now(IST)

    if action == "start":
        if record.break_start_time and not record.break_end_time:
            return Response({"success": False, "error": "Break already in progress"}, status=400)
        record.break_start_time = now
        record.break_end_time = None
        record.save()
        return Response({"success": True, "message": "Break started", "break_active": True})

    if action == "end":
        if not record.break_start_time:
            return Response({"success": False, "error": "No active break"}, status=400)
        record.break_end_time = now
        start = record.break_start_time
        if start.tzinfo is None:
            start = IST.localize(start)
        end = now if now.tzinfo else IST.localize(now)
        session_mins = max(0, int((end - start.astimezone(IST)).total_seconds() / 60))
        record.break_minutes = (record.break_minutes or 0) + session_mins
        record.break_start_time = None
        record.break_end_time = None
        if record.check_out_time:
            record.duration_minutes = compute_work_duration_minutes(record)
        record.save()
        return Response(
            {
                "success": True,
                "message": f"Break ended ({session_mins} min)",
                "break_active": False,
                "break_minutes_today": record.break_minutes,
            }
        )

    return Response({"success": False, "error": "action must be start or end"}, status=400)


@api_view(["GET"])
def break_status(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    today = datetime.now(IST).strftime("%Y-%m-%d")
    record = AttendanceRecord.objects(employee_id=employee_id, date=today).first()
    if not record:
        return Response({"success": True, "break_active": False, "break_minutes": 0})
    return Response(
        {
            "success": True,
            "break_active": bool(record.break_start_time and not record.break_end_time),
            "break_minutes": record.break_minutes or 0,
        }
    )


# ─── Regularization ───────────────────────────────────────────────────────────


@api_view(["POST"])
def request_regularization(request):
    employee_id = str(request.data.get("employee_id", "")).strip()
    date = str(request.data.get("date", "")).strip()
    reason = str(request.data.get("reason", "")).strip()
    requested_status = str(request.data.get("requested_status", "present")).strip()
    employee = Employee.objects(employee_id=employee_id, is_active=True).first()
    if not employee:
        return Response({"success": False, "error": "Employee not found"}, status=404)
    if not date or not reason:
        return Response({"success": False, "error": "date and reason required"}, status=400)

    pending = RegularizationRequest.objects(
        employee_id=employee_id, date=date, status="pending"
    ).first()
    if pending:
        return Response({"success": False, "error": "Pending request already exists for this date"}, status=400)

    req = RegularizationRequest(
        employee_id=employee_id,
        employee_name=employee.name,
        date=date,
        requested_status=requested_status,
        requested_check_in=str(request.data.get("requested_check_in", "")),
        requested_check_out=str(request.data.get("requested_check_out", "")),
        reason=reason,
    )
    req.save()
    return Response({"success": True, "message": "Regularization request submitted", "id": str(req.id)})


@api_view(["GET"])
def my_regularizations(request):
    employee_id = request.query_params.get("employee_id", "").strip()
    records = RegularizationRequest.objects(employee_id=employee_id).order_by("-created_at")
    return Response(
        {
            "success": True,
            "records": [
                {
                    "id": str(r.id),
                    "date": r.date,
                    "requested_status": r.requested_status,
                    "reason": r.reason,
                    "status": r.status,
                    "admin_note": r.admin_note,
                }
                for r in records
            ],
        }
    )


@api_view(["GET"])
def admin_regularizations(request):
    status_filter = request.query_params.get("status", "pending")
    query = RegularizationRequest.objects
    if status_filter != "all":
        query = query.filter(status=status_filter)
    records = query.order_by("-created_at")
    return Response(
        {
            "success": True,
            "records": [
                {
                    "id": str(r.id),
                    "employee_id": r.employee_id,
                    "employee_name": r.employee_name,
                    "date": r.date,
                    "requested_status": r.requested_status,
                    "requested_check_in": r.requested_check_in,
                    "requested_check_out": r.requested_check_out,
                    "reason": r.reason,
                    "status": r.status,
                    "admin_note": r.admin_note,
                }
                for r in records
            ],
        }
    )


@api_view(["POST"])
def resolve_regularization(request):
    req_id = str(request.data.get("request_id", "")).strip()
    action = str(request.data.get("action", "")).strip()
    admin_note = str(request.data.get("admin_note", ""))
    req = RegularizationRequest.objects(id=req_id).first()
    if not req or req.status != "pending":
        return Response({"success": False, "error": "Request not found or already processed"}, status=404)
    if action not in ("approve", "reject"):
        return Response({"success": False, "error": "action must be approve or reject"}, status=400)

    req.status = "approved" if action == "approve" else "rejected"
    req.admin_note = admin_note
    req.resolved_at = datetime.now(IST)
    req.save()

    if action == "approve":
        employee = Employee.objects(employee_id=req.employee_id).first()
        record = AttendanceRecord.objects(employee_id=req.employee_id, date=req.date).first()
        if not record:
            record = AttendanceRecord(
                employee_id=req.employee_id,
                employee_name=req.employee_name,
                date=req.date,
            )
        record.status = req.requested_status
        record.reason = f"Regularized: {req.reason}"
        if req.requested_check_in:
            try:
                t = datetime.strptime(f"{req.date} {req.requested_check_in}", "%Y-%m-%d %H:%M")
                record.check_in_time = IST.localize(t)
            except ValueError:
                pass
        record.save()

    return Response({"success": True, "message": f"Request {req.status}"})


# ─── Overtime ─────────────────────────────────────────────────────────────────


@api_view(["GET"])
def admin_overtime_requests(request):
    status_filter = request.query_params.get("status", "pending")
    query = OvertimeRequest.objects
    if status_filter != "all":
        query = query.filter(status=status_filter)
    records = query.order_by("-created_at")
    return Response(
        {
            "success": True,
            "records": [
                {
                    "id": str(r.id),
                    "employee_id": r.employee_id,
                    "employee_name": r.employee_name,
                    "date": r.date,
                    "overtime_minutes": r.overtime_minutes,
                    "reason": r.reason,
                    "status": r.status,
                    "admin_note": r.admin_note,
                }
                for r in records
            ],
        }
    )


@api_view(["POST"])
def resolve_overtime(request):
    req_id = str(request.data.get("request_id", "")).strip()
    action = str(request.data.get("action", "")).strip()
    admin_note = str(request.data.get("admin_note", ""))
    req = OvertimeRequest.objects(id=req_id).first()
    if not req or req.status != "pending":
        return Response({"success": False, "error": "Request not found"}, status=404)
    if action not in ("approve", "reject"):
        return Response({"success": False, "error": "action must be approve or reject"}, status=400)

    req.status = "approved" if action == "approve" else "rejected"
    req.admin_note = admin_note
    req.resolved_at = datetime.now(IST)
    req.save()

    record = AttendanceRecord.objects(employee_id=req.employee_id, date=req.date).first()
    if record:
        record.overtime_status = req.status
        record.save()

    return Response({"success": True, "message": f"Overtime {req.status}"})
