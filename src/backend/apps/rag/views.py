from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Document, KnowledgeSource
from .serializers import DocumentSerializer, KnowledgeSourceSerializer


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = DocumentSerializer

    def get_queryset(self):
        return Document.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class KnowledgeSourceViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = KnowledgeSourceSerializer

    def get_queryset(self):
        return KnowledgeSource.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def upload_document(self, request, pk=None):
        """Upload a document to the knowledge source"""
        # TODO: Implement document upload and vectorization
        return Response({'message': 'Document upload to be implemented'})

    @action(detail=True, methods=['post'])
    def query(self, request, pk=None):
        """Query the knowledge source"""
        query = request.data.get('query')
        if not query:
            return Response({'error': 'query required'}, status=status.HTTP_400_BAD_REQUEST)

        # TODO: Implement RAG query
        return Response({'message': 'RAG query to be implemented'})
