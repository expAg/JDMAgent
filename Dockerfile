FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    JDM_CACHE_DIR=/tmp/jdm_cache \
    PORT=7860

WORKDIR /app

# Couches pip cachables : copy requirements en premier
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App
COPY src/ ./src/
COPY app_fastapi.py ./
COPY static/ ./static/
COPY relation_definitions.md ./

# HF Spaces utilise le port 7860 par convention (et le tag `app_port: 7860`
# dans le README frontmatter du repo doit matcher).
EXPOSE 7860

CMD ["uvicorn", "app_fastapi:app", "--host", "0.0.0.0", "--port", "7860"]
