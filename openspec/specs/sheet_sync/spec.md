---
title: Sincronización desde Google Sheets
status: active
created: 2026-06-12
---

# Sincronización desde Google Sheets

## Purpose

Permitir que las empresas vinculen una Google Spreadsheet pública para importar y actualizar su stock de vehículos automáticamente. El sync actualiza datos de vehículos existentes y crea nuevos, sin tocar las fotos cargadas en la plataforma.

## Contexto

- Configuración por empresa en `company_sheet_configs`: `sheet_url`, `column_mapping` (JSONB), `has_header_row`, `last_synced_at`
- El CSV se obtiene de la URL de exportación de Google Sheets: `https://docs.google.com/spreadsheets/d/{id}/export?format=csv`
- Deduplicación por `external_id` (columna configurable): si existe → UPDATE, si no → CREATE
- Las fotos NO se modifican en el sync (se manejan por separado desde la plataforma)
- Mapeo de columnas configurable: el usuario elige qué columna del sheet corresponde a cada campo
- Normalización de enums en español/inglés (ej: "Automático" → "automatic")
- Solo disponible para usuarios con empresa (no super_admin)

## Requirements

### Requirement: Configuración de la hoja

Las empresas SHALL poder vincular y configurar su Google Sheet.

#### Scenario: Guardar configuración

- **WHEN** se envía `{ sheet_url, column_mapping, has_header_row }` a `PUT /api/v1/sheet/config`
- **THEN** se guarda la configuración y se devuelve con status 200

#### Scenario: Obtener configuración

- **WHEN** se llama `GET /api/v1/sheet/config`
- **THEN** devuelve la configuración actual o 404 si no hay ninguna

### Requirement: Preview del sheet

Las empresas SHALL previsualizar el contenido del sheet antes de mapear columnas.

#### Scenario: Preview exitoso

- **WHEN** se envía `{ sheet_url }` a `POST /api/v1/sheet/preview`
- **THEN** devuelve las columnas detectadas y las primeras filas de datos

#### Scenario: URL inválida o sheet privado

- **WHEN** el sheet no es público o la URL es incorrecta
- **THEN** devuelve error descriptivo

### Requirement: Sincronización de stock

Las empresas SHALL poder sincronizar su stock desde el sheet configurado.

#### Scenario: Sync exitoso

- **WHEN** se llama `POST /api/v1/sheet/sync`
- **THEN** itera las filas del sheet:
  - Si existe un vehículo con ese `external_id` en la empresa → UPDATE
  - Si no existe → CREATE
- **THEN** devuelve `{ created, updated, skipped, errors }`

#### Scenario: Sin identificador único mapeado

- **WHEN** el `column_mapping` no incluye `external_id`
- **THEN** cada sync crea filas nuevas (sin deduplicación)

#### Scenario: Error en fila individual

- **WHEN** una fila tiene datos inválidos (ej: año fuera de rango)
- **THEN** se registra el error y se continúa con las filas restantes

## Implementación

- `app/models/sheet_config.py` — CompanySheetConfig
- `app/models/vehicle.py` — external_id (String 200, nullable, indexed, UNIQUE(company_id, external_id))
- `app/services/sheet_sync.py` — SheetSyncService con preview(), sync(), get_config(), upsert_config()
- `app/api/v1/endpoints/sheet.py` — GET/PUT /config, POST /preview, POST /sync
- `src/services/sheetService.ts`
- `src/pages/vehicles/SheetSync.tsx` — wizard de 2 pasos: URL + mapeo de columnas
- `src/pages/vehicles/MyStock.tsx` — botón "Vincular hoja" / "Sincronizar hoja"
