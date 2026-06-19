from django.urls import path

from employees.consumers import ChatConsumer, GroupChatConsumer

websocket_urlpatterns = [
    path("ws/chat/<str:employee_id>", ChatConsumer.as_asgi()),
    path("ws/chat/<str:employee_id>/", ChatConsumer.as_asgi()),
    path(
        "ws/group/<str:group_id>/<str:employee_id>",
        GroupChatConsumer.as_asgi(),
    ),
    path(
        "ws/group/<str:group_id>/<str:employee_id>/",
        GroupChatConsumer.as_asgi(),
    ),
]
