---
title: Sincronización desde Google Sheets
type: feature
status: archived
spec: sheet_sync
created: 2026-06-12
archived: 2026-06-14
---

# Sincronización desde Google Sheets

## Resumen

Permite a las empresas vincular una Google Spreadsheet pública para importar su stock de vehículos con mapeo de columnas configurable y deduplicación por `external_id`.

## Cambios implementados

### Backend

- **`app/models/sheet_config.py`** — CompanySheetConfig: sheet_url, column_mapping (JSONB), has_header_row, last_synced_at
- **`app/models/vehicle.py`** — campo external_id (String 200, UNIQUE por empresa) para deduplicación
- **`app/services/sheet_sync.py`** — SheetSyncService:
  - `preview()`: descarga CSV de la URL de exportación de Google Sheets y devuelve columnas + primeras filas
  - `sync()`: itera filas, upsert por external_id, retorna `{created, updated, skipped, errors}`
  - Normalización de enums: "Automático" → "automatic", "Gasolina" → "gasoline", etc.
- **`app/api/v1/endpoints/sheet.py`** — GET/PUT /config, POST /preview, POST /sync
- **Migración 0003** — tabla company_sheet_configs, columna external_id en vehicles

### Frontend

- **`src/services/sheetService.ts`** — servicio API
- **`src/pages/vehicles/SheetSync.tsx`** — wizard 2 pasos: URL + mapeo de columnas
- **`src/pages/vehicles/MyStock.tsx`** — botones "Vincular hoja" / "Sincronizar hoja"

## Notas técnicas

- La URL de exportación se construye como `https://docs.google.com/spreadsheets/d/{id}/export?format=csv`
- Las fotos NO se modifican durante el sync
- Registros con `is_custom=true` en el catálogo nunca se eliminan en el sync del catálogo (feature separado)
- Si no hay `external_id` mapeado, cada sync crea nuevos registros sin deduplicación

## Checklist de verificación

- [x] Configuración guardada por empresa
- [x] Preview correcto antes de mapear
- [x] Sync con deduplicación por external_id
- [x] Resumen de resultados (created/updated/skipped/errors)
- [x] Errores por fila no detienen el sync completo
