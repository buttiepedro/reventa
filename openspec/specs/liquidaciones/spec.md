---
title: Liquidaciones (Stock Express con TTL 72hs)
status: proposed
created: 2026-06-30
---

# Liquidaciones

## Purpose

Sección del Mercado para vehículos publicados a precio de outlet, con un descuento mínimo garantizado del 15% respecto al precio de referencia de mercado y una vida útil estricta de 72 horas. Pasado el TTL el vehículo se retira automáticamente de Liquidaciones (sin eliminarse del stock).

## Conceptos clave

- **Precio de referencia**: promedio de `price_resale` de vehículos del mismo modelo/año en la red (últimos 90 días), o precio InfoAuto si la red no tiene datos suficientes
- **Regla de admisión**: `precio_liquidacion < precio_referencia × 0.85` (15% por debajo)
- **TTL**: 72 horas desde publicación; cron job cada 15 minutos limpia vencidas
- **Relación con stock**: una Liquidación es una "oferta temporal" sobre un vehículo existente — si el vehículo se vende o se retira del stock, la liquidación queda inactiva automáticamente

## Requirements

### Requirement: Publicar liquidación

Las agencias SHALL poder publicar un vehículo como liquidación con validación de precio.

#### Scenario: Precio válido

- **WHEN** se envía `{ vehicle_id, liquidation_price }` a `POST /api/v1/liquidaciones`
- **AND** `liquidation_price < referencia × 0.85`
- **THEN** se crea la liquidación con `expires_at = now() + 72h`
- **AND** aparece en la tab "Liquidaciones" del Mercado

#### Scenario: Precio no suficientemente bajo

- **WHEN** `liquidation_price >= referencia × 0.85`
- **THEN** el backend rechaza con status 422 y mensaje: "El precio debe estar al menos un 15% por debajo del precio de referencia (USD X.XXX)"

#### Scenario: Vehículo ya en liquidación

- **WHEN** se intenta publicar un vehículo que ya tiene una liquidación activa
- **THEN** se rechaza con 409

#### Scenario: Vehículo no disponible

- **WHEN** `vehicle.status != 'available'`
- **THEN** se rechaza con 400

### Requirement: Visualización

Las agencias SHALL ver liquidaciones activas en el Mercado.

#### Scenario: Tab Liquidaciones

- **WHEN** se accede al tab "Liquidaciones (72hs)"
- **THEN** se listan liquidaciones activas (`expires_at > now()`), ordenadas por distancia geográfica si hay lat/lng disponible

#### Scenario: Countdown visible

- **WHEN** se muestra una card de liquidación
- **THEN** se muestra "⏰ Cierra en Xhs Xmin" calculado en frontend como `expires_at - now()`

#### Scenario: Liquidación vencida

- **WHEN** `expires_at <= now()`
- **THEN** deja de aparecer en el feed sin necesidad de esperar el cron

### Requirement: Expiración automática

El sistema SHALL limpiar liquidaciones vencidas sin intervención manual.

#### Scenario: Cron job

- **GIVEN** un cron job que corre cada 15 minutos (APScheduler o similar)
- **WHEN** encuentra liquidaciones con `expires_at <= now()` y `status='active'`
- **THEN** las marca como `status='expired'` (no elimina el registro para auditoría)

#### Scenario: Vehículo vendido durante liquidación

- **WHEN** `vehicle.status` cambia a `sold` o `reserved`
- **THEN** la liquidación activa de ese vehículo se marca automáticamente como `status='cancelled'`

### Requirement: Gestión propia

Las agencias SHALL administrar sus propias liquidaciones.

#### Scenario: Retirar liquidación

- **WHEN** se llama `DELETE /api/v1/liquidaciones/{id}`
- **THEN** la liquidación se marca como `status='cancelled'`; el vehículo vuelve al stock normal

## Modelo de datos

```sql
liquidaciones
  id                UUID PK
  vehicle_id        UUID FK → vehicles.id ON DELETE CASCADE
  company_id        UUID FK → companies.id ON DELETE CASCADE
  liquidation_price DECIMAL(12,2)  -- precio de liquidación
  reference_price   DECIMAL(12,2)  -- precio referencia al momento de publicar (snapshot)
  status            VARCHAR(20)    -- 'active', 'expired', 'cancelled', 'sold'
  expires_at        TIMESTAMP      -- created_at + 72h
  created_at        TIMESTAMP
  INDEX(status, expires_at)
  INDEX(vehicle_id)
```

## Implementación sugerida

- `app/models/liquidacion.py` — modelo Liquidacion
- `app/services/liquidacion.py` — validación de precio, cálculo de referencia
- `app/services/scheduler.py` — APScheduler con job de limpieza cada 15min
- `app/api/v1/endpoints/liquidaciones.py` — POST, GET (feed), DELETE
- Migration agrega tabla liquidaciones
- `src/pages/marketplace/Mercado.tsx` — tab Liquidaciones con countdown
- `src/components/ui/VehicleCardDark.tsx` — badge countdown
