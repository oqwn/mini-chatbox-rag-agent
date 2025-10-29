from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MCPServerViewSet, MCPToolViewSet

router = DefaultRouter()
router.register(r'servers', MCPServerViewSet, basename='mcp-server')
router.register(r'tools', MCPToolViewSet, basename='mcp-tool')

urlpatterns = [
    path('', include(router.urls)),
]
