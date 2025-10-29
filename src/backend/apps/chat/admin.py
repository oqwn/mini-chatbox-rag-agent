from django.contrib import admin
from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['id', 'conversation_id', 'role', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['content', 'conversation_id']
    ordering = ['-created_at']
