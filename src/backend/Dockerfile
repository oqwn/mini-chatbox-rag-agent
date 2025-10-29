FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    ffmpeg \
    tesseract-ocr \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app/

RUN mkdir -p /app/uploads
RUN python manage.py collectstatic --noinput || true

EXPOSE 20002

CMD ["daphne", "-b", "0.0.0.0", "-p", "20002", "backend.asgi:application"]
