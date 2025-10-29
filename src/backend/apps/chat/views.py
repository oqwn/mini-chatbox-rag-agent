from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import StreamingHttpResponse
from .models import Message
from .serializers import MessageSerializer, ChatRequestSerializer
import json


class ChatViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def send_message(self, request):
        """Send a chat message and get AI response"""
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # TODO: Implement chat logic with OpenAI/Anthropic
        # TODO: Handle streaming responses
        # TODO: Save message to database

        return Response({'message': 'Chat functionality to be implemented'})

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get chat history for a conversation"""
        conversation_id = request.query_params.get('conversation_id')
        if not conversation_id:
            return Response({'error': 'conversation_id required'}, status=status.HTTP_400_BAD_REQUEST)

        messages = Message.objects.filter(conversation_id=conversation_id)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
