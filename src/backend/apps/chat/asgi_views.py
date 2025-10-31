"""
Native ASGI view for真正的无缓冲流式传输
Bypasses Django's StreamingHttpResponse buffering
"""
import json
import logging
import os
import requests
from django.conf import settings as django_settings
from django.views.decorators.csrf import csrf_exempt
from apps.settings.models import UserSettings

logger = logging.getLogger(__name__)


@csrf_exempt
async def chat_stream_asgi(scope, receive, send):
    """
    Native ASGI application for chat streaming
    This bypasses Django's response system to achieve true unbuffered streaming
    """
    # Only handle POST requests
    if scope['method'] != 'POST':
        await send({
            'type': 'http.response.start',
            'status': 405,
            'headers': [[b'content-type', b'text/plain']],
        })
        await send({
            'type': 'http.response.body',
            'body': b'Method not allowed',
        })
        return

    # Read request body
    body = b''
    while True:
        message = await receive()
        if message['type'] == 'http.request':
            body += message.get('body', b'')
            if not message.get('more_body'):
                break

    # Parse JSON body
    try:
        data = json.loads(body.decode('utf-8'))
        messages = data.get('messages', [])
        options = data.get('options', {})
        model = options.get('model', 'gpt-4')
        user_id = data.get('user_id', 'default_user')
    except Exception as e:
        await send({
            'type': 'http.response.start',
            'status': 400,
            'headers': [[b'content-type', b'text/plain']],
        })
        await send({
            'type': 'http.response.body',
            'body': f'[ERROR]: Invalid request: {str(e)}'.encode(),
        })
        return

    # Get user settings
    try:
        user_settings = await UserSettings.objects.aget(user_id=user_id)
    except UserSettings.DoesNotExist:
        await send({
            'type': 'http.response.start',
            'status': 200,
            'headers': [
                [b'content-type', b'text/plain; charset=utf-8'],
                [b'cache-control', b'no-cache'],
                [b'x-accel-buffering', b'no'],
            ],
        })
        await send({
            'type': 'http.response.body',
            'body': b'[ERROR]: API key not configured',
        })
        return

    if not user_settings.api_key:
        await send({
            'type': 'http.response.start',
            'status': 200,
            'headers': [
                [b'content-type', b'text/plain; charset=utf-8'],
                [b'cache-control', b'no-cache'],
                [b'x-accel-buffering', b'no'],
            ],
        })
        await send({
            'type': 'http.response.body',
            'body': b'[ERROR]: API key not configured',
        })
        return

    # Prepare API request
    base_url = user_settings.base_url or os.getenv('OPENAI_API_BASE', 'https://api.openai.com/v1')
    base_url = base_url.rstrip('/')
    if not base_url.endswith('/v1'):
        base_url = f"{base_url}/v1"

    headers = {
        'Authorization': f'Bearer {user_settings.api_key}',
        'Content-Type': 'application/json'
    }

    if 'openrouter.ai' in base_url.lower():
        headers['HTTP-Referer'] = os.getenv('OPENROUTER_REFERER', 'http://localhost:20001')
        headers['X-Title'] = os.getenv('OPENROUTER_APP_NAME', 'Mini Chatbox')

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
        'temperature': user_settings.temperature,
        'max_tokens': user_settings.max_tokens,
        'top_p': user_settings.top_p
    }

    # Start HTTP response
    await send({
        'type': 'http.response.start',
        'status': 200,
        'headers': [
            [b'content-type', b'text/plain; charset=utf-8'],
            [b'cache-control', b'no-cache'],
            [b'connection', b'keep-alive'],
            [b'x-accel-buffering', b'no'],
        ],
    })

    # Stream response
    try:
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
                await send({
                    'type': 'http.response.body',
                    'body': f"[ERROR]: API error: {error_text}".encode(),
                })
                return

            buffer = b''
            for byte_chunk in api_response.raw.stream(amt=1, decode_content=True):
                if not byte_chunk:
                    continue

                buffer += byte_chunk

                while b'\n' in buffer:
                    line_bytes, buffer = buffer.split(b'\n', 1)
                    if not line_bytes:
                        continue

                    try:
                        line_text = line_bytes.decode('utf-8').strip()
                    except UnicodeDecodeError:
                        continue

                    if not line_text or line_text.startswith(':'):
                        continue

                    if line_text.startswith('data: '):
                        line_text = line_text[6:]

                    if line_text.strip() == '[DONE]':
                        await send({
                            'type': 'http.response.body',
                            'body': b'',
                            'more_body': False,
                        })
                        return

                    try:
                        chunk_data = json.loads(line_text)
                        choices = chunk_data.get('choices', [])
                        if choices:
                            delta = choices[0].get('delta', {})
                            content = delta.get('content', '')
                            finish_reason = choices[0].get('finish_reason')

                            if content:
                                # Send immediately without buffering
                                await send({
                                    'type': 'http.response.body',
                                    'body': content.encode('utf-8'),
                                    'more_body': True,
                                })

                            if finish_reason:
                                await send({
                                    'type': 'http.response.body',
                                    'body': b'',
                                    'more_body': False,
                                })
                                return

                    except json.JSONDecodeError:
                        continue

    except Exception as e:
        logger.error(f"Error streaming response: {str(e)}")
        await send({
            'type': 'http.response.body',
            'body': f"[ERROR]: {str(e)}".encode(),
            'more_body': False,
        })
