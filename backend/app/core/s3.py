import asyncio
from functools import lru_cache

import boto3
from botocore.config import Config

from app.core.config import settings

_PRESIGNED_EXPIRY = 3600  # 1 hour


@lru_cache(maxsize=1)
def _client():
    kwargs = dict(
        region_name=settings.aws_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
        config=Config(signature_version="s3v4"),
    )
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client("s3", **kwargs)


def _sync_generate_upload_url(s3_key: str, content_type: str) -> str:
    return _client().generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key, "ContentType": content_type},
        ExpiresIn=_PRESIGNED_EXPIRY,
    )


def _sync_generate_view_url(s3_key: str) -> str:
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key},
        ExpiresIn=_PRESIGNED_EXPIRY,
    )


_CORS_CONFIG = {
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": ["ETag"],
            "MaxAgeSeconds": 3600,
        }
    ]
}


def _sync_ensure_bucket() -> None:
    client = _client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.s3_bucket)
    try:
        client.put_bucket_cors(Bucket=settings.s3_bucket, CORSConfiguration=_CORS_CONFIG)
    except Exception:
        pass  # non-fatal if CORS write fails (e.g. insufficient IAM permissions)


async def generate_upload_url(s3_key: str, content_type: str) -> str:
    return await asyncio.to_thread(_sync_generate_upload_url, s3_key, content_type)


async def upload_fileobj(s3_key: str, data: bytes, content_type: str) -> None:
    import io
    await asyncio.to_thread(
        lambda: _client().upload_fileobj(
            io.BytesIO(data),
            settings.s3_bucket,
            s3_key,
            ExtraArgs={"ContentType": content_type},
        )
    )


async def generate_view_url(s3_key: str) -> str:
    return await asyncio.to_thread(_sync_generate_view_url, s3_key)


async def ensure_bucket() -> None:
    await asyncio.to_thread(_sync_ensure_bucket)


async def delete_object(s3_key: str) -> None:
    await asyncio.to_thread(
        lambda: _client().delete_object(Bucket=settings.s3_bucket, Key=s3_key)
    )
