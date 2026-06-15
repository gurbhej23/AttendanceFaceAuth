import json
from datetime import datetime, timezone

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import ChatGroup, ChatMessage, Employee, GroupMessage
from .media_utils import normalize_media_path


def chat_datetime_iso(value):
    if not value:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def message_payload(message):
    return {
        "id": str(message.id),
        "sender_id": message.sender_id,
        "sender_name": message.sender_name,
        "sender_role": message.sender_role,
        "recipient_id": message.recipient_id,
        "recipient_name": message.recipient_name,
        "message": message.message,
        "is_read": message.is_read,
        "is_edited": getattr(message, "is_edited", False),
        "is_deleted": getattr(message, "is_deleted", False),
        "reactions": getattr(message, "reactions", {}) or {},
        "created_at": chat_datetime_iso(message.created_at),
    }


@sync_to_async
def set_presence(employee_id, is_online):
    employee = Employee.objects(employee_id=employee_id).first()
    if not employee:
        return None
    employee.is_online = is_online
    employee.last_seen = datetime.now(timezone.utc)
    employee.save()
    return chat_datetime_iso(employee.last_seen)


@sync_to_async
def save_message(sender_id, recipient_id, text):
    sender = Employee.objects(employee_id=sender_id).first()
    recipient = Employee.objects(employee_id=recipient_id).first()
    if not sender or not recipient:
        return None

    message = ChatMessage(
        sender_id=sender.employee_id,
        sender_name=sender.name,
        sender_role=sender.role,
        recipient_id=recipient.employee_id,
        recipient_name=recipient.name,
        message=text.strip(),
        created_at=datetime.now(timezone.utc),
    )
    message.save()
    return message_payload(message)


@sync_to_async
def edit_message(message_id, employee_id, new_text):
    message = ChatMessage.objects(id=message_id, sender_id=employee_id).first()
    if not message:
        return None
    message.message = new_text.strip()
    message.is_edited = True
    message.save()
    return message_payload(message)


@sync_to_async
def delete_message(message_id, employee_id):
    message = ChatMessage.objects(id=message_id, sender_id=employee_id).first()
    if not message:
        return None
    message.message = "This message was deleted"
    message.is_deleted = True
    message.save()
    return message_payload(message)


@sync_to_async
def toggle_reaction(message_id, employee_id, emoji):
    message = ChatMessage.objects(id=message_id).first()
    if not message or employee_id not in {message.sender_id, message.recipient_id}:
        return None

    reactions = getattr(message, "reactions", {}) or {}
    users = list(reactions.get(emoji, []))
    if employee_id in users:
        users.remove(employee_id)
    else:
        users.append(employee_id)

    if users:
        reactions[emoji] = users
    elif emoji in reactions:
        del reactions[emoji]

    message.reactions = reactions
    message.save()
    return message_payload(message)


@sync_to_async
def mark_read(reader_id, contact_id):
    ChatMessage.objects(
        sender_id=contact_id,
        recipient_id=reader_id,
        is_read=False,
    ).update(set__is_read=True)
    return list(
        ChatMessage.objects(sender_id=contact_id, recipient_id=reader_id).scalar("id")
    )


@sync_to_async
def employee_call_profile(employee_id):
    employee = Employee.objects(employee_id=employee_id).first()
    if not employee:
        return {
            "employee_id": employee_id,
            "name": employee_id,
            "role": "",
            "profile_img": "",
        }
    return {
        "employee_id": employee.employee_id,
        "name": employee.name,
        "role": employee.role,
        "profile_img": normalize_media_path(
            employee.profile_img or employee.photo_path or ""
        ),
    }


@sync_to_async
def group_call_members(group_id, caller_id):
    group = ChatGroup.objects(id=group_id).first()
    caller = Employee.objects(employee_id=caller_id).first()
    if not group or not caller:
        return []
    if caller.role not in ("admin", "hr") and caller_id not in group.members:
        return []
    return [member_id for member_id in group.members if member_id != caller_id]


@sync_to_async
def can_direct_call(caller_id, recipient_id):
    caller = Employee.objects(employee_id=caller_id).first()
    recipient = Employee.objects(employee_id=recipient_id).first()
    if not caller or not recipient or not caller.is_active or not recipient.is_active:
        return False
    if caller.employee_id == recipient.employee_id:
        return False
    if caller.role in ("admin", "hr"):
        return True
    return recipient.role in ("admin", "hr")


