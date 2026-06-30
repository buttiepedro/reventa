---
title: Pre Toma
status: active
created: 2026-06-21
---

# Pre Toma

## Purpose

Cuando una concesionaria recibe un vehículo para toma pero no lo quiere quedar, puede cargarlo como "Pre Toma". El vehículo no se publica en la red general sino que solo es visible para sus concesionarias conectadas (favoritas confirmadas). Si alguna está interesada, lo indica. La dueña de la pre toma decide finalmente si publicarla a toda la red.

## Contexto

- `VehicleStatus.PRE_TOMA = "pre_toma"` — nuevo valor del enum
- Los vehículos `pre_toma` NO aparecen en `GET /api/v1/vehicles` (que filtra por `status=available`)
- `pre_toma_interests` — tabla de intereses: `(vehicle_id, company_id)` PK compuesta
- Al crear/cambiar a `pre_toma`: se generan notificaciones para todas las favoritas confirmadas
- La empresa dueña puede publicar en la red con un cambio de estado a `available`

## Requirements

### Requirement: Creación de Pre Toma

Las empresas SHALL poder crear vehículos directamente en estado Pre Toma.

#### Scenario: Crear con status pre_toma

- **WHEN** se envía `{ ..., status: "pre_toma" }` a `POST /api/v1/vehicles`
- **THEN** se crea el vehículo y se notifica a todas las favoritas confirmadas

#### Scenario: Cambiar status existente a pre_toma

- **WHEN** se actualiza un vehículo a `status=pre_toma` (PATCH o PUT)
- **THEN** se envían notificaciones a todas las favoritas confirmadas (solo si no era ya pre_toma)

### Requirement: Visualización de Pre Tomas disponibles

Las concesionarias conectadas SHALL ver las pre tomas de sus favoritas.

#### Scenario: Listar Pre Tomas

- **WHEN** se llama `GET /api/v1/vehicles/pre-toma`
- **THEN** devuelve vehículos con `status=pre_toma` cuyas empresas son favoritas confirmadas del usuario actual

#### Scenario: Sin favoritas confirmadas

- **WHEN** una empresa no tiene ninguna conexión confirmada
- **THEN** el endpoint devuelve lista vacía

### Requirement: Gestión de interés

Las concesionarias SHALL poder marcar y quitar interés en una Pre Toma.

#### Scenario: Marcar interés

- **WHEN** se llama `POST /api/v1/vehicles/{id}/interest`
- **THEN** se registra el interés y se envía notificación a la empresa dueña

#### Scenario: Vehículo no es Pre Toma

- **WHEN** se intenta marcar interés en un vehículo con otro status
- **THEN** recibe status 400

#### Scenario: Quitar interés

- **WHEN** se llama `DELETE /api/v1/vehicles/{id}/interest`
- **THEN** se elimina el registro de interés

### Requirement: Ver interesados (dueño)

La empresa dueña SHALL ver qué concesionarias están interesadas.

#### Scenario: Listar interesados

- **WHEN** el dueño llama `GET /api/v1/vehicles/{id}/interests`
- **THEN** devuelve lista de empresas interesadas con nombre y fecha

#### Scenario: Acceso denegado

- **WHEN** otra empresa (no dueña, no super_admin) intenta ver los interesados
- **THEN** recibe status 403

### Requirement: Publicar en la red

La empresa dueña SHALL poder publicar la Pre Toma en la red general.

#### Scenario: Publicar

- **WHEN** se cambia el status a `available` via `PATCH /api/v1/vehicles/{id}/status`
- **THEN** el vehículo aparece en `GET /api/v1/vehicles` (red general)

## Implementación

- `app/models/vehicle.py` — VehicleStatus.PRE_TOMA
- `app/models/pre_toma_interest.py` — PreTomaInterest
- `app/services/vehicle.py` — _notify_favorites_pre_toma, get_pre_toma_for_company
- `app/repositories/vehicle.py` — get_pre_toma_by_companies
- `app/api/v1/endpoints/vehicles.py` — GET /pre-toma, POST/DELETE /{id}/interest, GET /{id}/interests
- `src/pages/vehicles/PreTomaFeed.tsx` — feed de pre tomas disponibles
- `src/pages/vehicles/MyStock.tsx` — sección "Pre Tomas" con interesados y botón "Publicar en red"
- `src/pages/vehicles/VehicleForm.tsx` — opción Pre Toma en campo Estado
