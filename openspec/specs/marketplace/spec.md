---
title: Marketplace / Red de Vehículos
status: active
created: 2026-06-10
---

# Marketplace / Red de Vehículos

## Purpose

Proveer un catálogo de vehículos disponibles en toda la red de concesionarias. Los usuarios pueden buscar y filtrar vehículos de otras empresas. Los vehículos de favoritas confirmadas aparecen primero. Solo se muestran vehículos con `status=available`.

## Contexto

- Solo vehículos con `status=available` aparecen en la red
- Orden: favoritas primero, luego por `created_at DESC`
- Paginación: `page` y `page_size` (máx 100)
- Los `pre_toma` nunca aparecen en la red general (tienen su propio endpoint)

## Requirements

### Requirement: Listado de la red

Los usuarios autenticados SHALL ver vehículos disponibles en toda la red.

#### Scenario: Listado sin filtros

- **WHEN** se llama `GET /api/v1/vehicles`
- **THEN** devuelve vehículos `available` paginados, con los de favoritas confirmadas primero

#### Scenario: Filtrado por marca/modelo

- **WHEN** se envían parámetros `brand` y/o `model`
- **THEN** se filtran por `ILIKE` (case-insensitive, búsqueda parcial)

#### Scenario: Filtrado por rango de año

- **WHEN** se envían `year_min` y/o `year_max`
- **THEN** solo devuelve vehículos cuyo `year` está dentro del rango

#### Scenario: Filtrado por empresa

- **WHEN** se envía `company_id`
- **THEN** solo devuelve vehículos de esa empresa

### Requirement: Detalle de vehículo

Los usuarios SHALL ver el detalle completo de cualquier vehículo de la red.

#### Scenario: Ver detalle

- **WHEN** se llama `GET /api/v1/vehicles/{id}`
- **THEN** devuelve el vehículo con imágenes (URLs presignadas) y nombre de empresa

### Requirement: Visibilidad según empresa

Solo los usuarios con empresa pueden acceder a la red.

#### Scenario: super_admin sin empresa intenta ver la red

- **WHEN** un `super_admin` llama `GET /api/v1/vehicles`
- **THEN** recibe status 403 (no tiene contexto de empresa)

## Implementación

- `app/repositories/vehicle.py` — get_network_list con ordenamiento y filtros
- `app/services/vehicle.py` — get_network_list, get_detail
- `app/api/v1/endpoints/vehicles.py`
- `src/pages/vehicles/NetworkCatalog.tsx`
- `src/pages/vehicles/VehicleDetail.tsx`
