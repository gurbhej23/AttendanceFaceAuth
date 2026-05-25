from django.urls import path

from employees.consumers import ChatConsumer

websocket_urlpatterns = [
    path("ws/chat/<str:employee_id>/", ChatConsumer.as_asgi()),
]
