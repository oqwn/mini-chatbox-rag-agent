from django.contrib import admin
from .models import MCPServer, MCPTool


class MCPToolInline(admin.TabularInline):
    model = MCPTool
    extra = 0


@admin.register(MCPServer)
class MCPServerAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'url', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'url']
    inlines = [MCPToolInline]


@admin.register(MCPTool)
class MCPToolAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'server', 'is_enabled', 'created_at']
    list_filter = ['is_enabled', 'server', 'created_at']
    search_fields = ['name', 'description']
