# attendance/models.py
from django.db import models

import mongoengine as me
from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")


class AttendanceRecord(me.Document):
    employee_id = me.StringField(required=True)
    employee_name = me.StringField(required=True)
    date = me.StringField()
    check_in_time = me.DateTimeField()
    check_out_time = me.DateTimeField(null=True)
    check_in_image = me.StringField()
    check_in_latitude = me.FloatField()
    check_in_longitude = me.FloatField()
    check_out_latitude = me.FloatField()
    check_out_longitude = me.FloatField()
    location_status = me.StringField(default="not_captured")
    location_distance_meters = me.FloatField(default=0)
    duration_minutes = me.IntField(default=0)
    status = me.StringField() 
    is_verified = me.BooleanField(default=False)
    reason = me.StringField(default="")
    half_day_until = me.StringField(default="")
    minutes_late = me.IntField(default=0)
    leave_type = me.StringField(default="") 
    leave_notification_seen = me.BooleanField(default=False)
    leave_end_date = me.StringField(default="")
    work_mode = me.StringField(default="office")
    break_start_time = me.DateTimeField(null=True)
    break_end_time = me.DateTimeField(null=True)
    break_minutes = me.IntField(default=0)
    overtime_minutes = me.IntField(default=0)
    overtime_status = me.StringField(default="")
    qr_check_in = me.BooleanField(default=False)

    meta = {
        "collection": "attendance",
        "indexes": ["employee_id", "date", "status"],
    }


class BiometricSecurityAlert(me.Document):
    employee_id = me.StringField(default="")
    employee_name = me.StringField(default="")
    alert_type = me.StringField(required=True)  # failed_face_match, multi_face_detected, no_face_detected, spoof_attempt, pin_failed
    title = me.StringField(default="")
    description = me.StringField(default="")
    confidence_score = me.FloatField(default=0.0)
    severity = me.StringField(default="warning")  # info, warning, critical
    captured_image = me.StringField(default="")
    latitude = me.FloatField(null=True)
    longitude = me.FloatField(null=True)
    ip_address = me.StringField(default="")
    device_info = me.StringField(default="")
    created_at = me.DateTimeField(default=datetime.utcnow)
    is_resolved = me.BooleanField(default=False)
    resolved_by = me.StringField(default="")
    resolution_notes = me.StringField(default="")

    meta = {
        "collection": "biometric_security_alerts",
        "indexes": ["-created_at", "alert_type", "employee_id", "severity", "is_resolved"],
    }

