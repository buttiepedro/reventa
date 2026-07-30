---
title: Pre-Toma Express (App Móvil)
status: proposed
created: 2026-07-29
---

# Pre-Toma Express — App Móvil con VAPID Push

## Purpose

Segundo frontend completo, orientado 100% a mobile, que permite cargar una Pre-Toma desde el campo en ~30 segundos (3 fotos desde cámara + datos básicos + precio). Se despliega como PWA en un subdominio del dominio principal de la app y recibe notificaciones push vía VAPID.

Este frontend es independiente del frontend principal (`reventa.app`). Comparte el mismo backend API y el mismo sistema de autenticación JWT.

## Conceptos clave

- **Express Upload**: flujo de 3 pasos simplificado para carga de Pre-Tomas desde cámara
- **VAPID Push**: notificaciones web push que llegan al device con la app cerrada
- **PWA**: Progressive Web App instalable en pantalla de inicio, sin app store
- **Subdominio**: `express.{APP_DOMAIN}` — deploy independiente del frontend principal
- **push_subscriptions**: tabla que relaciona usuarios con sus endpoints de suscripción VAPID

## Requirements

### Requirement: Carga express de Pre-Toma

Los captadores SHALL poder publicar una Pre-Toma en ≤ 60 segundos desde el campo.

#### Scenario: Flujo de 3 pasos completo

- **GIVEN** el usuario está autenticado en la app express
- **WHEN** completa fotos (cámara), datos básicos (marca/modelo/año/km/precio) y confirma
- **THEN** se crea un vehículo con `status=pre_toma` y aparece en el frontend principal < 5s

#### Scenario: Fotos desde cámara (no galería)

- **WHEN** el usuario toca el slot de foto
- **THEN** abre directamente la cámara del dispositivo (`capture="environment"`)
- **AND** resize automático a max 1200px / calidad 0.8 antes de upload

### Requirement: Push notifications vía VAPID

Las empresas SHALL recibir notificaciones push en dispositivos móviles para eventos relevantes.

#### Scenario: Nueva Pre-Toma en la red

- **WHEN** una agencia conectada publica una Pre-Toma
- **THEN** las agencias con dispositivos suscritos reciben push notification con el device cerrado

#### Scenario: Match en La Lonja

- **WHEN** `_run_auto_match` detecta stock compatible con una solicitud
- **THEN** la empresa dueña del stock recibe push notification

#### Scenario: Oferta aceptada

- **WHEN** una oferta en La Lonja pasa a `accepted`
- **THEN** la empresa ofertante recibe push notification

#### Scenario: Suscripción al registro

- **WHEN** el usuario acepta el permiso de notificaciones en el navegador
- **THEN** `POST /push/subscribe` guarda endpoint + keys en `push_subscriptions`

#### Scenario: Device inactivo (Gone)

- **WHEN** el endpoint devuelve HTTP 410
- **THEN** la suscripción se elimina automáticamente de `push_subscriptions`

### Requirement: Instalable como PWA

La app express SHALL poder instalarse en la pantalla de inicio del teléfono.

#### Scenario: Instalación

- **WHEN** el usuario visita el subdominio y acepta el prompt de instalación
- **THEN** la app aparece en la pantalla de inicio con icono y splash screen propios

#### Scenario: Caché offline

- **WHEN** el usuario abre la PWA sin conexión
- **THEN** ve la UI cargada (shell), aunque los datos requieren conexión

### Requirement: Autenticación

Los usuarios de la app express SHALL usar las mismas credenciales que el frontend principal.

#### Scenario: Login

- **WHEN** el usuario ingresa email + password en la pantalla de login de la app express
- **THEN** recibe el mismo JWT que usaría en el frontend principal
- **AND** el token persiste en localStorage del subdominio

## Modelo de datos nuevo

### Tabla `push_subscriptions`

```sql
CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

## API nuevos endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| POST | /push/subscribe | Registra suscripción VAPID de un device |
| DELETE | /push/subscribe | Elimina suscripción (logout) |
| POST | /push/test | Envía notificación de prueba (solo admin) |

## Relación con otros specs

- [[pre_toma]] — Este spec extiende el flujo de carga de Pre-Tomas con un canal mobile-first
- [[notifications]] — Las notificaciones VAPID complementan las notificaciones in-app existentes
- [[la_lonja]] — El match automático también dispara push notifications

## Implementación (pendiente)

- `frontend-mobile/` — Nuevo proyecto Vite/React/PWA (independiente)
- `backend/app/api/v1/endpoints/push.py` — Router `/push`
- `backend/app/services/push.py` — `send_push(company_id, title, body, url)`
- `backend/alembic/versions/XXXX_push_subscriptions.py` — Migración
- Variables de entorno: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIM_EMAIL`
