import json

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
        "created_at": message.created_at.isoformat(),
    }


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


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.employee_id = self.scope["url_route"]["kwargs"]["employee_id"]
        self.group_name = f"chat_{self.employee_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        recipient_id = str(data.get("recipient_id", "")).strip()
        text = str(data.get("message", "")).strip()
        if not recipient_id or not text:
            return

        payload = await save_message(self.employee_id, recipient_id, text)
        if not payload:
            await self.send(
                text_data=json.dumps(
                    {"type": "error", "error": "Could not send message"}
                )
            )
            return

        event = {"type": "chat.message", "message": payload}
        await self.channel_layer.group_send(f"chat_{recipient_id}", event)
        await self.channel_layer.group_send(f"chat_{self.employee_id}", event)

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps({"type": "message", "message": event["message"]})
        )
