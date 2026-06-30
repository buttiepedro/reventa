---
title: Pre Toma + Favoritas con confirmación + Notificaciones in-app
type: feature
status: archived
spec: pre_toma, favorites, notifications
created: 2026-06-21
archived: 2026-06-30
---

# Pre Toma + Favoritas con confirmación + Notificaciones in-app

## Resumen

Tres features interrelacionados: (1) sistema bilateral de conexiones entre concesionarias (como solicitud de amistad), (2) vehículos en estado Pre Toma visibles solo para conexiones confirmadas, (3) notificaciones in-app que informan de todos estos eventos.

## Cambios implementados

### Migración 0005

- `ALTER TYPE vehiclestatus ADD VALUE IF NOT EXISTS 'pre_toma'`
- `company_favorites`: agrega `status VARCHAR(20) DEFAULT 'accepted'` y `requested_by_id UUID FK`; backfill de registros existentes como aceptados
- Crea tabla `notifications`: id, company_id (FK), title, body, entity_type, entity_id (nullable), is_read, created_at
- Crea tabla `pre_toma_interests`: (vehicle_id, company_id) PK compuesta + created_at

### Backend — Modelos

- **`app/models/company_favorite.py`** — campos status y requested_by_id agregados
- **`app/models/notification.py`** — nuevo modelo Notification
- **`app/models/pre_toma_interest.py`** — nuevo modelo PreTomaInterest
- **`app/models/vehicle.py`** — PRE_TOMA = "pre_toma" en VehicleStatus

### Backend — Repositorios y Servicios

- **`app/repositories/company_favorite.py`** — reescrito: get_record (en cualquier dirección), get_confirmed, get_confirmed_ids, get_incoming_pending, get_outgoing_pending, create_request, accept, remove
- **`app/services/favorite.py`** — reescrito: send_request, accept_request, remove, get_confirmed, get_incoming/outgoing_requests; crea Notifications en cada acción
- **`app/repositories/vehicle.py`** — get_pre_toma_by_companies(company_ids)
- **`app/services/vehicle.py`** — _notify_favorites_pre_toma, get_pre_toma_for_company; notifica al crear/cambiar a pre_toma

### Backend — Endpoints

- **`app/api/v1/endpoints/favorites.py`** — GET /favorites, GET /favorites/requests/incoming|outgoing, POST /favorites/{id}, POST /favorites/{id}/accept, DELETE /favorites/{id}
- **`app/api/v1/endpoints/notifications.py`** — GET /, GET /count, POST /read-all, PATCH /{id}/read
- **`app/api/v1/endpoints/vehicles.py`** — GET /pre-toma, POST/DELETE /{id}/interest, GET /{id}/interests
- **`app/api/v1/router.py`** — registra router de notifications

### Frontend

- **`src/services/favoriteService.ts`** — getConfirmed, getIncomingRequests, getOutgoingRequests, sendRequest, acceptRequest, remove
- **`src/services/notificationService.ts`** — list, count, readAll, markRead
- **`src/services/vehicleService.ts`** — listPreToma, addInterest, removeInterest, listInterests
- **`src/components/Layout/Header.tsx`** — badge de notificaciones con polling 30s, dropdown, navlink "Pre Tomas"
- **`src/pages/favorites/Favorites.tsx`** — 4 secciones: recibidas, confirmadas, enviadas, disponibles
- **`src/pages/vehicles/PreTomaFeed.tsx`** — feed de pre tomas de favoritas con toggle "Me interesa"
- **`src/pages/vehicles/MyStock.tsx`** — sección Pre Tomas con modal de interesados y "Publicar en red"
- **`src/pages/vehicles/VehicleForm.tsx`** — opción Pre Toma en campo Estado con info box explicativo
- **`src/App.tsx`** — ruta /vehicles/pre-toma
- **`src/components/ui/Badge.tsx`** — tone "purple" agregado

## Notas técnicas

- La relación en company_favorites sigue siendo PK (company_id=requester, favorite_company_id=recipient); el estado bilateral se determina por `status=accepted`
- Los vehículos pre_toma no aparecen en GET /vehicles (filtra por status=available) — protección natural
- No hay WebSocket ni email; se usa polling cada 30s en el Header para el contador de no leídas
- El enum de PostgreSQL requiere `ADD VALUE IF NOT EXISTS` (no se puede drop/recreate con datos)

## Checklist de verificación

- [x] Solicitud de conexión → notificación para receptor
- [x] Aceptar solicitud → notificación para solicitante
- [x] Pre toma creada → notificación para todas las favoritas confirmadas
- [x] Pre toma visible solo en /vehicles/pre-toma (no en /vehicles ni /marketplace)
- [x] Interés → notificación para dueño
- [x] Dueño ve lista de interesados
- [x] Publicar en red → cambia a available, aparece en marketplace
- [x] Badge de notificaciones en header actualiza en tiempo real (polling)
