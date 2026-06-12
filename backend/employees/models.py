import mongoengine as me
from datetime import datetime
import pytz

IST = pytz.timezone("Asia/Kolkata")


def utc_now():
    return datetime.now(pytz.UTC)


class Employee(me.Document):
    name = me.StringField(required=True)
    email = me.EmailField(required=True, unique=True)
    phone = me.StringField(default="")
    employee_id = me.StringField(required=True, unique=True)
    password = me.StringField(required=True)  # Use bcrypt in real app
    profile_img = me.StringField(default="")
    cv_file = me.StringField(default="")
    photo_path = me.StringField()  # Path to stored face image
    face_embedding = me.ListField()  # FaceNet embedding (128 floats)
    department = me.StringField(default="General")
    designation = me.StringField(default="Employee")
    created_at = me.DateTimeField(default=datetime.now)
    is_active = me.BooleanField(default=True)
    role = me.StringField(default="employee")
    reset_otp = me.StringField(default="")
    attendance_otp = me.StringField(default="")
    is_online = me.BooleanField(default=False)
    last_seen = me.DateTimeField(default=datetime.now)

    meta = {"collection": "employees", "strict": False}


class RegistrationOTP(me.Document):
    email = me.EmailField(required=True, unique=True)
    otp = me.StringField(required=True)
    verified = me.BooleanField(default=False)
    created_at = me.DateTimeField(default=datetime.now)

    meta = {"collection": "registration_otps"}


class ChatMessage(me.Document):
    sender_id = me.StringField(required=True)
    sender_name = me.StringField(default="")
    sender_role = me.StringField(default="employee")
    recipient_id = me.StringField(required=True)
    recipient_name = me.StringField(default="")
    message = me.StringField(required=True)
    is_read = me.BooleanField(default=False)
    is_edited = me.BooleanField(default=False)
    is_deleted = me.BooleanField(default=False)
    reactions = me.DictField(default=dict)
    created_at = me.DateTimeField(default=utc_now)

    meta = {
        "collection": "chat_messages",
        "indexes": ["sender_id", "recipient_id", "-created_at"],
        "ordering": ["created_at"],
    }


class ChatClearState(me.Document):
    """Per-user clear: hides chat history for one side only."""

    employee_id = me.StringField(required=True)
    contact_id = me.StringField(required=True)
    cleared_at = me.DateTimeField(required=True)

    meta = {
        "collection": "chat_clear_states",
        "indexes": [
            {"fields": ("employee_id", "contact_id"), "unique": True},
        ],
    }


class GroupChatClearState(me.Document):
    """Per-user clear: hides group chat history for one member only."""

    employee_id = me.StringField(required=True)
    group_id = me.StringField(required=True)
    cleared_at = me.DateTimeField(required=True)

    meta = {
        "collection": "group_chat_clear_states",
        "indexes": [
            {"fields": ("employee_id", "group_id"), "unique": True},
        ],
    }


class ChatGroup(me.Document):
    group_name = me.StringField(required=True)
    group_img = me.StringField(default="")
    created_by = me.StringField(required=True)
    members = me.ListField(me.StringField(), default=list)
    created_at = me.DateTimeField(default=utc_now)

    meta = {"collection": "chat_groups"}


class GroupMessage(me.Document):
    group_id = me.StringField(required=True)

    sender_id = me.StringField(required=True)
    sender_name = me.StringField(default="")

    message = me.StringField(required=True)
    message_type = me.StringField(default="user")  # user | system

    is_edited = me.BooleanField(default=False)
    is_deleted = me.BooleanField(default=False)
    read_by = me.ListField(me.StringField(), default=list)
    reactions = me.DictField(default=dict)
    created_at = me.DateTimeField(default=utc_now)

    meta = {
        "collection": "group_messages",
        "indexes": ["group_id", "-created_at"],
    }
