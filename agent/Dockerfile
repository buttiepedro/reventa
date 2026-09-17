FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 8100

# 0.0.0.0, not ::. On Railway a :: socket turned out to be IPv6-only, and the
# public edge connects over IPv4, so the service answered 502 to everyone.
# The cost is that Railway's IPv6 private network cannot reach this service:
# point AGENT_BASE_URL at its public domain instead.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8100}"]
