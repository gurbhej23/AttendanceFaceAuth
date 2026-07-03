"""Announcements and scheduled group messages."""

import mongoengine as me
from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")


def ist_now():
    return datetime.now(IST)


class Announcement(me.Document):
    title = me.StringField(required=True)
    body = me.StringField(required=True)
    created_by = me.StringField(required=True)
    created_by_name = me.StringField(default="")
    audience = me.StringField(default="all")
    is_active = me.BooleanField(default=True)
    expires_at = me.StringField(default="")
    created_at = me.DateTimeField(default=ist_now)

    meta = {
        "collection": "announcements",
        "indexes": ["-created_at", "is_active"],
    }
