"""
Raw ASGI streaming view to bypass Django's StreamingHttpResponse buffering
"""
import time
import asyncio
from django.urls import path


async def test_stream_raw_asgi(scope, receive, send):
    """
    Raw ASGI streaming endpoint - bypasses Django's response system
    """
    if scope['type'] != 'http':
        return

    await send({
        'type': 'http.response.start',
        'status': 200,
        'headers': [
            [b'content-type', b'text/event-stream'],
            [b'cache-control', b'no-cache, no-transform'],
            [b'x-accel-buffering', b'no'],
        ],
    })

    for i in range(1, 11):
        message = f"data: tick {i}\n\n"
        await send({
            'type': 'http.response.body',
            'body': message.encode(),
            'more_body': True,
        })
        await asyncio.sleep(0.1)

    await send({
        'type': 'http.response.body',
        'body': b'',
        'more_body': False,
    })


# URL pattern to add to urls.py
urlpatterns = [
    path('test-stream-raw/', test_stream_raw_asgi, name='test-stream-raw'),
]
