import json
from datetime import datetime

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

from .models import ChatMessage, Employee


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
        "created_at": message.created_at.isoformat(),
    }


@sync_to_async
def set_presence(employee_id, is_online):
    employee = Employee.objects(employee_id=employee_id).first()
    if not employee:
        return None
    employee.is_online = is_online
    employee.last_seen = datetime.now()
    employee.save()
    return employee.last_seen.isoformat()


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


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.employee_id = self.scope["url_route"]["kwargs"]["employee_id"]
        self.group_name = f"chat_{self.employee_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        last_seen = await set_presence(self.employee_id, True)
        await self.broadcast_presence(True, last_seen)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
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

        recipient_id = str(data.get("recipient_id", "")).strip()
        text = str(data.get("message", "")).strip()
        if not recipient_id or not text:
            return

        payload = await save_message(self.employee_id, recipient_id, text)
        await self.broadcast_message_event("message", payload)

    async def broadcast_message_event(self, event_type, payload):
        if not payload:
            await self.send(
                text_data=json.dumps({"type": "error", "error": "Could not update chat"})
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
        await self.channel_layer.group_add("chat_presence", self.channel_name)

    async def chat_event(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": event["event_type"], "message": event["message"]}
            )
        )

    async def chat_raw(self, event):
        await self.send(text_data=json.dumps(event["payload"]))
