from rest_framework import serializers
from .models import UserSettings


class UserSettingsSerializer(serializers.ModelSerializer):
    """Serializer for user settings"""

    class Meta:
        model = UserSettings
        fields = [
            'id',
            'user_id',
            'api_key',
            'base_url',
            'model',
            'temperature',
            'max_tokens',
            'top_p',
            'rag_enabled',
            'rag_config',
            'theme',
            'language',
            'metadata',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def to_representation(self, instance):
        """Customize the output representation"""
        data = super().to_representation(instance)
        
        # Mask API key for security (show only last 4 characters)
        if data.get('api_key'):
            api_key = data['api_key']
            if len(api_key) > 4:
                data['api_key'] = '****' + api_key[-4:]
        
        return data


class SettingsUpdateSerializer(serializers.Serializer):
    """Serializer for updating settings"""
    api_key = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    base_url = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    model = serializers.CharField(required=False)
    temperature = serializers.FloatField(required=False, min_value=0.0, max_value=2.0)
    max_tokens = serializers.IntegerField(required=False, min_value=1)
    top_p = serializers.FloatField(required=False, min_value=0.0, max_value=1.0)
    rag_enabled = serializers.BooleanField(required=False)
    rag_config = serializers.JSONField(required=False)
    theme = serializers.CharField(required=False)
    language = serializers.CharField(required=False)
    metadata = serializers.JSONField(required=False)
