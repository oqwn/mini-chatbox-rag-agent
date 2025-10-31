from rest_framework import serializers
from .models import Document, KnowledgeSource


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'title', 'content', 'file_path', 'file_type', 'file_size', 'metadata', 'knowledge_source_id', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class KnowledgeSourceSerializer(serializers.ModelSerializer):
    document_count = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgeSource
        fields = ['id', 'name', 'description', 'source_type', 'config', 'is_active', 'document_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_document_count(self, obj):
        return Document.objects.filter(knowledge_source_id=obj.id).count()


class TextIngestSerializer(serializers.Serializer):
    """Serializer for text ingestion"""
    text = serializers.CharField(required=True)
    title = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)
    knowledge_source_id = serializers.IntegerField(required=False, allow_null=True)


class FileIngestSerializer(serializers.Serializer):
    """Serializer for file ingestion"""
    file = serializers.FileField(required=True)
    title = serializers.CharField(required=False, allow_blank=True)
    metadata = serializers.JSONField(required=False)
    knowledge_source_id = serializers.IntegerField(required=False, allow_null=True)


class SearchSerializer(serializers.Serializer):
    """Serializer for search requests"""
    query = serializers.CharField(required=True)
    top_k = serializers.IntegerField(default=5, min_value=1, max_value=100)
    knowledge_source_id = serializers.IntegerField(required=False, allow_null=True)
    filter = serializers.JSONField(required=False)


class EmbeddingSerializer(serializers.Serializer):
    """Serializer for embedding generation"""
    text = serializers.CharField(required=True)
    model = serializers.CharField(default='text-embedding-ada-002')


class RAGConfigSerializer(serializers.Serializer):
    """Serializer for RAG configuration"""
    embedding_model = serializers.CharField(default='text-embedding-ada-002')
    chunk_size = serializers.IntegerField(default=500, min_value=100, max_value=2000)
    chunk_overlap = serializers.IntegerField(default=50, min_value=0, max_value=500)
    top_k = serializers.IntegerField(default=5, min_value=1, max_value=20)
    similarity_threshold = serializers.FloatField(default=0.7, min_value=0.0, max_value=1.0)


class DocumentMoveSerializer(serializers.Serializer):
    """Serializer for moving documents"""
    target_knowledge_source_id = serializers.IntegerField(required=True)


class ChunkSerializer(serializers.Serializer):
    """Serializer for document chunks"""
    id = serializers.CharField()
    content = serializers.CharField()
    metadata = serializers.JSONField()
    score = serializers.FloatField(required=False)
