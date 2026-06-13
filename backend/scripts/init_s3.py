"""
Run once on dev startup to ensure the S3 bucket exists in LocalStack.
Usage: python scripts/init_s3.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.s3 import ensure_bucket


async def main() -> None:
    await ensure_bucket()
    print("S3 bucket ready.")


if __name__ == "__main__":
    asyncio.run(main())
