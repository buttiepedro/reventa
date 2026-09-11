FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8100

# Bind on :: rather than 0.0.0.0: Railway's private network is IPv6-only, and an
# IPv4-only socket is unreachable from the other services. Dual-stack, so plain
# IPv4 (docker compose, local) keeps working.
CMD ["sh", "-c", "uvicorn app.main:app --host :: --port ${PORT:-8100}"]
