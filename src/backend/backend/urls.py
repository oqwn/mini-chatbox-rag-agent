"""
URL Configuration for backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/chat/', include('apps.chat.urls')),
    path('api/conversations/', include('apps.conversation.urls')),
    path('api/rag/', include('apps.rag.urls')),
    path('api/mcp/', include('apps.mcp.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/settings/', include('apps.settings.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
