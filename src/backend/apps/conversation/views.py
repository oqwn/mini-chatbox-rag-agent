from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.core.cache import cache
from .models import Conversation
from .serializers import ConversationSerializer
from apps.chat.models import Message
from apps.chat.serializers import MessageSerializer
import time


class ConversationViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = ConversationSerializer
    queryset = Conversation.objects.all()
    lookup_field = 'session_id'  # Allow lookup by session_id instead of pk

    def list(self, request):
        """
        GET /api/conversations/
        List all conversations with pagination and stats
        """
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))

        # Get conversations
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        conversations = queryset[offset:offset + limit]

        # Serialize conversations
        serializer = self.get_serializer(conversations, many=True)

        # Get stats
        total_conversations = Conversation.objects.count()
        active_conversations = Conversation.objects.filter(is_archived=False).count()
        archived_conversations = Conversation.objects.filter(is_archived=True).count()
        total_messages = Message.objects.count()
        avg_messages = total_messages / total_conversations if total_conversations > 0 else 0

        return Response({
            'conversations': serializer.data,
            'pagination': {
                'limit': limit,
                'offset': offset,
                'total': total
            },
            'stats': {
                'totalConversations': total_conversations,
                'activeConversations': active_conversations,
                'archivedConversations': archived_conversations,
                'totalMessages': total_messages,
                'averageMessagesPerConversation': round(avg_messages, 2),
                'cacheEntries': 0,
                'totalTokensUsed': 0
            }
        })

    def retrieve(self, request, session_id=None):
        """
        GET /api/conversations/{session_id}/
        Get a specific conversation
        """
        conversation = self.get_object()
        serializer = self.get_serializer(conversation)
        return Response({'conversation': serializer.data})

    def update(self, request, session_id=None):
        """
        PUT /api/conversations/{session_id}/
        Update a conversation
        """
        conversation = self.get_object()
        serializer = self.get_serializer(conversation, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'conversation': serializer.data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def create(self, request):
        """
        POST /api/conversations/
        Create a new conversation
        """
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({'conversation': serializer.data}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['get', 'post'], url_path='messages')
    def messages(self, request, session_id=None):
        """
        GET /api/conversations/{session_id}/messages/
        Get all messages for a conversation

        POST /api/conversations/{session_id}/messages/
        Add a message to a conversation
        """
        if request.method == 'GET':
            conversation = self.get_object()
            messages = Message.objects.filter(conversation_id=conversation.id).order_by('created_at')
            serializer = MessageSerializer(messages, many=True)
            return Response({'messages': serializer.data}, status=status.HTTP_200_OK)

        elif request.method == 'POST':
            # Try to get the conversation, create if it doesn't exist
            conversation_created = False
            try:
                conversation = Conversation.objects.get(session_id=session_id)
            except Conversation.DoesNotExist:
                # Create a new conversation if it doesn't exist
                conversation = Conversation.objects.create(
                    session_id=session_id,
                    title='New Conversation',  # Temporary title, will be updated after first message
                    context_window_size=request.data.get('contextWindowSize', 4000)
                )
                conversation_created = True

            data = request.data.copy()
            data['conversationId'] = conversation.id

            serializer = MessageSerializer(data=data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            serializer.save()

            # Update conversation's last_activity and message count
            conversation.message_count = Message.objects.filter(conversation_id=conversation.id).count()

            # Generate title from first user message using AI
            if conversation_created and data.get('role') == 'user':
                content = data.get('content', '')
                if content:
                    # Generate a title using AI
                    from apps.settings.models import UserSettings
                    import requests
                    import os

                    try:
                        # Get user settings for API key
                        user_id = request.data.get('user_id', 'default_user')
                        settings = UserSettings.objects.get(user_id=user_id)

                        if settings.api_key:
                            base_url = settings.base_url or os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
                            base_url = base_url.rstrip('/')
                            if not base_url.endswith('/v1'):
                                base_url = f"{base_url}/v1"

                            headers = {
                                'Authorization': f'Bearer {settings.api_key}',
                                'Content-Type': 'application/json'
                            }

                            if 'openrouter.ai' in base_url.lower():
                                headers['HTTP-Referer'] = os.getenv('OPENROUTER_REFERER', 'http://localhost:20001')
                                headers['X-Title'] = os.getenv('OPENROUTER_APP_NAME', 'Mini Chatbox')

                            # Request AI to generate a short title
                            payload = {
                                'model': settings.model or 'gpt-3.5-turbo',
                                'messages': [
                                    {
                                        'role': 'system',
                                        'content': 'Generate a concise 3-6 word title for the following question or statement. Only return the title, nothing else.'
                                    },
                                    {
                                        'role': 'user',
                                        'content': content[:500]  # Limit to first 500 chars
                                    }
                                ],
                                'max_tokens': 20,
                                'temperature': 0.5
                            }

                            response = requests.post(
                                f"{base_url}/chat/completions",
                                headers=headers,
                                json=payload,
                                timeout=10
                            )

                            if response.status_code == 200:
                                result = response.json()
                                if result.get('choices') and len(result['choices']) > 0:
                                    ai_title = result['choices'][0]['message']['content'].strip()
                                    # Clean up title - remove quotes if present
                                    ai_title = ai_title.strip('"\'')

                                    if ai_title:  # Only use if not empty
                                        conversation.title = ai_title[:100]  # Limit to 100 chars
                                    else:
                                        # If AI returned empty, use fallback
                                        first_sentence = content.split('.')[0].split('?')[0].split('!')[0]
                                        conversation.title = first_sentence[:50].strip() + ('...' if len(first_sentence) > 50 else '')
                            else:
                                # Fall back to extracting from content
                                first_sentence = content.split('.')[0].split('?')[0].split('!')[0]
                                conversation.title = first_sentence[:50].strip() + ('...' if len(first_sentence) > 50 else '')
                    except Exception as e:
                        # If AI title generation fails, fall back to extracting from content
                        first_sentence = content.split('.')[0].split('?')[0].split('!')[0]
                        conversation.title = first_sentence[:50].strip() + ('...' if len(first_sentence) > 50 else '')

            conversation.save()

            return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='summaries')
    def summaries(self, request, session_id=None):
        """
        GET /api/conversations/{id}/summaries/
        Get conversation summaries
        """
        conversation = self.get_object()

        summaries = {
            'conversation_id': conversation.id,
            'title': conversation.title,
            'memory_summary': conversation.memory_summary,
            'message_count': conversation.message_count,
            'created_at': conversation.created_at,
            'last_activity': conversation.last_activity,
            'summaries': [
                {
                    'id': 1,
                    'type': 'auto',
                    'content': conversation.memory_summary or 'No summary available yet',
                    'created_at': conversation.updated_at,
                    'message_range': f'1-{conversation.message_count}'
                }
            ]
        }

        return Response(summaries, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='summaries')
    def create_summary(self, request, session_id=None):
        """
        POST /api/conversations/{session_id}/summaries/
        Create a new conversation summary
        """
        conversation = self.get_object()

        summary_content = request.data.get('content', '')
        summary_type = request.data.get('type', 'manual')

        # Update the conversation's memory_summary
        conversation.memory_summary = summary_content
        conversation.save()

        summary_data = {
            'id': int(time.time()),
            'conversation_id': conversation.id,
            'type': summary_type,
            'content': summary_content,
            'created_at': time.time(),
            'message_count': conversation.message_count
        }

        return Response(summary_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def prune(self, request, session_id=None):
        """
        POST /api/conversations/{id}/prune/
        Prune old messages from conversation
        """
        conversation = self.get_object()

        keep_count = request.data.get('keep_count', 50)
        min_importance = request.data.get('min_importance', 0.3)

        # Get all messages for this conversation
        all_messages = Message.objects.filter(conversation_id=conversation.id).order_by('-created_at')
        total_messages = all_messages.count()

        if total_messages <= keep_count:
            return Response({
                'pruned_count': 0,
                'remaining_count': total_messages,
                'message': 'No messages to prune'
            }, status=status.HTTP_200_OK)

        # Keep the most recent messages and high importance messages
        messages_to_keep = all_messages[:keep_count]
        messages_to_check = all_messages[keep_count:]

        # Filter out low importance messages
        pruned_count = 0
        for message in messages_to_check:
            if message.importance_score and message.importance_score < min_importance:
                message.delete()
                pruned_count += 1

        # Update conversation message count
        conversation.message_count = Message.objects.filter(conversation_id=conversation.id).count()
        conversation.save()

        return Response({
            'pruned_count': pruned_count,
            'remaining_count': conversation.message_count,
            'original_count': total_messages
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='cache/(?P<cache_key>[^/.]+)')
    def get_cache(self, request, cache_key=None):
        """
        GET /api/conversations/cache/{key}/
        Get cached data
        """
        cached_data = cache.get(f'conversation:{cache_key}')

        if cached_data is None:
            return Response({
                'key': cache_key,
                'exists': False,
                'data': None
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'key': cache_key,
            'exists': True,
            'data': cached_data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='cache/(?P<cache_key>[^/.]+)')
    def set_cache(self, request, cache_key=None):
        """
        POST /api/conversations/cache/{key}/
        Set cached data
        """
        data = request.data.get('data')
        ttl = request.data.get('ttl', 3600)  # Default 1 hour

        cache.set(f'conversation:{cache_key}', data, ttl)

        return Response({
            'key': cache_key,
            'success': True,
            'ttl': ttl
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        GET /api/conversations/stats/
        Get conversation statistics
        """
        total_conversations = Conversation.objects.count()
        active_conversations = Conversation.objects.filter(is_archived=False).count()
        archived_conversations = Conversation.objects.filter(is_archived=True).count()
        starred_conversations = Conversation.objects.filter(is_starred=True).count()

        total_messages = Message.objects.count()

        # Calculate average messages per conversation
        avg_messages = total_messages / total_conversations if total_conversations > 0 else 0

        stats_data = {
            'conversations': {
                'total': total_conversations,
                'active': active_conversations,
                'archived': archived_conversations,
                'starred': starred_conversations
            },
            'messages': {
                'total': total_messages,
                'average_per_conversation': round(avg_messages, 2)
            },
            'activity': {
                'most_recent': Conversation.objects.order_by('-last_activity').first().last_activity if total_conversations > 0 else None,
                'oldest': Conversation.objects.order_by('created_at').first().created_at if total_conversations > 0 else None
            }
        }

        return Response(stats_data, status=status.HTTP_200_OK)
