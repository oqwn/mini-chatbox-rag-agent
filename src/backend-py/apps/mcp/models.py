from django.db import models


# MCP tables don't exist in Node.js backend yet
# These are new tables for Python backend only
class MCPServer(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    url = models.CharField(max_length=500)
    api_key = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'mcp_servers'
        ordering = ['name']

    def __str__(self):
        return self.name


class MCPTool(models.Model):
    id = models.AutoField(primary_key=True)
    server = models.ForeignKey(MCPServer, on_delete=models.CASCADE, related_name='tools')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    parameters = models.JSONField(default=dict, blank=True)
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'mcp_tools'
        ordering = ['name']

    def __str__(self):
        return f"{self.server.name}::{self.name}"
