from django.contrib import admin
from .models import Conversation


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'session_id', 'created_at', 'updated_at']
    list_filter = ['created_at', 'updated_at', 'is_archived']
    search_fields = ['title', 'session_id']
    ordering = ['-updated_at']
