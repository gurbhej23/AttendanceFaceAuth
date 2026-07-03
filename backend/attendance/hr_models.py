"""HR models: shifts, holidays, leave balance, regularization, overtime."""

import mongoengine as me
from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")


def ist_now():
    return datetime.now(IST)


class Shift(me.Document):
    code = me.StringField(required=True, unique=True)
    name = me.StringField(required=True)
    start_hour = me.IntField(required=True)
    start_minute = me.IntField(default=0)
    end_hour = me.IntField(required=True)
    end_minute = me.IntField(default=0)
    grace_minutes = me.IntField(default=15)
    departments = me.ListField(me.StringField(), default=list)
    is_active = me.BooleanField(default=True)
    created_at = me.DateTimeField(default=ist_now)

    meta = {"collection": "shifts"}


class EmployeeRoster(me.Document):
    employee_id = me.StringField(required=True, unique=True)
    shift_code = me.StringField(default="morning")
    work_mode_default = me.StringField(default="office")
    updated_at = me.DateTimeField(default=ist_now)

    meta = {"collection": "employee_rosters"}


class Holiday(me.Document):
    date = me.StringField(required=True)
    name = me.StringField(required=True)
    description = me.StringField(default="")
    applies_to = me.StringField(default="all")
    created_at = me.DateTimeField(default=ist_now)

    meta = {
        "collection": "holidays",
        "indexes": ["date"],
    }


class LeaveBalance(me.Document):
    employee_id = me.StringField(required=True)
    year = me.IntField(required=True)
    casual_total = me.IntField(default=12)
    casual_used = me.FloatField(default=0)
    sick_total = me.IntField(default=10)
    sick_used = me.FloatField(default=0)
    annual_total = me.IntField(default=15)
    annual_used = me.FloatField(default=0)

    meta = {
        "collection": "leave_balances",
        "indexes": [{"fields": ("employee_id", "year"), "unique": True}],
    }


class RegularizationRequest(me.Document):
    employee_id = me.StringField(required=True)
    employee_name = me.StringField(required=True)
    date = me.StringField(required=True)
    requested_status = me.StringField(required=True)
    requested_check_in = me.StringField(default="")
    requested_check_out = me.StringField(default="")
    reason = me.StringField(required=True)
    status = me.StringField(default="pending")
    admin_note = me.StringField(default="")
    created_at = me.DateTimeField(default=ist_now)
    resolved_at = me.DateTimeField()

    meta = {
        "collection": "regularization_requests",
        "indexes": ["employee_id", "status", "-created_at"],
    }


class OvertimeRequest(me.Document):
    employee_id = me.StringField(required=True)
    employee_name = me.StringField(required=True)
    date = me.StringField(required=True)
    overtime_minutes = me.IntField(required=True)
    reason = me.StringField(default="")
    status = me.StringField(default="pending")
    admin_note = me.StringField(default="")
    created_at = me.DateTimeField(default=ist_now)
    resolved_at = me.DateTimeField()

    meta = {
        "collection": "overtime_requests",
        "indexes": ["employee_id", "status", "-created_at"],
    }