@sync_to_async
def can_group_call(caller_id, group_id):
    group = ChatGroup.objects(id=group_id).first()
    caller = Employee.objects(employee_id=caller_id).first()
    if not group or not caller or not caller.is_active:
        return False
    if caller.role in ("admin", "hr"):
        return True
    return caller.employee_id in group.members


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):

        self.employee_id = self.scope["url_route"]["kwargs"]["employee_id"]
        self.group_name = f"chat_{self.employee_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.channel_layer.group_add("chat_presence", self.channel_name)
        await self.accept()
        last_seen = await set_presence(self.employee_id, True)
        await self.broadcast_presence(True, last_seen)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_discard("chat_presence", self.channel_name)
        last_seen = await set_presence(self.employee_id, False)
        await self.broadcast_presence(False, last_seen)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        event_type = data.get("type", "message")
        if event_type == "typing":
            await self.broadcast_simple(
                str(data.get("recipient_id", "")).strip(),
                {
                    "type": "typing",
                    "sender_id": self.employee_id,
                    "is_typing": bool(data.get("is_typing")),
                },
            )
            return

        if event_type == "read":
            contact_id = str(data.get("contact_id", "")).strip()
            if contact_id:
                ids = await mark_read(self.employee_id, contact_id)
                await self.broadcast_simple(
                    contact_id,
                    {
                        "type": "read",
                        "reader_id": self.employee_id,
                        "contact_id": contact_id,
                        "message_ids": [str(message_id) for message_id in ids],
                    },
                )
            return

        if event_type == "edit":
            payload = await edit_message(
                str(data.get("message_id", "")).strip(),
                self.employee_id,
                str(data.get("new_text", "")).strip(),
            )
            await self.broadcast_message_event("edit", payload)
            return

        if event_type == "delete":
            payload = await delete_message(
                str(data.get("message_id", "")).strip(), self.employee_id
            )
            await self.broadcast_message_event("delete", payload)
            return

        if event_type == "react":
            payload = await toggle_reaction(
                str(data.get("message_id", "")).strip(),
                self.employee_id,
                str(data.get("emoji", "")).strip(),
            )
            await self.broadcast_message_event("react", payload)
            return

        if event_type.startswith("call_"):
            await self.handle_call_event(event_type, data)
            return

        recipient_id = str(data.get("recipient_id", "")).strip()
        text = str(data.get("message", "")).strip()
        if not recipient_id or not text:
            return

        payload = await save_message(self.employee_id, recipient_id, text)
        await self.broadcast_message_event("message", payload)

    async def broadcast_message_event(self, event_type, payload):
        if not payload:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "error": "Could not update chat"}
                )
            )
            return
        event = {"type": "chat.event", "event_type": event_type, "message": payload}
        await self.channel_layer.group_send(f"chat_{payload['recipient_id']}", event)
        await self.channel_layer.group_send(f"chat_{payload['sender_id']}", event)

    async def broadcast_simple(self, recipient_id, payload):
        if recipient_id:
            await self.channel_layer.group_send(
                f"chat_{recipient_id}", {"type": "chat.raw", "payload": payload}
            )

    async def broadcast_presence(self, is_online, last_seen):
        await self.channel_layer.group_send(
            "chat_presence",
            {
                "type": "chat.raw",
                "payload": {
                    "type": "presence",
                    "employee_id": self.employee_id,
                    "is_online": is_online,
                    "last_seen": last_seen or "",
                },
            },
        )

    async def handle_call_event(self, event_type, data):
        call_id = str(data.get("call_id", "")).strip()
        if not call_id:
            return

        if event_type == "call_invite":
            call_type = str(data.get("call_type", "direct")).strip()
            if call_type == "group":
                group_id = str(data.get("group_id", "")).strip()
                if not group_id or not await can_group_call(
                    self.employee_id, group_id
                ):
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "call_error",
                                "call_id": call_id,
                                "error": "You cannot start a group call in this group",
                            }
                        )
                    )
                    return
            else:
                recipient_id = str(data.get("recipient_id", "")).strip()
                if not recipient_id or not await can_direct_call(
                    self.employee_id, recipient_id
                ):
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "call_error",
                                "call_id": call_id,
                                "error": "You cannot call this contact",
                            }
                        )
                    )
                    return

        payload = {
            **data,
            "type": event_type,
            "call_id": call_id,
            "sender_id": self.employee_id,
        }
        payload["caller"] = await employee_call_profile(self.employee_id)

        if str(data.get("call_type")) == "group":
            group_id = str(data.get("group_id", "")).strip()
            if group_id:
                members = await group_call_members(group_id, self.employee_id)
                payload["group_id"] = group_id
                if event_type == "call_invite":
                    for member_id in members:
                        await self.broadcast_simple(member_id, payload)
                    return
                if event_type == "call_end":
                    for member_id in members:
                        await self.broadcast_simple(member_id, payload)
                    return

        recipients = []
        target_id = str(data.get("target_id", "")).strip()
        recipient_id = str(data.get("recipient_id", "")).strip()
        if target_id:
            recipients.append(target_id)
        elif recipient_id:
            recipients.append(recipient_id)

        for recipient in dict.fromkeys(recipients):
            if recipient and recipient != self.employee_id:
                await self.broadcast_simple(recipient, payload)

    async def chat_event(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": event["event_type"], "message": event["message"]}
            )
        )

    async def chat_raw(self, event):
        await self.send(text_data=json.dumps(event["payload"]))


