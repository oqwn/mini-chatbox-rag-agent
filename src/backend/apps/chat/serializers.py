from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    conversationId = serializers.IntegerField(source='conversation_id')
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    tokenCount = serializers.IntegerField(source='token_count', required=False, allow_null=True)
    importanceScore = serializers.FloatField(source='importance_score', required=False, allow_null=True)
    isSummarized = serializers.BooleanField(source='is_summarized', required=False)

    class Meta:
        model = Message
        fields = ['id', 'conversationId', 'role', 'content', 'metadata', 'createdAt', 'tokenCount', 'importanceScore', 'isSummarized']
        read_only_fields = ['id', 'createdAt']


class ChatRequestSerializer(serializers.Serializer):
    messages = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_null=True
    )
    message = serializers.CharField(required=False, allow_null=True)
    options = serializers.DictField(required=False, allow_null=True)
    ragEnabled = serializers.BooleanField(required=False, default=False)
    mcpAutoApprove = serializers.BooleanField(required=False, default=False)
    canvasMode = serializers.BooleanField(required=False, default=False)
    conversation_id = serializers.UUIDField(required=False, allow_null=True)
    stream = serializers.BooleanField(default=False)
    model = serializers.CharField(default='gpt-4', required=False, allow_null=True)
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True
    )

    def validate(self, data):
        # Either messages or message must be provided
        if not data.get('messages') and not data.get('message'):
            raise serializers.ValidationError("Either 'messages' or 'message' field is required")
        return data