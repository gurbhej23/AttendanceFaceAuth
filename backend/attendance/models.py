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

    meta = {
        "collection": "attendance",
        "indexes": ["employee_id", "date", "status"],
    }
