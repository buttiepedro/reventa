---
title: Catálogo de Vehículos (Marcas / Modelos / Motorizaciones)
status: active
created: 2026-06-15
---

# Catálogo de Vehículos (Marcas / Modelos / Motorizaciones)

## Purpose

Proveer un catálogo centralizado de marcas, modelos y motorizaciones para que los formularios de vehículos usen desplegables en cascada en lugar de texto libre. El catálogo se puede gestionar manualmente por el super admin o sincronizarse automáticamente desde carapi.app.

## Contexto

- Tablas: `vehicle_makes`, `vehicle_models`, `vehicle_trims`
- Los vehículos siguen guardando `brand`, `model`, `version` como strings — sin FK al catálogo (backward compatible)
- El catálogo solo alimenta los dropdowns; no rompe datos existentes
- `is_custom=true` marca entradas creadas manualmente (nunca se eliminan en el sync)
- `carapi_id` (integer) es el ID en la API de carapi.app; usado para upsert en sync
- Endpoint público de carapi.app: `GET /api/makes` (no requiere auth, ~68 marcas)
- Modelos y motorizaciones requieren JWT: `POST /api/auth/login` con `CARAPI_USERNAME` + `CARAPI_API_TOKEN`

## Requirements

### Requirement: Lectura del catálogo

Todos los usuarios autenticados SHALL consultar el catálogo para alimentar los formularios.

#### Scenario: Listar marcas

- **WHEN** se llama `GET /api/v1/catalog/makes`
- **THEN** devuelve todas las marcas ordenadas por nombre

#### Scenario: Listar modelos por marca

- **WHEN** se llama `GET /api/v1/catalog/models?make_id={uuid}`
- **THEN** devuelve los modelos de esa marca

#### Scenario: Listar motorizaciones por modelo

- **WHEN** se llama `GET /api/v1/catalog/trims?model_id={uuid}`
- **THEN** devuelve las motorizaciones de ese modelo

### Requirement: Gestión manual (super admin)

El `super_admin` SHALL crear, editar y eliminar entradas del catálogo.

#### Scenario: Crear marca personalizada

- **WHEN** el `super_admin` envía `{ name }` a `POST /api/v1/catalog/makes`
- **THEN** se crea con `is_custom=true`

#### Scenario: Eliminar marca con modelos

- **WHEN** se elimina una marca
- **THEN** sus modelos y motorizaciones se eliminan en CASCADE

#### Scenario: Acceso denegado a roles no super_admin

- **WHEN** un `company_admin` intenta crear/editar/eliminar entradas del catálogo
- **THEN** recibe status 403

### Requirement: Sincronización desde carapi.app

El `super_admin` SHALL disparar una sincronización del catálogo desde carapi.app.

#### Scenario: Sync sin credenciales

- **WHEN** no hay `CARAPI_USERNAME` / `CARAPI_API_TOKEN` configurados
- **THEN** solo se sincronizan las marcas (endpoint público)
- **AND** los modelos/trims no se actualizan

#### Scenario: Sync completo con credenciales

- **WHEN** hay credenciales válidas configuradas
- **THEN** se sincronizan marcas, modelos y motorizaciones
- **AND** las entradas `is_custom=true` nunca se eliminan

#### Scenario: Sync en background

- **WHEN** se llama `POST /api/v1/catalog/sync`
- **THEN** recibe status 202 inmediatamente
- **AND** la sincronización corre en background sin bloquear

### Requirement: Formulario con cascading selects

El formulario de vehículos SHALL usar desplegables en cascada para marca/modelo/motorización.

#### Scenario: Selección en cascada

- **WHEN** el usuario elige una marca
- **THEN** se cargan los modelos de esa marca; al elegir modelo se cargan las motorizaciones

#### Scenario: Valor personalizado

- **WHEN** el usuario elige "Otro (especificar...)"
- **THEN** aparece un campo de texto libre; el valor ingresado se guarda como string en el vehículo

#### Scenario: Vehículo existente en edición

- **WHEN** se edita un vehículo cuyos valores están en el catálogo
- **THEN** los selects se pre-cargan con los valores correspondientes

## Implementación

- `app/models/catalog.py` — VehicleMake, VehicleModel, VehicleTrim
- `app/services/carapi_sync.py` — run_sync(), _get_jwt(), _fetch_all()
- `app/api/v1/endpoints/catalog.py` — CRUD y sync endpoints
- `src/services/catalogService.ts`
- `src/pages/admin/Catalog.tsx` — admin con tabs Marcas / Modelos / Motorizaciones
- `src/pages/vehicles/VehicleForm.tsx` — cascading selects
