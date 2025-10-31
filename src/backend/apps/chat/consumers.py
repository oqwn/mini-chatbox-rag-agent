from channels.generic.websocket import AsyncWebsocketConsumer
import json
import asyncio


class TestStreamConsumer(AsyncWebsocketConsumer):
    """
    Simple WebSocket consumer to test streaming
    """
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        """
        Receive message from WebSocket and start streaming
        """
        data = json.loads(text_data)
        command = data.get('command', '')

        if command == 'start_stream':
            # Stream 10 messages with 0.1s delay
            for i in range(1, 11):
                await self.send(text_data=json.dumps({
                    'type': 'stream',
                    'message': f'tick {i}'
                }))
                await asyncio.sleep(0.1)

            # Send completion message
            await self.send(text_data=json.dumps({
                'type': 'done',
                'message': 'Stream completed'
            }))


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for streaming chat responses
    """
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        """
        Receive chat request and stream LLM response
        """
        import os
        import requests
        from channels.db import database_sync_to_async
        from apps.settings.models import UserSettings
        import logging

        logger = logging.getLogger(__name__)

        try:
            data = json.loads(text_data)
            messages = data.get('messages', [])
            options = data.get('options', {})
            user_id = data.get('user_id', 'default_user')
            model = options.get('model', 'gpt-4')

            # Get user settings
            try:
                settings = await database_sync_to_async(UserSettings.objects.get)(user_id=user_id)
            except UserSettings.DoesNotExist:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'API key not configured. Please configure your settings first.'
                }))
                return

            if not settings.api_key:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'API key not configured. Please add your API key in settings.'
                }))
                return

            # Prepare API request
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

            # Stream response from LLM API using sync_to_async
            from asgiref.sync import sync_to_async
            import queue
            import threading

            # Use a queue to communicate between sync and async
            message_queue = queue.Queue()

            def stream_llm_sync():
                """Run in thread to handle synchronous requests library"""
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
                            message_queue.put({'error': f"API error: {error_text}"})
                            return

                        buffer = b''
                        for byte_chunk in api_response.raw.stream(amt=8192, decode_content=True):
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
                                    message_queue.put({'done': True})
                                    return

                                try:
                                    chunk_data = json.loads(line_text)
                                    choices = chunk_data.get('choices', [])
                                    if choices:
                                        delta = choices[0].get('delta', {})
                                        content = delta.get('content', '')
                                        finish_reason = choices[0].get('finish_reason')

                                        if content:
                                            message_queue.put({'content': content})

                                        if finish_reason:
                                            message_queue.put({'done': True, 'finish_reason': finish_reason})
                                            return

                                except json.JSONDecodeError:
                                    continue

                        message_queue.put({'done': True})

                except Exception as e:
                    logger.error(f"Error in stream_llm_sync: {str(e)}")
                    message_queue.put({'error': str(e)})

            # Start streaming in background thread
            thread = threading.Thread(target=stream_llm_sync)
            thread.start()

            # Read from queue and send to WebSocket
            while True:
                try:
                    # Non-blocking read with timeout
                    chunk = await asyncio.get_event_loop().run_in_executor(
                        None, lambda: message_queue.get(timeout=0.01)
                    )

                    if chunk.get('error'):
                        await self.send(text_data=json.dumps({
                            'type': 'error',
                            'message': chunk['error']
                        }))
                        break

                    if chunk.get('content'):
                        await self.send(text_data=json.dumps({
                            'type': 'content',
                            'delta': chunk['content']
                        }))

                    if chunk.get('done'):
                        await self.send(text_data=json.dumps({
                            'type': 'done',
                            'finish_reason': chunk.get('finish_reason', 'stop')
                        }))
                        break

                except queue.Empty:
                    # Check if thread is still alive
                    if not thread.is_alive():
                        # Thread finished but queue might have items
                        try:
                            chunk = message_queue.get_nowait()
                            if chunk.get('done'):
                                await self.send(text_data=json.dumps({
                                    'type': 'done',
                                    'finish_reason': chunk.get('finish_reason', 'stop')
                                }))
                        except queue.Empty:
                            pass
                        break
                    await asyncio.sleep(0.01)

            thread.join(timeout=1)

        except Exception as e:
            logger.error(f"Error in ChatConsumer: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
