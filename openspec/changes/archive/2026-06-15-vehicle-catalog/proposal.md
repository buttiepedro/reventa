---
title: Catálogo de Vehículos con carapi.app
type: feature
status: archived
spec: vehicle_catalog
created: 2026-06-15
archived: 2026-06-18
---

# Catálogo de Vehículos con carapi.app

## Resumen

Catálogo centralizado de marcas, modelos y motorizaciones con sincronización desde carapi.app. El formulario de alta de vehículos usa desplegables en cascada en lugar de texto libre.

## Cambios implementados

### Backend

- **`app/models/catalog.py`** — VehicleMake, VehicleModel, VehicleTrim con campos: name, carapi_id (int), is_custom (bool), created_at
- **`app/services/carapi_sync.py`** — run_sync():
  - Marcas: `GET https://carapi.app/api/makes` (público, ~68 marcas)
  - Modelos/trims: requiere JWT de `POST /api/auth/login` con CARAPI_USERNAME + CARAPI_API_TOKEN
  - Upsert por carapi_id; entradas is_custom=true nunca se tocan
  - Si no hay credenciales: solo sync de marcas
- **`app/api/v1/endpoints/catalog.py`**:
  - GET /catalog/makes, GET /catalog/models?make_id=, GET /catalog/trims?model_id= — todos autenticados
  - POST /catalog/makes|models|trims — solo super_admin
  - DELETE /catalog/makes|models|trims — solo super_admin (CASCADE)
  - POST /catalog/sync → 202 + background task
- **Migración 0004** — tablas vehicle_makes, vehicle_models, vehicle_trims

### Frontend

- **`src/services/catalogService.ts`** — getsMakes(), getModels(makeId), getTrims(modelId), sync()
- **`src/pages/admin/Catalog.tsx`** — panel admin con tabs Marcas / Modelos / Motorizaciones + botón sync
- **`src/pages/vehicles/VehicleForm.tsx`** — cascading selects: al elegir marca se cargan modelos, al elegir modelo se cargan trims; opción "Otro (especificar...)" habilita campo texto libre

## Notas técnicas

- Los vehículos siguen guardando brand/model/version como strings (sin FK al catálogo) → backward compatible
- `values_callable=lambda x: [e.value for e in x]` en columnas enum para asyncpg
- El sync corre en background (asyncio task) para no bloquear la petición HTTP

## Checklist de verificación

- [x] Cascading selects en formulario de vehículo
- [x] Valor personalizado "Otro" con campo libre
- [x] Sync de marcas públicas sin credenciales
- [x] Sync completo con credenciales carapi.app
- [x] CRUD manual solo para super_admin
- [x] Edición de vehículo existente pre-carga los selects correctamente
