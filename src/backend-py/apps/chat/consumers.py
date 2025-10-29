from channels.generic.websocket import AsyncWebsocketConsumer
import json


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        # TODO: Implement WebSocket chat logic
        await self.send(text_data=json.dumps({
            'message': 'WebSocket chat to be implemented'
        }))
