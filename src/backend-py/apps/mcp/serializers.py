from rest_framework import serializers
from .models import MCPServer, MCPTool


class MCPToolSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCPTool
        fields = ['id', 'name', 'description', 'parameters', 'is_enabled', 'created_at']
        read_only_fields = ['id', 'created_at']


class MCPServerSerializer(serializers.ModelSerializer):
    tools = MCPToolSerializer(many=True, read_only=True)
    tool_count = serializers.SerializerMethodField()

    class Meta:
        model = MCPServer
        fields = ['id', 'name', 'url', 'is_active', 'tool_count', 'tools', 'metadata', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_tool_count(self, obj):
        return obj.tools.count()
