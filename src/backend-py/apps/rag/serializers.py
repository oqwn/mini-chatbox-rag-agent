from rest_framework import serializers
from .models import Document, KnowledgeSource


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'title', 'file_path', 'file_name', 'file_type', 'file_size', 'metadata', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class KnowledgeSourceSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSource
        fields = ['id', 'name', 'description', 'collection_name', 'document_count', 'metadata', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_document_count(self, obj):
        # TODO: Count documents in Qdrant collection
        return 0
