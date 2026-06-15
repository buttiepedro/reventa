import csv
import io
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sheet_config import CompanySheetConfig
from app.models.vehicle import Vehicle, FuelType, Transmission, VehicleCondition, VehicleStatus
from app.schemas.sheet_config import SheetConfigUpsert, SheetPreviewResponse, SyncResult

FUEL_MAP: dict[str, str] = {
    "nafta": "gasoline", "gasolina": "gasoline", "gasoline": "gasoline", "naphtha": "gasoline",
    "diesel": "diesel", "gasoil": "diesel",
    "electrico": "electric", "eléctrico": "electric", "electrica": "electric", "eléctrica": "electric",
    "electric": "electric", "electrico/a": "electric",
    "hibrido": "hybrid", "híbrido": "hybrid", "hybrid": "hybrid",
    "gnc": "gnc", "gas natural": "gnc", "gas natural comprimido": "gnc",
}

TRANSMISSION_MAP: dict[str, str] = {
    "manual": "manual", "mecanica": "manual", "mecánica": "manual", "mecanico": "manual", "mecánico": "manual",
    "automatico": "automatic", "automático": "automatic", "automatic": "automatic",
    "automatica": "automatic", "automática": "automatic",
}

CONDITION_MAP: dict[str, str] = {
    "nuevo": "new", "nueva": "new", "new": "new", "0km": "new", "0 km": "new", "zero km": "new",
    "usado": "used", "usada": "used", "used": "used", "segunda mano": "used", "second hand": "used",
}

STATUS_MAP: dict[str, str] = {
    "disponible": "available", "available": "available", "libre": "available",
    "reservado": "reserved", "reservada": "reserved", "reserved": "reserved",
    "vendido": "sold", "vendida": "sold", "sold": "sold",
}

REQUIRED_FIELDS = ("brand", "model", "year", "color", "mileage", "fuel_type", "transmission", "condition", "price_resale", "price_public")
OPTIONAL_FIELDS = ("version", "body_type", "description", "status", "external_id")


def _extract_sheet_id(url: str) -> str:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", url)
    if not match:
        raise ValueError("URL de Google Sheets inválida. Asegurate de pegar la URL completa.")
    return match.group(1)


def _col_to_idx(col: str) -> int:
    col = col.strip().upper()
    idx = 0
    for ch in col:
        idx = idx * 26 + (ord(ch) - ord("A") + 1)
    return idx - 1


def _get_cell(row: list[str], col_letter: str) -> str:
    try:
        return row[_col_to_idx(col_letter)].strip()
    except IndexError:
        return ""


def _normalize(value: str, mapping: dict[str, str], field_name: str) -> str:
    key = value.strip().lower()
    result = mapping.get(key)
    if result is None:
        raise ValueError(f"Valor '{value}' no reconocido para '{field_name}'")
    return result


async def _fetch_csv(sheet_id: str) -> str:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise ValueError(f"No se pudo acceder a la hoja. ¿Es pública? (HTTP {resp.status_code})")
        return resp.text


def _parse_csv(text: str) -> list[list[str]]:
    reader = csv.reader(io.StringIO(text))
    return [row for row in reader]


def _idx_to_col(idx: int) -> str:
    result = ""
    idx += 1
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        result = chr(ord("A") + rem) + result
    return result


