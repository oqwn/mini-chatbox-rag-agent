from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ChatViewSet
from .asgi_views import chat_stream_asgi
from .asgi_streaming import test_stream_raw_asgi

router = DefaultRouter()
router.register(r'', ChatViewSet, basename='chat')

urlpatterns = [
    # Raw ASGI test endpoint (completely bypasses Django response system)
    path('test-stream-raw/', test_stream_raw_asgi, name='test-stream-raw'),
    # Native ASGI streaming endpoint (bypasses Django's buffering)
    path('stream-asgi/', chat_stream_asgi, name='chat-stream-asgi'),
    path('', include(router.urls)),
]
