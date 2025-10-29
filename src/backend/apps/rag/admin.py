from django.contrib import admin
from .models import Document, KnowledgeSource


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'file_type', 'file_size', 'created_at']
    list_filter = ['file_type', 'created_at']
    search_fields = ['title', 'file_path']
    ordering = ['-created_at']


@admin.register(KnowledgeSource)
class KnowledgeSourceAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'source_type', 'is_active', 'created_at']
    list_filter = ['created_at', 'source_type', 'is_active']
    search_fields = ['name', 'description']
    ordering = ['-created_at']
