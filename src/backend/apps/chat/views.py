from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.http import StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Message
from .serializers import MessageSerializer, ChatRequestSerializer
from apps.settings.models import UserSettings
import json
import time
import os
import requests
import logging

logger = logging.getLogger(__name__)


class ChatViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def create(self, request):
        """
        Basic chat endpoint - POST /api/chat/
        Redirects to send_message for consistency
        """
        return self.send_message(request)

    @action(detail=False, methods=['post'])
    def send_message(self, request):
        """Send a chat message and get AI response"""
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data.get('message')
        conversation_id = serializer.validated_data.get('conversation_id')
        model_name = serializer.validated_data.get('model', 'gpt-4')

        # Mock response - in production, this would call OpenAI/Anthropic
        response_data = {
            'id': 'msg_' + str(int(time.time())),
            'role': 'assistant',
            'content': f'This is a mock response to: {message[:50]}...',
            'model': model_name,
            'conversation_id': conversation_id,
            'created_at': time.time(),
            'metadata': {
                'tokens': 150,
                'finish_reason': 'stop'
            }
        }

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    @method_decorator(csrf_exempt)
    def stream(self, request):
        """
        Streaming chat response - POST /api/chat/stream
        Returns Server-Sent Events (SSE) stream
        """
        serializer = ChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Get message from either 'messages' array or 'message' string
        messages = serializer.validated_data.get('messages', [])
        options = serializer.validated_data.get('options', {})

        # Get model from options
        model = options.get('model', 'gpt-4')

        # Get user settings
        user_id = request.data.get('user_id', 'default_user')

        try:
            settings = UserSettings.objects.get(user_id=user_id)
        except UserSettings.DoesNotExist:
            # Return error if settings not found
            def error_stream():
                yield "[ERROR]: API key not configured. Please configure your settings first."

            response = StreamingHttpResponse(
                error_stream(),
                content_type='text/plain; charset=utf-8'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

        if not settings.api_key:
            def error_stream():
                yield "[ERROR]: API key not configured. Please add your API key in settings."

            response = StreamingHttpResponse(
                error_stream(),
                content_type='text/plain; charset=utf-8'
            )
            response['Cache-Control'] = 'no-cache'
            response['X-Accel-Buffering'] = 'no'
            return response

        # Prepare API request
        base_url = settings.base_url or os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
        base_url = base_url.rstrip('/')
        if not base_url.endswith('/v1'):
            base_url = f"{base_url}/v1"

        headers = {
            'Authorization': f'Bearer {settings.api_key}',
            'Content-Type': 'application/json'
        }

        # Add OpenRouter specific headers if needed
        if 'openrouter.ai' in base_url.lower():
            headers['HTTP-Referer'] = os.getenv('OPENROUTER_REFERER', 'http://localhost:20001')
            headers['X-Title'] = os.getenv('OPENROUTER_APP_NAME', 'Mini Chatbox')

        # Prepare messages for API
        api_messages = []
        for msg in messages:
            api_messages.append({
                'role': msg.get('role', 'user'),
                'content': msg.get('content', '')
            })

        payload = {
            'model': model,
            'messages': api_messages,
            'stream': True,
            'temperature': settings.temperature,
            'max_tokens': settings.max_tokens,
            'top_p': settings.top_p
        }

        def event_stream():
            """Generator function for plain text streaming (like Node.js version)"""
            try:
                # Make streaming request to LLM API
                with requests.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    stream=True,
                    timeout=60
                ) as api_response:

                    if api_response.status_code != 200:
                        error_text = api_response.text
                        logger.error(f"LLM API error: {api_response.status_code} - {error_text}")
                        yield f"[ERROR]: API error: {error_text}"
                        return

                    # Use raw response to get truly unbuffered streaming
                    buffer = b''

                    for byte_chunk in api_response.raw.stream(amt=1, decode_content=True):
                        if not byte_chunk:
                            continue

                        buffer += byte_chunk

                        # Process complete lines (ending with \n)
                        while b'\n' in buffer:
                            line_bytes, buffer = buffer.split(b'\n', 1)

                            if not line_bytes:
                                continue

                            try:
                                line_text = line_bytes.decode('utf-8').strip()
                            except UnicodeDecodeError:
                                continue

                            # Skip empty lines and comments
                            if not line_text or line_text.startswith(':'):
                                continue

                            # Remove 'data: ' prefix
                            if line_text.startswith('data: '):
                                line_text = line_text[6:]

                            # Check for end of stream
                            if line_text.strip() == '[DONE]':
                                return

                            try:
                                # Parse the JSON chunk
                                chunk_data = json.loads(line_text)

                                # Extract content delta
                                choices = chunk_data.get('choices', [])
                                if choices:
                                    delta = choices[0].get('delta', {})
                                    content = delta.get('content', '')
                                    finish_reason = choices[0].get('finish_reason')

                                    if content:
                                        # Yield raw content directly (like Node.js)
                                        yield content

                                    if finish_reason:
                                        return

                            except json.JSONDecodeError as e:
                                logger.warning(f"Failed to parse chunk: {line_text[:100]} - {e}")
                                continue

            except requests.exceptions.Timeout:
                logger.error("LLM API request timeout")
                yield "[ERROR]: Request timeout"

            except Exception as e:
                logger.error(f"Error streaming response: {str(e)}")
                yield f"[ERROR]: {str(e)}"

        response = StreamingHttpResponse(
            streaming_content=event_stream(),
            content_type='text/plain; charset=utf-8',
            status=200
        )
        response['Cache-Control'] = 'no-cache, no-transform'
        response['Connection'] = 'keep-alive'
        response['X-Accel-Buffering'] = 'no'
        # Disable any buffering
        response.streaming = True
        return response

    @action(detail=False, methods=['get'], url_path='test-stream')
    def test_stream(self, request):
        """
        Simple streaming test using SSE format (Server-Sent Events)
        """
        import time

        def sse_stream():
            for i in range(1, 11):
                # SSE format: "data: content\n\n"
                yield f"data: tick {i}\n\n"
                time.sleep(0.1)  # 100ms delay between each chunk

        response = StreamingHttpResponse(
            streaming_content=sse_stream(),
            content_type='text/event-stream',  # SSE content type
            status=200
        )
        response['Cache-Control'] = 'no-cache, no-transform'
        response['X-Accel-Buffering'] = 'no'
        return response

    @action(detail=False, methods=['post'], url_path='test-capabilities')
    def test_capabilities(self, request):
        """
        Test model capabilities - POST /api/chat/test-capabilities
        Actually tests if a model supports function calling by making a real API call
        """
        model = request.data.get('model', 'gpt-4')
        user_id = request.data.get('user_id', 'default_user')

        try:
            # Get user settings for API key and base URL
            settings = UserSettings.objects.get(user_id=user_id)
            if not settings.api_key:
                return Response({
                    'error': 'API key not configured',
                    'supportsFunctionCalling': False,
                    'model': model
                }, status=status.HTTP_400_BAD_REQUEST)

            base_url = settings.base_url or os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
            base_url = base_url.rstrip('/')
            if not base_url.endswith('/v1'):
                base_url = f"{base_url}/v1"

            # Prepare a minimal test request with a tool/function
            test_tool = {
                "type": "function",
                "function": {
                    "name": "get_current_time",
                    "description": "Get the current time",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }

            # Try OpenAI format first (works for OpenAI, OpenRouter, etc.)
            test_payload = {
                "model": model,
                "messages": [{"role": "user", "content": "What time is it?"}],
                "tools": [test_tool],
                "max_tokens": 10,  # Minimal tokens to save cost
                "temperature": 0
            }

            headers = {
                'Authorization': f'Bearer {settings.api_key}',
                'Content-Type': 'application/json'
            }

            # Add OpenRouter specific headers if needed
            if 'openrouter.ai' in base_url.lower():
                headers['HTTP-Referer'] = os.getenv('OPENROUTER_REFERER', 'http://localhost:20001')
                headers['X-Title'] = os.getenv('OPENROUTER_APP_NAME', 'Mini Chatbox')

            # Make the test request
            response = requests.post(
                f"{base_url}/chat/completions",
                headers=headers,
                json=test_payload,
                timeout=30
            )

            # Check if the request was successful
            if response.status_code == 200:
                # Model accepts tools parameter - supports function calling
                logger.info(f"Model {model} supports function calling (200 response)")
                return Response({
                    'supportsFunctionCalling': True,
                    'model': model
                }, status=status.HTTP_200_OK)

            elif response.status_code == 400:
                # Check error message to determine if it's a tool-related error
                error_data = response.json()
                error_message = str(error_data).lower()

                # Some providers return 400 with specific error messages about unsupported features
                if any(x in error_message for x in ['tool', 'function', 'not support', 'unsupported']):
                    logger.info(f"Model {model} does not support function calling (400 with tool error)")
                    return Response({
                        'supportsFunctionCalling': False,
                        'model': model
                    }, status=status.HTTP_200_OK)
                else:
                    # Other 400 errors might be due to different reasons
                    logger.warning(f"Unclear capability for {model}: {error_message}")
                    return Response({
                        'supportsFunctionCalling': None,
                        'model': model,
                        'error': 'Unable to determine capability'
                    }, status=status.HTTP_200_OK)

            else:
                # Unexpected status code
                logger.warning(f"Unexpected response testing {model}: {response.status_code}")
                return Response({
                    'supportsFunctionCalling': None,
                    'model': model,
                    'error': f'Unexpected API response: {response.status_code}'
                }, status=status.HTTP_200_OK)

        except UserSettings.DoesNotExist:
            return Response({
                'error': 'User settings not found',
                'supportsFunctionCalling': False,
                'model': model
            }, status=status.HTTP_400_BAD_REQUEST)

        except requests.exceptions.Timeout:
            logger.error(f"Timeout testing capabilities for {model}")
            return Response({
                'supportsFunctionCalling': None,
                'model': model,
                'error': 'Request timeout'
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error testing capabilities for {model}: {str(e)}")
            return Response({
                'supportsFunctionCalling': None,
                'model': model,
                'error': str(e)
            }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Get chat history for a conversation"""
        conversation_id = request.query_params.get('conversation_id')
        if not conversation_id:
            return Response({'error': 'conversation_id required'}, status=status.HTTP_400_BAD_REQUEST)

        messages = Message.objects.filter(conversation_id=conversation_id)
        serializer = MessageSerializer(messages, many=True)
        return Response(serializer.data)
