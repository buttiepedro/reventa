---
title: Gestión de Vehículos
status: active
created: 2026-06-10
---

# Gestión de Vehículos

## Purpose

Permitir a las empresas gestionar su inventario de vehículos: crear, editar, cambiar estado y eliminar. Cada vehículo pertenece a una empresa y puede tener múltiples imágenes. Los vehículos tienen un estado que controla su visibilidad en la red.

## Contexto

- Modelo: `Vehicle` con `company_id`, `brand`, `model`, `year`, `version`, `color`, `mileage`, `fuel_type`, `transmission`, `condition`, `body_type`, `price_resale`, `price_public`, `description`, `status`, `external_id`, `share_token`
- Estados: `available` (visible en la red), `reserved`, `sold`, `pre_toma` (solo visible para favoritas confirmadas)
- Imágenes: almacenadas en S3, subidas vía backend proxy (no directo al bucket)
- `share_token`: UUID único para compartir el vehículo públicamente sin autenticación
- `external_id`: identificador externo para deduplicación en sync desde Google Sheets

## Requirements

### Requirement: CRUD de vehículos

Las empresas SHALL gestionar su inventario completo.

#### Scenario: Crear vehículo

- **WHEN** un `company_admin` o `company_user` envía datos válidos a `POST /api/v1/vehicles`
- **THEN** se crea el vehículo con `status=available` (o el indicado) y se devuelve con status 201

#### Scenario: Crear vehículo como Pre Toma

- **WHEN** se crea un vehículo con `status=pre_toma`
- **THEN** se notifica a todas las concesionarias confirmadas (favoritas) de esa empresa

#### Scenario: Editar vehículo ajeno

- **WHEN** un usuario intenta editar un vehículo que no pertenece a su empresa
- **THEN** recibe status 403 (excepto `super_admin`)

#### Scenario: Cambiar estado

- **WHEN** se llama `PATCH /api/v1/vehicles/{id}/status` con un estado válido
- **THEN** el estado cambia y se devuelve el vehículo actualizado

### Requirement: Listado propio

Los usuarios SHALL ver solo sus propios vehículos en "Mi Stock".

#### Scenario: Listado Mi Stock

- **WHEN** se llama `GET /api/v1/vehicles/my`
- **THEN** devuelve todos los vehículos de la empresa del usuario (todos los estados)

### Requirement: Subida de imágenes

Los usuarios SHALL subir imágenes a sus vehículos.

#### Scenario: Upload de imagen

- **WHEN** se envía un archivo a `POST /api/v1/vehicles/{id}/images/upload` (multipart)
- **THEN** el backend sube el archivo a S3 y registra la imagen en la DB
- **AND** devuelve `VehicleImageRead` con URL presignada de visualización

#### Scenario: Imagen primaria

- **WHEN** se llama `PATCH /api/v1/vehicles/{id}/images/{img_id}/primary`
- **THEN** esa imagen se marca como primaria y las demás se desmarcan

### Requirement: Compartir vehículo públicamente

Los vehículos SHALL poder compartirse sin autenticación.

#### Scenario: Vista pública

- **WHEN** se accede a `GET /api/v1/share/{share_token}`
- **THEN** se devuelven los datos públicos del vehículo (sin precios de reventa)

## Implementación

- `app/models/vehicle.py`, `app/models/vehicle_image.py`
- `app/services/vehicle.py`, `app/services/vehicle_image.py`
- `app/repositories/vehicle.py`, `app/repositories/vehicle_image.py`
- `app/api/v1/endpoints/vehicles.py`, `app/api/v1/endpoints/share.py`
- `app/core/s3.py` — upload_fileobj (proxy backend→S3)
- `src/pages/vehicles/MyStock.tsx`, `src/pages/vehicles/VehicleForm.tsx`
- `src/components/vehicles/ImageUploader.tsx`