def group_message_payload(message, group=None):
    read_by = list(getattr(message, "read_by", []) or [])
    recipients = []
    if group:
        recipients = [m for m in group.members if m != message.sender_id]
    read_count = len([member_id for member_id in read_by if member_id != message.sender_id])
    total_recipients = len(recipients)
    is_fully_read = total_recipients > 0 and all(
        member_id in read_by for member_id in recipients
    )
    return {
        "id": str(message.id),
        "group_id": message.group_id,
        "sender_id": message.sender_id,
        "sender_name": message.sender_name,
        "message": message.message,
        "is_edited": getattr(message, "is_edited", False),
        "is_deleted": getattr(message, "is_deleted", False),
        "message_type": getattr(message, "message_type", "user") or "user",
        "read_by": read_by,
        "read_count": read_count,
        "total_recipients": total_recipients,
        "is_fully_read": is_fully_read,
        "reactions": getattr(message, "reactions", {}) or {},
        "created_at": chat_datetime_iso(message.created_at),
    }


@sync_to_async
def can_join_group(group_id, employee_id):
    group = ChatGroup.objects(id=group_id).first()
    employee = Employee.objects(employee_id=employee_id).first()
    if not group or not employee:
        return False
    if employee.role in ("admin", "hr"):
        return True
    return employee_id in group.members


@sync_to_async
def save_group_message(group_id, sender_id, text):
    sender = Employee.objects(employee_id=sender_id).first()
    group = ChatGroup.objects(id=group_id).first()
    if not sender or not group:
        return None
    if sender.role not in ("admin", "hr") and sender_id not in group.members:
        return None

    message = GroupMessage(
        group_id=group_id,
        sender_id=sender.employee_id,
        sender_name=sender.name,
        message=text.strip(),
        created_at=datetime.now(timezone.utc),
    )
    message.save()
    return group_message_payload(message, group)


@sync_to_async
def edit_group_message(message_id, employee_id, new_text):
    message = GroupMessage.objects(id=message_id, sender_id=employee_id).first()
    group = ChatGroup.objects(id=message.group_id).first() if message else None
    if not message or not group:
        return None
    message.message = new_text.strip()
    message.is_edited = True
    message.save()
    return group_message_payload(message, group)


@sync_to_async
def delete_group_message(message_id, employee_id):
    message = GroupMessage.objects(id=message_id, sender_id=employee_id).first()
    group = ChatGroup.objects(id=message.group_id).first() if message else None
    if not message or not group:
        return None
    message.message = "This message was deleted"
    message.is_deleted = True
    message.save()
    return group_message_payload(message, group)


@sync_to_async
def mark_group_read(group_id, reader_id):
    group = ChatGroup.objects(id=group_id).first()
    if not group:
        return []
    updated = []
    for message in GroupMessage.objects(group_id=group_id, is_deleted=False):
        if message.sender_id == reader_id:
            continue
        read_by = list(getattr(message, "read_by", []) or [])
        if reader_id not in read_by:
            read_by.append(reader_id)
            message.read_by = read_by
            message.save()
            updated.append(group_message_payload(message, group))
    return updated


class GroupChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.group_id = self.scope["url_route"]["kwargs"]["group_id"]
        self.employee_id = self.scope["url_route"]["kwargs"]["employee_id"]
        allowed = await can_join_group(self.group_id, self.employee_id)
        if not allowed:
            await self.close()
            return

        self.room_group_name = f"group_{self.group_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name, self.channel_name
            )

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        event_type = data.get("type", "message")

        if event_type == "typing":
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    "type": "group.typing",
                    "payload": {
                        "type": "typing",
                        "group_id": self.group_id,
                        "sender_id": self.employee_id,
                        "sender_name": str(data.get("sender_name", "")).strip(),
                        "sender_role": str(data.get("sender_role", "")).strip(),
                        "is_typing": bool(data.get("is_typing")),
                    },
                },
            )
            return

        if event_type == "edit":
            payload = await edit_group_message(
                str(data.get("message_id", "")).strip(),
                self.employee_id,
                str(data.get("new_text", "")).strip(),
            )
            if payload:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {"type": "group.event", "event_type": "edit", "message": payload},
                )
            return

        if event_type == "delete":
            payload = await delete_group_message(
                str(data.get("message_id", "")).strip(), self.employee_id
            )
            if payload:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {"type": "group.event", "event_type": "delete", "message": payload},
                )
            return

        if event_type == "read":
            payloads = await mark_group_read(self.group_id, self.employee_id)
            for payload in payloads:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {"type": "group.event", "event_type": "read", "message": payload},
                )
            return

        text = str(data.get("message", "")).strip()
        if not text:
            return

        payload = await save_group_message(self.group_id, self.employee_id, text)
        if not payload:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "error": "Could not send group message"}
                )
            )
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "group.event", "event_type": "message", "message": payload},
        )

    async def group_message(self, event):
        await self.send(
            text_data=json.dumps({"type": "message", "message": event["message"]})
        )

    async def group_event(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": event["event_type"], "message": event["message"]}
            )
        )

    async def group_typing(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
