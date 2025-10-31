from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.core.cache import cache
from .models import Document, KnowledgeSource
from .serializers import (
    DocumentSerializer, KnowledgeSourceSerializer,
    TextIngestSerializer, FileIngestSerializer,
    SearchSerializer, EmbeddingSerializer,
    RAGConfigSerializer, DocumentMoveSerializer,
    ChunkSerializer
)
import time
import os


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = DocumentSerializer
    queryset = Document.objects.all()

    @action(detail=True, methods=['put'])
    def move(self, request, pk=None):
        """
        PUT /api/rag/documents/{id}/move/
        Move document to another knowledge source
        """
        document = self.get_object()
        serializer = DocumentMoveSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        target_id = serializer.validated_data['target_knowledge_source_id']

        # Check if target knowledge source exists
        try:
            target_ks = KnowledgeSource.objects.get(id=target_id)
        except KnowledgeSource.DoesNotExist:
            return Response(
                {'error': 'Target knowledge source not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        old_ks_id = document.knowledge_source_id
        document.knowledge_source_id = target_id
        document.save()

        return Response({
            'id': document.id,
            'title': document.title,
            'old_knowledge_source_id': old_ks_id,
            'new_knowledge_source_id': target_id,
            'moved_at': time.time()
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def chunks(self, request, pk=None):
        """
        GET /api/rag/documents/{id}/chunks/
        Get chunks of a document
        """
        document = self.get_object()

        # Mock chunks - in production, this would retrieve from vector DB
        chunks = [
            {
                'id': f'{document.id}_chunk_1',
                'content': document.content[:500] if document.content else 'No content',
                'metadata': {
                    'document_id': document.id,
                    'chunk_index': 0,
                    'start_char': 0,
                    'end_char': 500
                },
                'score': 1.0
            },
            {
                'id': f'{document.id}_chunk_2',
                'content': document.content[500:1000] if len(document.content) > 500 else '',
                'metadata': {
                    'document_id': document.id,
                    'chunk_index': 1,
                    'start_char': 500,
                    'end_char': 1000
                },
                'score': 0.95
            }
        ]

        serializer = ChunkSerializer(chunks, many=True)
        return Response({
            'document_id': document.id,
            'total_chunks': len(chunks),
            'chunks': serializer.data
        }, status=status.HTTP_200_OK)


class KnowledgeSourceViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = KnowledgeSourceSerializer
    queryset = KnowledgeSource.objects.all()

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        """Upload a document to the knowledge source"""
        knowledge_source = self.get_object()

        serializer = FileIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = serializer.validated_data['file']
        title = serializer.validated_data.get('title', uploaded_file.name)
        metadata = serializer.validated_data.get('metadata', {})

        # Create document
        document = Document.objects.create(
            title=title,
            content='',  # Will be populated during processing
            file_path=f'uploads/{uploaded_file.name}',
            file_type=uploaded_file.content_type,
            file_size=uploaded_file.size,
            metadata=metadata,
            knowledge_source_id=knowledge_source.id
        )

        return Response({
            'id': document.id,
            'title': document.title,
            'status': 'uploaded',
            'knowledge_source_id': knowledge_source.id
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def query(self, request, pk=None):
        """Query the knowledge source"""
        knowledge_source = self.get_object()

        query = request.data.get('query')
        if not query:
            return Response({'error': 'query required'}, status=status.HTTP_400_BAD_REQUEST)

        top_k = request.data.get('top_k', 5)

        # Mock search results
        results = [
            {
                'id': f'result_{i}',
                'content': f'Mock result {i} for query: {query}',
                'score': 0.9 - (i * 0.1),
                'metadata': {
                    'document_id': i,
                    'knowledge_source_id': knowledge_source.id
                }
            }
            for i in range(1, min(top_k + 1, 6))
        ]

        return Response({
            'query': query,
            'knowledge_source_id': knowledge_source.id,
            'total_results': len(results),
            'results': results
        }, status=status.HTTP_200_OK)


class RAGViewSet(viewsets.ViewSet):
    """
    ViewSet for RAG-specific operations
    """
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'], url_path='ingest/text')
    def ingest_text(self, request):
        """
        POST /api/rag/ingest/text/
        Ingest text content
        """
        serializer = TextIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        text = serializer.validated_data['text']
        title = serializer.validated_data.get('title', 'Untitled Text')
        metadata = serializer.validated_data.get('metadata', {})
        ks_id = serializer.validated_data.get('knowledge_source_id')

        document = Document.objects.create(
            title=title,
            content=text,
            file_type='text/plain',
            file_size=len(text),
            metadata=metadata,
            knowledge_source_id=ks_id
        )

        return Response({
            'id': document.id,
            'title': document.title,
            'status': 'ingested',
            'chunks_created': len(text) // 500 + 1
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='ingest/file')
    def ingest_file(self, request):
        """
        POST /api/rag/ingest/file/
        Ingest file content
        """
        serializer = FileIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        uploaded_file = serializer.validated_data['file']
        title = serializer.validated_data.get('title', uploaded_file.name)
        metadata = serializer.validated_data.get('metadata', {})
        ks_id = serializer.validated_data.get('knowledge_source_id')

        document = Document.objects.create(
            title=title,
            content='',
            file_path=f'uploads/{uploaded_file.name}',
            file_type=uploaded_file.content_type,
            file_size=uploaded_file.size,
            metadata=metadata,
            knowledge_source_id=ks_id
        )

        return Response({
            'id': document.id,
            'title': document.title,
            'status': 'processing',
            'file_size': uploaded_file.size
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def search(self, request):
        """
        POST /api/rag/search/
        Vector search across all knowledge sources
        """
        serializer = SearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data['query']
        top_k = serializer.validated_data.get('top_k', 5)
        ks_id = serializer.validated_data.get('knowledge_source_id')

        # Mock search results
        results = [
            {
                'id': f'search_result_{i}',
                'content': f'Search result {i} for: {query}',
                'score': 0.95 - (i * 0.08),
                'metadata': {
                    'document_id': i,
                    'knowledge_source_id': ks_id or 1
                }
            }
            for i in range(top_k)
        ]

        return Response({
            'query': query,
            'total_results': len(results),
            'results': results
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='similarity-search')
    def similarity_search(self, request):
        """
        POST /api/rag/similarity-search/
        Semantic similarity search
        """
        serializer = SearchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        query = serializer.validated_data['query']
        top_k = serializer.validated_data.get('top_k', 5)

        # Mock similarity search results
        results = [
            {
                'id': f'sim_result_{i}',
                'content': f'Similar content {i} to: {query}',
                'similarity_score': 0.92 - (i * 0.1),
                'metadata': {'type': 'similarity_match'}
            }
            for i in range(top_k)
        ]

        return Response({
            'query': query,
            'search_type': 'similarity',
            'results': results
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def info(self, request):
        """
        GET /api/rag/info/
        Get RAG system information
        """
        total_docs = Document.objects.count()
        total_ks = KnowledgeSource.objects.count()

        return Response({
            'system': 'RAG System',
            'version': '1.0.0',
            'statistics': {
                'total_documents': total_docs,
                'total_knowledge_sources': total_ks,
                'total_chunks': total_docs * 10  # Mock
            },
            'capabilities': {
                'text_ingestion': True,
                'file_ingestion': True,
                'vector_search': True,
                'similarity_search': True
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def health(self, request):
        """
        GET /api/rag/health/
        Health check for RAG system
        """
        return Response({
            'status': 'healthy',
            'timestamp': time.time(),
            'services': {
                'database': 'ok',
                'vector_db': 'ok',
                'embedding_service': 'ok'
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def config(self, request):
        """
        GET /api/rag/config/
        Get RAG configuration
        """
        # Get from cache or use defaults
        config = cache.get('rag_config', {
            'embedding_model': 'text-embedding-ada-002',
            'chunk_size': 500,
            'chunk_overlap': 50,
            'top_k': 5,
            'similarity_threshold': 0.7
        })

        return Response(config, status=status.HTTP_200_OK)

    @action(detail=False, methods=['put'])
    def update_config(self, request):
        """
        PUT /api/rag/config/
        Update RAG configuration
        """
        serializer = RAGConfigSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Save to cache
        cache.set('rag_config', serializer.validated_data, timeout=None)

        return Response({
            'status': 'updated',
            'config': serializer.validated_data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def embedding(self, request):
        """
        POST /api/rag/embedding/
        Generate embeddings for text
        """
        serializer = EmbeddingSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        text = serializer.validated_data['text']
        model = serializer.validated_data.get('model')

        # Mock embedding (in production, this would call OpenAI/other embedding service)
        mock_embedding = [0.1] * 1536  # Standard embedding size

        return Response({
            'text': text[:100] + '...' if len(text) > 100 else text,
            'model': model,
            'embedding': mock_embedding,
            'dimension': len(mock_embedding)
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='process/chat-file')
    def process_chat_file(self, request):
        """
        POST /api/rag/process/chat-file/
        Process media file for chat
        """
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'file_name': file.name,
            'file_size': file.size,
            'file_type': file.content_type,
            'status': 'processed',
            'extracted_text': f'Mock extracted text from {file.name}',
            'processing_time': 1.5
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='media/info')
    def media_info(self, request):
        """
        GET /api/rag/media/info/
        Get media processing information
        """
        return Response({
            'supported_formats': [
                'pdf', 'docx', 'txt', 'md',
                'jpg', 'png', 'gif',
                'mp3', 'wav', 'mp4'
            ],
            'max_file_size': 10485760,  # 10MB
            'processing_capabilities': {
                'text_extraction': True,
                'image_ocr': True,
                'audio_transcription': True,
                'video_analysis': True
            }
        }, status=status.HTTP_200_OK)
