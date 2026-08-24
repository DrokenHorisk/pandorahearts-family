# backend/Dockerfile
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api ./api
COPY scripts ./scripts

EXPOSE 8000

CMD ["sh", "-c", "python -u scripts/run_migrations.py && uvicorn api.main:app --host 0.0.0.0 --port 8000"]