"""HR business logic: shifts, holidays, leave balance, overtime."""

from datetime import datetime, timedelta

import pytz

from employees.models import Employee
from attendance.models import AttendanceRecord
from attendance.hr_models import (
    Shift,
    EmployeeRoster,
    Holiday,
    LeaveBalance,
    OvertimeRequest,
)

IST = pytz.timezone("Asia/Kolkata")

DEFAULT_SHIFTS = [
    {
        "code": "morning",
        "name": "Morning Shift",
        "start_hour": 10,
        "start_minute": 0,
        "end_hour": 18,
        "end_minute": 0,
        "grace_minutes": 15,
        "departments": [],
    },
    {
        "code": "evening",
        "name": "Evening Shift",
        "start_hour": 14,
        "start_minute": 0,
        "end_hour": 23,
        "end_minute": 0,
        "grace_minutes": 15,
        "departments": [],
    },
    {
        "code": "night",
        "name": "Night Shift",
        "start_hour": 22,
        "start_minute": 0,
        "end_hour": 7,
        "end_minute": 0,
        "grace_minutes": 15,
        "departments": [],
    },
]

LEAVE_TYPE_MAP = {
    "casual": "casual",
    "sick": "sick",
    "emergency": "casual",
    "annual": "annual",
}


def ensure_default_shifts():
    for spec in DEFAULT_SHIFTS:
        if not Shift.objects(code=spec["code"]).first():
            Shift(**spec).save()


def get_shift_for_employee(employee: Employee) -> Shift:
    ensure_default_shifts()
    roster = EmployeeRoster.objects(employee_id=employee.employee_id).first()
    if roster:
        shift = Shift.objects(code=roster.shift_code, is_active=True).first()
        if shift:
            return shift

    dept = (employee.department or "").strip()
    for shift in Shift.objects(is_active=True):
        if shift.departments and dept in shift.departments:
            return shift

    return Shift.objects(code="morning").first() or Shift(**DEFAULT_SHIFTS[0])


def shift_start_datetime(shift: Shift, day: datetime | None = None) -> datetime:
    day = day or datetime.now(IST)
    return day.replace(
        hour=shift.start_hour,
        minute=shift.start_minute,
        second=0,
        microsecond=0,
    )


def shift_end_datetime(shift: Shift, day: datetime | None = None) -> datetime:
    day = day or datetime.now(IST)
    end = day.replace(
        hour=shift.end_hour,
        minute=shift.end_minute,
        second=0,
        microsecond=0,
    )
    start = shift_start_datetime(shift, day)
    if end <= start:
        end += timedelta(days=1)
    return end


def is_before_shift_start(employee: Employee, now: datetime | None = None) -> bool:
    now = now or datetime.now(IST)
    shift = get_shift_for_employee(employee)
    return now < shift_start_datetime(shift, now)


def shift_start_message(employee: Employee) -> str:
    shift = get_shift_for_employee(employee)
    t = shift_start_datetime(shift).strftime("%I:%M %p")
    return f"Attendance for {shift.name} starts at {t}."


def compute_late_status(employee: Employee, now: datetime | None = None):
    now = now or datetime.now(IST)
    shift = get_shift_for_employee(employee)
    expected = shift_start_datetime(shift, now)
    grace_deadline = expected + timedelta(minutes=shift.grace_minutes or 15)
    if now <= grace_deadline:
        return "present", 0
    minutes_late = max(0, int((now - grace_deadline).total_seconds() / 60))
    return "late", minutes_late


def is_holiday(date_str: str, department: str = "") -> Holiday | None:
    for holiday in Holiday.objects(date=date_str):
        if holiday.applies_to in ("all", "", None):
            return holiday
        if department and holiday.applies_to == department:
            return holiday
    return None


def get_work_mode(employee: Employee, requested: str = "") -> str:
    mode = (requested or "").strip().lower()
    if mode in ("office", "remote", "wfh"):
        return "wfh" if mode == "remote" else mode
    roster = EmployeeRoster.objects(employee_id=employee.employee_id).first()
    if roster and roster.work_mode_default:
        return roster.work_mode_default
    return "office"


def parse_location_for_mode(data: dict, work_mode: str):
    """Location check — WFH skips geofence."""
    from attendance.views import parse_location

    if work_mode in ("wfh", "remote"):
        lat = data.get("latitude")
        lng = data.get("longitude")
        return {
            "latitude": float(lat) if lat not in (None, "") else None,
            "longitude": float(lng) if lng not in (None, "") else None,
            "status": "wfh",
            "distance": 0,
            "allowed": True,
            "message": "Working from home — location check skipped",
        }
    return parse_location(data)


