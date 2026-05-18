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
    check_in_image = me.StringField()  # Path to check-in photo
    duration_minutes = me.IntField(default=0)
    status = me.StringField()  # "present", "late", "half_day", "absent"
    is_verified = me.BooleanField(default=False)
    reason = me.StringField(default="")
    half_day_until = me.StringField(default="")

    meta = {"collection": "attendance", "indexes": ["employee_id", "date"]}
