from rest_framework import serializers
from .models import Conversation


class ConversationSerializer(serializers.ModelSerializer):
    sessionId = serializers.CharField(source='session_id')
    messageCount = serializers.IntegerField(source='message_count', read_only=True)
    memorySummary = serializers.CharField(source='memory_summary', required=False, allow_blank=True, allow_null=True)
    contextWindowSize = serializers.IntegerField(source='context_window_size', required=False)
    lastActivity = serializers.DateTimeField(source='last_activity', read_only=True)
    isArchived = serializers.BooleanField(source='is_archived', required=False)
    projectId = serializers.IntegerField(source='project_id', required=False, allow_null=True)
    isStarred = serializers.BooleanField(source='is_starred', required=False)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    updatedAt = serializers.DateTimeField(source='updated_at', read_only=True)

    class Meta:
        model = Conversation
        fields = [
            'id', 'sessionId', 'title', 'messageCount', 'memorySummary',
            'contextWindowSize', 'lastActivity', 'isArchived', 'projectId',
            'isStarred', 'createdAt', 'updatedAt'
        ]
        read_only_fields = ['id', 'createdAt', 'updatedAt', 'messageCount', 'lastActivity']