def get_or_create_leave_balance(employee_id: str, year: int | None = None) -> LeaveBalance:
    year = year or datetime.now(IST).year
    balance = LeaveBalance.objects(employee_id=employee_id, year=year).first()
    if balance:
        return balance
    balance = LeaveBalance(employee_id=employee_id, year=year)
    balance.save()
    return balance


def leave_balance_payload(balance: LeaveBalance) -> dict:
    return {
        "year": balance.year,
        "casual": {
            "total": balance.casual_total,
            "used": balance.casual_used,
            "remaining": max(0, balance.casual_total - balance.casual_used),
        },
        "sick": {
            "total": balance.sick_total,
            "used": balance.sick_used,
            "remaining": max(0, balance.sick_total - balance.sick_used),
        },
        "annual": {
            "total": balance.annual_total,
            "used": balance.annual_used,
            "remaining": max(0, balance.annual_total - balance.annual_used),
        },
    }


def leave_days_between(start: str, end: str) -> float:
    start_dt = datetime.strptime(start, "%Y-%m-%d")
    end_dt = datetime.strptime(end or start, "%Y-%m-%d")
    if end_dt < start_dt:
        end_dt = start_dt
    return (end_dt - start_dt).days + 1


def check_leave_balance(employee_id: str, leave_type: str, days: float) -> tuple[bool, str]:
    bucket = LEAVE_TYPE_MAP.get(leave_type, "casual")
    balance = get_or_create_leave_balance(employee_id)
    if bucket == "casual":
        remaining = balance.casual_total - balance.casual_used
    elif bucket == "sick":
        remaining = balance.sick_total - balance.sick_used
    else:
        remaining = balance.annual_total - balance.annual_used
    if days > remaining:
        return False, f"Insufficient {bucket} leave balance. Remaining: {remaining:.1f} day(s)."
    return True, ""


def apply_leave_balance(employee_id: str, leave_type: str, days: float, reverse: bool = False):
    bucket = LEAVE_TYPE_MAP.get(leave_type, "casual")
    balance = get_or_create_leave_balance(employee_id)
    delta = -days if reverse else days
    if bucket == "casual":
        balance.casual_used = max(0, balance.casual_used + delta)
    elif bucket == "sick":
        balance.sick_used = max(0, balance.sick_used + delta)
    else:
        balance.annual_used = max(0, balance.annual_used + delta)
    balance.save()


def compute_work_duration_minutes(record: AttendanceRecord) -> int:
    if not record.check_in_time or not record.check_out_time:
        return record.duration_minutes or 0
    check_in = record.check_in_time
    check_out = record.check_out_time
    if check_in.tzinfo is None:
        check_in = IST.localize(check_in)
    if check_out.tzinfo is None:
        check_out = IST.localize(check_out)
    total = int((check_out - check_in).total_seconds() / 60)
    break_mins = getattr(record, "break_minutes", 0) or 0
    return max(0, total - break_mins)


def compute_overtime_minutes(employee: Employee, record: AttendanceRecord) -> int:
    if not record.check_out_time:
        return 0
    shift = get_shift_for_employee(employee)
    shift_end = shift_end_datetime(shift, as_ist(record.check_in_time or record.check_out_time))
    check_out = record.check_out_time
    if check_out.tzinfo is None:
        check_out = IST.localize(check_out)
    checkout_ist = check_out.astimezone(IST)
    if checkout_ist <= shift_end:
        return 0
    return int((checkout_ist - shift_end).total_seconds() / 60)


def as_ist(value):
    if not value:
        return None
    if value.tzinfo is None:
        return IST.localize(value)
    return value.astimezone(IST)


def maybe_create_overtime_request(employee: Employee, record: AttendanceRecord):
    ot_mins = compute_overtime_minutes(employee, record)
    if ot_mins < 15:
        return None
    record.overtime_minutes = ot_mins
    record.overtime_status = "pending"
    record.save()
    existing = OvertimeRequest.objects(
        employee_id=employee.employee_id,
        date=record.date,
        status="pending",
    ).first()
    if existing:
        existing.overtime_minutes = ot_mins
        existing.save()
        return existing
    req = OvertimeRequest(
        employee_id=employee.employee_id,
        employee_name=employee.name,
        date=record.date,
        overtime_minutes=ot_mins,
        reason="Auto-flagged after check-out",
    )
    req.save()
    return req
