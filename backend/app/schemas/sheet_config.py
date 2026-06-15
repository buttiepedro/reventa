from datetime import datetime

from pydantic import BaseModel


class SheetConfigUpsert(BaseModel):
    sheet_url: str
    column_mapping: dict[str, str]
    has_header_row: bool = True


class SheetConfigRead(BaseModel):
    sheet_url: str
    column_mapping: dict[str, str]
    has_header_row: bool
    last_synced_at: datetime | None


class SheetPreviewRequest(BaseModel):
    url: str
    has_header_row: bool = True


class SheetPreviewResponse(BaseModel):
    columns: list[str]
    headers: list[str]
    sample_rows: list[list[str]]


class SyncResult(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: list[str]
