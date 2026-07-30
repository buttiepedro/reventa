---
title: Semáforo de Honestidad (Sistema de Reputación)
status: proposed
created: 2026-07-29
---

# Semáforo de Honestidad

## Purpose

Sistema de auditoría de reputación post-operación. Cuando se cierra una transacción (oferta aceptada en La Lonja o Pre-Toma tomada), ambas partes pueden calificar si la realidad del vehículo coincidió con lo declarado. El score acumulado se muestra como un semáforo (verde / amarillo / rojo) en el perfil de cada empresa.

Objetivo: desincentiva el engaño en el mercado B2B de autos usados y premia a las agencias honestas con un indicador de confianza visible.

## Conceptos clave

- **Rating**: calificación 1–5 + boolean de "condición coincidió" + comentario opcional
- **Semáforo**: señal visual de reputación (verde / amarillo / rojo) derivada del rating promedio y del porcentaje de condiciones correctas
- **condition_match**: indica si el estado declarado del vehículo coincidió con la realidad al momento de la operación
- **reputation_score**: 0=rojo, 1=amarillo, 2=verde — calculado en tiempo real al recibir una calificación

## Reglas de negocio

- Mínimo 3 calificaciones para mostrar semáforo (sin datos suficientes = gris)
- Verde: avg_rating ≥ 4.0 AND condition_match_rate ≥ 80%
- Amarillo: avg_rating ≥ 3.0 OR condition_match_rate ≥ 60%
- Rojo: el resto
- No se puede calificar la misma operación dos veces
- No se puede calificar a la propia empresa
- Solo partes involucradas en la operación pueden calificarla

## Requirements

### Requirement: Calificar una operación

Los usuarios SHALL poder calificar a la contraparte después de cerrar una operación.

#### Scenario: Calificar oferta aceptada en La Lonja

- **GIVEN** una oferta de La Lonja pasó a `accepted`
- **WHEN** ambas partes reciben la notificación `rating_pending`
- **THEN** pueden abrir el `RatingModal` y enviar calificación via `POST /ratings`

#### Scenario: Anti-duplicado

- **WHEN** se intenta calificar la misma operación por segunda vez
- **THEN** recibe error 409 (UNIQUE constraint en `rating_company_id + operation_type + operation_id`)

#### Scenario: Auto-rating bloqueado

- **WHEN** una empresa intenta calificarse a sí misma
- **THEN** recibe error 400

### Requirement: Visualizar reputación

Las empresas SHALL poder ver su propio semáforo y el de otras empresas.

#### Scenario: Semáforo en Mi Agencia

- **WHEN** el usuario visita Mi Agencia → pestaña Reputación
- **THEN** ve semáforo propio (verde/amarillo/rojo), rating promedio, cantidad de calificaciones y lista de últimas 20 calificaciones

#### Scenario: Sin calificaciones suficientes

- **WHEN** la empresa tiene < 3 calificaciones
- **THEN** el semáforo se muestra en gris con texto "Sin datos suficientes"

#### Scenario: Semáforo en cards de La Lonja

- **WHEN** se lista solicitudes en La Lonja
- **THEN** cada card muestra el `ReputationBadge` de la empresa solicitante

### Requirement: Actualización en tiempo real

El score de reputación SHALL actualizarse al recibir una calificación.

#### Scenario: Recálculo inmediato

- **WHEN** se guarda una calificación via `POST /ratings`
- **THEN** `companies.avg_rating`, `rating_count` y `reputation_score` se actualizan en la misma transacción

## Modelo de datos

### Tabla `company_ratings`

```sql
CREATE TABLE company_ratings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rated_company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  operation_type    TEXT NOT NULL CHECK (operation_type IN ('lonja_offer', 'pre_toma')),
  operation_id      UUID NOT NULL,
  score             SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  condition_match   BOOLEAN NOT NULL,
  comment           TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rating_company_id, operation_type, operation_id)
);
```

### Columnas nuevas en `companies`

```sql
ALTER TABLE companies
  ADD COLUMN avg_rating       NUMERIC(3,2),
  ADD COLUMN rating_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN reputation_score SMALLINT;  -- 0=rojo, 1=amarillo, 2=verde, NULL=sin datos
```

## API nuevos endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| POST | /ratings | Crear calificación |
| GET | /ratings/{company_id} | Obtener resumen + últimas calificaciones |
| GET | /companies/{company_id}/reputation | Solo semáforo + avg (para cards) |

## Relación con otros specs

- [[la_lonja]] — Las operaciones de La Lonja disparan el flujo de calificación
- [[mi_agencia]] — La pestaña "Reputación" en Mi Agencia expone este spec
- [[notifications]] — La notificación `rating_pending` dispara el flujo

## Implementación (pendiente)

- `backend/app/models/company_rating.py` — Modelo CompanyRating
- `backend/app/api/v1/endpoints/ratings.py` — Router `/ratings`
- `backend/alembic/versions/XXXX_company_ratings.py` — Migración
- `frontend/src/components/ReputationBadge.tsx` — Componente semáforo
- `frontend/src/components/RatingModal.tsx` — Modal de calificación
- `frontend/src/pages/agencia/MiAgencia.tsx` — Pestaña Reputación
