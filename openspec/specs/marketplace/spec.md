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

### Requirement: Avisos por coincidencia de Radar

Cuando un vehículo se vuelve una oportunidad, el sistema SHALL avisarle a las
agencias que lo estaban buscando.

#### Scenario: Un auto que coincide con el Radar

- **GIVEN** una agencia con una entrada de Radar por marca, y opcionalmente modelo,
  año mínimo, km máximo y precio máximo
- **WHEN** otra agencia publica un vehículo que cumple todo lo que esa entrada especifica
- **THEN** la agencia recibe un aviso que dice que coincide con su Radar

#### Scenario: El modelo matchea sin la versión

- **GIVEN** una entrada de Radar por modelo "Corolla"
- **WHEN** aparece un vehículo cuyo modelo es "Corolla XEI"
- **THEN** coincide, porque el modelo es texto libre y la versión suele venir pegada

#### Scenario: Los límites se respetan

- **WHEN** el vehículo supera el precio máximo, supera los km máximos o es anterior
  al año mínimo de la entrada
- **THEN** no se avisa

#### Scenario: Pre-toma, publicación y liquidación

- **WHEN** un vehículo entra en pre-toma, se publica en la red o pasa a liquidación
- **THEN** en los tres casos se cruza contra los Radares de la red

#### Scenario: La liquidación se cruza contra el precio rebajado

- **GIVEN** una agencia cuyo presupuesto máximo es menor al precio de reventa del vehículo
- **WHEN** ese vehículo pasa a liquidación por debajo de ese presupuesto
- **THEN** se le avisa, porque recién ahí el auto entra en lo que puede pagar

#### Scenario: La dueña no se avisa a sí misma

- **WHEN** el vehículo pertenece a la agencia que tiene la entrada de Radar
- **THEN** no se le avisa

### Requirement: Avisos a las agencias conectadas

Las agencias conectadas SHALL enterarse de las novedades de sus conexiones, con un
texto que diga que llegó por eso.

#### Scenario: Conectada sin Radar

- **WHEN** una agencia conectada publica un vehículo que no coincide con ningún Radar propio
- **THEN** igual se recibe el aviso, identificado como novedad de una conectada

#### Scenario: Conectada y con Radar coincidente

- **WHEN** una agencia califica para los dos avisos por el mismo vehículo
- **THEN** recibe uno solo, el de Radar, que es el que explica mejor por qué le llegó