class SheetSyncService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_config(self, company_id: uuid.UUID) -> CompanySheetConfig | None:
        result = await self.session.execute(
            select(CompanySheetConfig).where(CompanySheetConfig.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def upsert_config(self, company_id: uuid.UUID, data: SheetConfigUpsert) -> CompanySheetConfig:
        config = await self.get_config(company_id)
        if config is None:
            config = CompanySheetConfig(company_id=company_id)
            self.session.add(config)
        config.sheet_url = data.sheet_url
        config.column_mapping = data.column_mapping
        config.has_header_row = data.has_header_row
        await self.session.flush()
        await self.session.refresh(config)
        return config

    async def preview(self, url: str, has_header_row: bool) -> SheetPreviewResponse:
        sheet_id = _extract_sheet_id(url)
        text = await _fetch_csv(sheet_id)
        rows = _parse_csv(text)
        if not rows:
            return SheetPreviewResponse(columns=[], headers=[], sample_rows=[])

        num_cols = max(len(r) for r in rows[:5])
        columns = [_idx_to_col(i) for i in range(num_cols)]

        headers: list[str] = []
        data_rows = rows
        if has_header_row and rows:
            headers = rows[0]
            data_rows = rows[1:]

        sample_rows = data_rows[:3]
        return SheetPreviewResponse(columns=columns, headers=headers, sample_rows=sample_rows)

    async def sync(self, company_id: uuid.UUID) -> SyncResult:
        config = await self.get_config(company_id)
        if config is None:
            raise ValueError("No hay hoja vinculada. Configurá la hoja primero.")

        sheet_id = _extract_sheet_id(config.sheet_url)
        text = await _fetch_csv(sheet_id)
        rows = _parse_csv(text)

        mapping: dict[str, str] = config.column_mapping or {}
        data_rows = rows[1:] if config.has_header_row else rows

        created = updated = skipped = 0
        errors: list[str] = []

        for row_num, row in enumerate(data_rows, start=2 if config.has_header_row else 1):
            if not any(c.strip() for c in row):
                continue
            label = f"Fila {row_num}"
            try:
                fields = self._extract_row(row, mapping, label)
                await self._upsert_vehicle(company_id, fields, mapping)
                if fields.get("_was_updated"):
                    updated += 1
                else:
                    created += 1
            except ValueError as exc:
                errors.append(f"{label}: {exc}")
                skipped += 1

        config.last_synced_at = datetime.now(timezone.utc)
        await self.session.flush()

        return SyncResult(created=created, updated=updated, skipped=skipped, errors=errors)

    def _extract_row(self, row: list[str], mapping: dict[str, str], label: str) -> dict:
        fields: dict = {}

        for field in REQUIRED_FIELDS:
            col = mapping.get(field)
            if not col:
                raise ValueError(f"campo requerido '{field}' no está mapeado")
            val = _get_cell(row, col)
            if not val:
                raise ValueError(f"campo requerido '{field}' está vacío")
            fields[field] = val

        for field in OPTIONAL_FIELDS:
            col = mapping.get(field)
            if col:
                fields[field] = _get_cell(row, col) or None

        try:
            fields["year"] = int(fields["year"])
            if not (1900 <= fields["year"] <= 2100):
                raise ValueError("fuera de rango")
        except (ValueError, TypeError):
            raise ValueError(f"año inválido: '{fields['year']}'")

        try:
            fields["mileage"] = int(str(fields["mileage"]).replace(".", "").replace(",", ""))
            if fields["mileage"] < 0:
                raise ValueError("negativo")
        except (ValueError, TypeError):
            raise ValueError(f"kilometraje inválido: '{fields['mileage']}'")

        try:
            fields["price_resale"] = Decimal(str(fields["price_resale"]).replace(".", "").replace(",", "."))
        except InvalidOperation:
            raise ValueError(f"precio_reventa inválido: '{fields['price_resale']}'")

        try:
            fields["price_public"] = Decimal(str(fields["price_public"]).replace(".", "").replace(",", "."))
        except InvalidOperation:
            raise ValueError(f"precio_publico inválido: '{fields['price_public']}'")

        fields["fuel_type"] = FuelType(_normalize(fields["fuel_type"], FUEL_MAP, "combustible"))
        fields["transmission"] = Transmission(_normalize(fields["transmission"], TRANSMISSION_MAP, "transmisión"))
        fields["condition"] = VehicleCondition(_normalize(fields["condition"], CONDITION_MAP, "condición"))

        if fields.get("status"):
            fields["status"] = VehicleStatus(_normalize(fields["status"], STATUS_MAP, "estado"))
        else:
            fields.pop("status", None)

        return fields

    async def _upsert_vehicle(self, company_id: uuid.UUID, fields: dict, mapping: dict[str, str]) -> None:
        external_id: str | None = fields.pop("external_id", None) or None
        was_updated = False

        existing: Vehicle | None = None
        if external_id:
            result = await self.session.execute(
                select(Vehicle).where(
                    Vehicle.company_id == company_id,
                    Vehicle.external_id == external_id,
                )
            )
            existing = result.scalar_one_or_none()

        if existing:
            for key, val in fields.items():
                setattr(existing, key, val)
            existing.external_id = external_id
            self.session.add(existing)
            was_updated = True
        else:
            vehicle = Vehicle(
                company_id=company_id,
                external_id=external_id,
                **fields,
            )
            self.session.add(vehicle)

        fields["_was_updated"] = was_updated
        await self.session.flush()
