---
title: Vehículos y Marketplace (Red de Vehículos)
type: feature
status: archived
spec: vehicles, marketplace
created: 2026-06-05
archived: 2026-06-10
---

# Vehículos y Marketplace

## Resumen

Implementación del módulo de vehículos (stock de cada empresa) y el marketplace (red pública donde todas las concesionarias ven el stock disponible de las demás).

## Cambios implementados

### Backend

- **`app/models/vehicle.py`** — modelo Vehicle completo: marca, modelo, versión, año, km, precio, combustible, transmisión, color, observaciones, fotos (array JSONB), status (available/reserved/sold), company_id FK
- **`app/schemas/vehicle.py`** — VehicleCreate, VehicleUpdate, VehicleRead, VehicleListItem
- **`app/repositories/vehicle.py`** — CRUD + filtros por empresa, texto, precio, año
- **`app/services/vehicle.py`** — lógica de negocio, autorización por company_id
- **`app/api/v1/endpoints/vehicles.py`** — endpoints CRUD, cambio de status, subida de fotos vía S3 (proxied por backend)
- **`app/api/v1/endpoints/marketplace.py`** — GET /marketplace (solo status=available, todas las empresas)
- **Migración 0002** — tabla vehicles

### Frontend

- **`src/pages/vehicles/MyStock.tsx`** — listado del stock propio con filtros y acciones
- **`src/pages/vehicles/VehicleForm.tsx`** — formulario de alta/edición con upload de fotos
- **`src/pages/vehicles/VehicleDetail.tsx`** — vista detalle de un vehículo
- **`src/pages/marketplace/Marketplace.tsx`** — red pública con filtros de búsqueda
- **`src/services/vehicleService.ts`** — servicio API

## S3 Image Upload

Las fotos se suben al backend mediante `multipart/form-data`. El backend las reenvía a S3 con `boto3.upload_fileobj()` y guarda las URLs en el campo `photos` (array JSONB). No hay upload directo browser→S3 para evitar problemas de CORS y exposición de credenciales.

## Checklist de verificación

- [x] CRUD de vehículos por empresa
- [x] Filtros en marketplace (marca, precio, año, búsqueda)
- [x] Upload de fotos (proxy backend)
- [x] Autorización: solo empresa dueña puede editar/eliminar
- [x] Status workflow: available → reserved → sold
