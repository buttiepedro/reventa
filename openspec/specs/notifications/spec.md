---
title: Notificaciones In-App
status: active
created: 2026-06-21
---

# Notificaciones In-App

## Purpose

Proveer un sistema de notificaciones in-app para que las concesionarias sean informadas de eventos relevantes: solicitudes de conexión, aceptaciones, nuevas Pre Tomas de favoritas e interesados en sus Pre Tomas.

## Contexto

- Modelo: `Notification` con `company_id` (destinatario), `title`, `body`, `entity_type`, `entity_id`, `is_read`, `created_at`
- `entity_type` values: `favorite_request`, `favorite_accepted`, `pre_toma`, `pre_toma_interest`
- Se crean desde los servicios (no hay endpoints de creación directa)
- El frontend hace polling cada 30 segundos del contador de no leídas
- El `super_admin` no recibe notificaciones (no tiene empresa)

## Triggers automáticos

| Evento | Destinatario | entity_type |
|--------|-------------|-------------|
| Solicitud de conexión enviada | Empresa receptora | `favorite_request` |
| Solicitud de conexión aceptada | Empresa solicitante | `favorite_accepted` |
| Vehículo creado/cambiado a pre_toma | Todas las favoritas confirmadas | `pre_toma` |
| Interés marcado en pre_toma | Empresa dueña del vehículo | `pre_toma_interest` |

## Requirements

### Requirement: Consulta de notificaciones

Los usuarios SHALL consultar sus notificaciones.

#### Scenario: Listar notificaciones

- **WHEN** se llama `GET /api/v1/notifications`
- **THEN** devuelve las últimas 30 notificaciones de la empresa del usuario, ordenadas por fecha DESC

#### Scenario: Contar no leídas

- **WHEN** se llama `GET /api/v1/notifications/count`
- **THEN** devuelve `{ unread: N }` con el conteo de no leídas

### Requirement: Marcar como leídas

Los usuarios SHALL marcar notificaciones como leídas.

#### Scenario: Marcar todas como leídas

- **WHEN** se llama `POST /api/v1/notifications/read-all`
- **THEN** todas las notificaciones de la empresa se marcan como `is_read=true`

#### Scenario: Marcar una como leída

- **WHEN** se llama `PATCH /api/v1/notifications/{id}/read`
- **THEN** esa notificación específica se marca como leída

### Requirement: Badge en header

El frontend SHALL mostrar visualmente cuántas notificaciones no leídas hay.

#### Scenario: Badge activo

- **WHEN** hay notificaciones no leídas
- **THEN** aparece un badge rojo con el conteo sobre el ícono de campana en el header

#### Scenario: Navegación desde notificación

- **WHEN** el usuario hace click en una notificación
- **THEN** se marca como leída y navega a la entidad correspondiente (favoritas o pre tomas)

## Implementación

- `app/models/notification.py` — Notification
- `app/api/v1/endpoints/notifications.py` — GET, GET /count, POST /read-all, PATCH /{id}/read
- `app/services/favorite.py` — _create_notification (solicitudes y aceptaciones)
- `app/services/vehicle.py` — _notify_favorites_pre_toma
- `app/api/v1/endpoints/vehicles.py` — notificación en add_interest
- `src/services/notificationService.ts`
- `src/components/Layout/Header.tsx` — badge con polling cada 30s y dropdown
