FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (including FFmpeg)
RUN apt-get update && apt-get install -y \
    gcc \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

CMD ["python", "/app/workers/video_renderer.py"]
