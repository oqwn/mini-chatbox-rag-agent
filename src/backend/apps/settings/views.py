from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import UserSettings
from .serializers import UserSettingsSerializer, SettingsUpdateSerializer
import os
import requests
import logging

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class SettingsViewSet(viewsets.ViewSet):
    """
    ViewSet for managing user settings
    Provides GET and PUT endpoints for settings management
    """
    permission_classes = [AllowAny]

    def list(self, request):
        """
        GET /api/settings
        Get current user settings in the format expected by frontend
        """
        # For now, use a default user_id. In production, this would come from authentication
        user_id = request.query_params.get('user_id', 'default_user')

        # Get or create settings for the user
        settings, created = UserSettings.objects.get_or_create(
            user_id=user_id,
            defaults={
                'model': 'gpt-4',
                'temperature': 0.7,
                'max_tokens': 2048,
                'top_p': 1.0,
                'rag_enabled': False,
                'theme': 'light',
                'language': 'en'
            }
        )

        # Get RAG configuration from settings
        rag_config = settings.rag_config or {}

        # Format response to match frontend expectations
        response_data = {
            'openai': {
                'isConfigured': bool(settings.api_key),
                'baseUrl': settings.base_url or os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1'),
                'model': settings.model or 'gpt-4',
                'availableModels': self._get_available_models(settings)
            },
            'rag': {
                'embedding': {
                    'model': rag_config.get('embedding', {}).get('model', ''),
                    'endpoint': rag_config.get('embedding', {}).get('endpoint', ''),
                    'isConfigured': bool(rag_config.get('embedding', {}).get('model') or rag_config.get('embedding', {}).get('endpoint'))
                },
                'reranking': {
                    'endpoint': rag_config.get('reranking', {}).get('endpoint', ''),
                    'hasApiKey': bool(rag_config.get('reranking', {}).get('apiKey')),
                    'forceLocal': rag_config.get('reranking', {}).get('forceLocal', ''),
                    'isConfigured': bool(rag_config.get('reranking', {}).get('endpoint'))
                }
            }
        }

        return Response(response_data, status=status.HTTP_200_OK)

    def _get_available_models(self, settings):
        """Get list of available models from API - returns empty list if unable to fetch"""

        # Only try to fetch if we have API key
        if not settings.api_key:
            logger.info("No API key configured, returning empty model list")
            return []

        try:
            base_url = settings.base_url or os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')

            # Normalize base URL - remove trailing slash
            base_url = base_url.rstrip('/')

            # OpenRouter uses a different endpoint structure
            is_openrouter = 'openrouter.ai' in base_url.lower()

            if is_openrouter:
                # OpenRouter's models endpoint
                models_url = "https://openrouter.ai/api/v1/models"
            else:
                # Standard OpenAI-compatible endpoint
                if not base_url.endswith('/v1'):
                    base_url = f"{base_url}/v1"
                models_url = f"{base_url}/models"

            # Fetch models from API
            headers = {
                'Authorization': f'Bearer {settings.api_key}',
                'Content-Type': 'application/json'
            }

            # OpenRouter requires additional headers
            if is_openrouter:
                headers['HTTP-Referer'] = os.getenv('OPENROUTER_REFERER', 'http://localhost:20001')
                headers['X-Title'] = os.getenv('OPENROUTER_APP_NAME', 'Mini Chatbox')

            response = requests.get(
                models_url,
                headers=headers,
                timeout=10
            )

            if response.status_code == 200:
                data = response.json()
                if 'data' in data:
                    # Extract model IDs
                    models = []
                    for model in data['data']:
                        if isinstance(model, dict):
                            model_id = model.get('id', '')
                        else:
                            model_id = str(model)

                        if model_id:
                            models.append(model_id)

                    # For OpenRouter, filter and sort by popularity
                    if is_openrouter:
                        # Filter out non-chat models
                        filtered_models = [m for m in models if not any(x in m.lower() for x in ['embed', 'whisper', 'tts', 'dall-e'])]

                        # Sort by priority/popularity
                        def openrouter_sort_key(model_id):
                            priorities = ['claude-3', 'gpt-4', 'gpt-3.5', 'mixtral', 'llama']
                            for idx, priority in enumerate(priorities):
                                if priority in model_id.lower():
                                    return (idx, model_id)
                            return (len(priorities), model_id)

                        models = sorted(filtered_models, key=openrouter_sort_key) if filtered_models else []

                    else:
                        # For OpenAI and other providers
                        # Filter chat models
                        if 'api.openai.com' in base_url:
                            filtered_models = [m for m in models if 'gpt' in m.lower() and 'instruct' not in m.lower()]
                        else:
                            filtered_models = [m for m in models if any(x in m.lower() for x in ['gpt', 'claude', 'llama', 'mistral', 'gemini', 'deepseek', 'chat'])]

                        # Sort by priority
                        def standard_sort_key(model_id):
                            priorities = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'claude-3', 'llama']
                            for idx, priority in enumerate(priorities):
                                if model_id.startswith(priority):
                                    return (idx, model_id)
                            return (len(priorities), model_id)

                        models = sorted(filtered_models, key=standard_sort_key) if filtered_models else sorted(models)

                    logger.info(f"Successfully fetched {len(models)} models from API")
                    return models
            else:
                logger.warning(f"Failed to fetch models from API: {response.status_code}")
                return []

        except requests.exceptions.Timeout:
            logger.warning("Timeout while fetching models from API")
            return []
        except Exception as e:
            logger.error(f"Error fetching models from API: {str(e)}")
            return []

    def update(self, request, pk=None):
        """
        PUT /api/settings/{id} or PUT /api/settings/
        Update user settings with new format from frontend
        """
        user_id = request.data.get('user_id', 'default_user')

        # Get or create settings
        settings, created = UserSettings.objects.get_or_create(user_id=user_id)

        # Handle OpenAI configuration
        if 'openai' in request.data:
            openai_config = request.data['openai']
            if 'apiKey' in openai_config:
                settings.api_key = openai_config['apiKey']
            if 'baseUrl' in openai_config:
                settings.base_url = openai_config['baseUrl']
            if 'model' in openai_config:
                settings.model = openai_config['model']

        # Handle RAG configuration
        if 'rag' in request.data:
            rag_data = request.data['rag']
            rag_config = settings.rag_config or {}

            # Update embedding config
            if 'embedding' in rag_data:
                if 'embedding' not in rag_config:
                    rag_config['embedding'] = {}
                if 'model' in rag_data['embedding']:
                    rag_config['embedding']['model'] = rag_data['embedding']['model']
                if 'endpoint' in rag_data['embedding']:
                    rag_config['embedding']['endpoint'] = rag_data['embedding']['endpoint']

            # Update reranking config
            if 'reranking' in rag_data:
                if 'reranking' not in rag_config:
                    rag_config['reranking'] = {}
                if 'endpoint' in rag_data['reranking']:
                    rag_config['reranking']['endpoint'] = rag_data['reranking']['endpoint']
                if 'apiKey' in rag_data['reranking']:
                    rag_config['reranking']['apiKey'] = rag_data['reranking']['apiKey']
                if 'forceLocal' in rag_data['reranking']:
                    rag_config['reranking']['forceLocal'] = rag_data['reranking']['forceLocal']

            settings.rag_config = rag_config

        settings.save()

        return Response({
            'success': True,
            'message': 'Settings updated successfully'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['put'])
    def bulk_update(self, request):
        """
        PUT /api/settings/bulk_update
        Update user settings without requiring an ID in the URL
        """
        return self.update(request, pk=None)

    @action(detail=False, methods=['post'])
    def reset(self, request):
        """
        POST /api/settings/reset
        Reset settings to default values
        """
        user_id = request.data.get('user_id', 'default_user')

        # Delete existing settings
        UserSettings.objects.filter(user_id=user_id).delete()

        # Create new default settings
        settings = UserSettings.objects.create(
            user_id=user_id,
            model='gpt-4',
            temperature=0.7,
            max_tokens=2048,
            top_p=1.0,
            rag_enabled=False,
            theme='light',
            language='en'
        )

        serializer = UserSettingsSerializer(settings)
        return Response(serializer.data, status=status.HTTP_200_OK)
