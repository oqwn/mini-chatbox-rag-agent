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
    serverId = serializers.CharField(write_only=True, required=False)
    config = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = MCPServer
        fields = ['id', 'name', 'url', 'is_active', 'tool_count', 'tools', 'metadata', 'serverId', 'config', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_tool_count(self, obj):
        return obj.tools.count()

    def create(self, validated_data):
        # Handle frontend format with serverId and config
        server_id = validated_data.pop('serverId', None)
        config = validated_data.pop('config', {})

        if server_id and not validated_data.get('name'):
            validated_data['name'] = server_id

        if config:
            # Extract url from config if present
            if 'command' in config:
                validated_data['url'] = config.get('command', '')
            elif 'url' in config:
                validated_data['url'] = config.get('url', '')

            # Store full config in metadata
            validated_data['metadata'] = config

        # Ensure url is set
        if not validated_data.get('url'):
            validated_data['url'] = 'stdio://local'

        return super().create(validated_data)


class MCPResourceSerializer(serializers.Serializer):
    """Serializer for MCP resources"""
    id = serializers.CharField()
    name = serializers.CharField()
    type = serializers.CharField()
    uri = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)


class MCPPromptSerializer(serializers.Serializer):
    """Serializer for MCP prompts"""
    id = serializers.CharField()
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True)
    template = serializers.CharField()
    parameters = serializers.JSONField(required=False)
