---
title: Conexiones entre Concesionarias (Favoritas)
status: active
created: 2026-06-21
---

# Conexiones entre Concesionarias (Favoritas)

## Purpose

Permitir que las concesionarias se conecten bilateralmente mediante un modelo de solicitud de amistad. Las conexiones confirmadas determinan quién puede ver los vehículos en Pre Toma y qué vehículos aparecen primero en la red.

## Contexto

- Modelo: `CompanyFavorite` con `(company_id, favorite_company_id)` como PK compuesta
- Campos adicionales: `status` (`pending` | `accepted`), `requested_by_id`
- La relación es bilateral: ambas partes deben confirmar
- Las conexiones confirmadas habilitan: ver Pre Tomas + aparecer primero en la red
- El `super_admin` no tiene empresa y no puede usar el sistema de favoritas

## Requirements

### Requirement: Envío de solicitud de conexión

Una empresa SHALL enviar solicitudes a otras empresas para conectarse.

#### Scenario: Envío exitoso

- **WHEN** una empresa llama `POST /api/v1/favorites/{company_id}`
- **THEN** se crea un registro con `status=pending`
- **AND** se envía una notificación in-app a la empresa receptora

#### Scenario: Ya conectadas

- **WHEN** se intenta enviar una solicitud a una empresa ya confirmada
- **THEN** recibe status 409

#### Scenario: Solicitud duplicada pendiente

- **WHEN** ya existe una solicitud pendiente en cualquier dirección
- **THEN** recibe status 409

#### Scenario: Solicitarse a sí mismo

- **WHEN** una empresa intenta conectarse consigo misma
- **THEN** recibe status 400

### Requirement: Confirmación de solicitud

Las empresas SHALL aceptar o rechazar solicitudes entrantes.

#### Scenario: Aceptar solicitud

- **WHEN** la empresa receptora llama `POST /api/v1/favorites/{from_id}/accept`
- **THEN** el `status` cambia a `accepted`
- **AND** se envía notificación a la empresa que solicitó

#### Scenario: Rechazar/cancelar solicitud

- **WHEN** se llama `DELETE /api/v1/favorites/{company_id}`
- **THEN** se elimina el registro (tanto si era pending como accepted)

### Requirement: Consulta de conexiones

Los usuarios SHALL ver sus conexiones y solicitudes pendientes.

#### Scenario: Listar confirmadas

- **WHEN** se llama `GET /api/v1/favorites`
- **THEN** devuelve solo las conexiones con `status=accepted`

#### Scenario: Listar solicitudes entrantes

- **WHEN** se llama `GET /api/v1/favorites/requests/incoming`
- **THEN** devuelve solicitudes pendientes donde la empresa actual es receptora

#### Scenario: Listar solicitudes enviadas

- **WHEN** se llama `GET /api/v1/favorites/requests/outgoing`
- **THEN** devuelve solicitudes pendientes enviadas por la empresa actual

## Implementación

- `app/models/company_favorite.py` — status, requested_by_id
- `app/repositories/company_favorite.py` — get_confirmed, get_confirmed_ids, create_request, accept, remove
- `app/services/favorite.py` — send_request, accept_request, remove, get_confirmed, get_incoming/outgoing_requests
- `app/api/v1/endpoints/favorites.py`
- `src/services/favoriteService.ts`
- `src/pages/favorites/Favorites.tsx` — 3 secciones: recibidas, confirmadas, enviadas
