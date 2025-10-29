from rest_framework import serializers
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'conversation_id', 'role', 'content', 'metadata', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField()
    conversation_id = serializers.UUIDField(required=False, allow_null=True)
    stream = serializers.BooleanField(default=False)
    model = serializers.CharField(default='gpt-4')
    attachments = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        allow_empty=True
    )