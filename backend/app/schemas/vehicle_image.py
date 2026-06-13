import uuid

from pydantic import BaseModel


class VehicleImageRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    s3_key: str
    url: str
    display_order: int
    is_primary: bool


class VehicleImageCreate(BaseModel):
    s3_key: str
    display_order: int = 0
    is_primary: bool = False


class UploadUrlResponse(BaseModel):
    upload_url: str
    s3_key: str
