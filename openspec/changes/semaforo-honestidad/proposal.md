---
title: Semáforo de Honestidad — Reputación post-operación
type: feature
status: proposed
spec: semaforo_honestidad
created: 2026-07-29
---

# Semáforo de Honestidad

## Resumen

Sistema de auditoría de reputación post-operación. Cuando se cierra una transacción (oferta aceptada en La Lonja o Pre-Toma tomada), ambas partes pueden calificar si la realidad del vehículo/operación coincidió con lo declarado. El score acumulado se muestra como un semáforo en el perfil de cada empresa.

---

## Motivación

El mercado B2B de autos usados tiene un problema de confianza: las condiciones declaradas raramente se verifican antes de comprometerse. Un sistema de reputación visible desincentiva el engaño y premia a las agencias honestas.

---

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
  condition_match   BOOLEAN NOT NULL,  -- ¿el estado del vehículo coincidió con lo declarado?
  comment           TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rating_company_id, operation_type, operation_id)
);
```

### Campo nuevo en `companies`

```sql
ALTER TABLE companies
  ADD COLUMN avg_rating       NUMERIC(3,2),
  ADD COLUMN rating_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN reputation_score SMALLINT;  -- 0=rojo, 1=amarillo, 2=verde
```

`reputation_score` se recalcula con un trigger o en el endpoint de rating:
- Verde (2): avg_rating ≥ 4.0 AND condition_match_rate ≥ 80% AND rating_count ≥ 3
- Amarillo (1): avg_rating ≥ 3.0 OR condition_match_rate ≥ 60%
- Rojo (0): el resto

---

## API

### POST `/ratings`

```python
class RatingCreate(BaseModel):
    rated_company_id: uuid.UUID
    operation_type: Literal["lonja_offer", "pre_toma"]
    operation_id: uuid.UUID
    score: int  # 1–5
    condition_match: bool
    comment: str | None = None
```

Validaciones:
- `rating_company_id` = `current_user.company_id` (no auto-rating)
- La operación debe existir y estar en estado `accepted` / `sold`
- La operación debe involucrar a `current_user.company_id` como una de las partes
- No se puede calificar dos veces la misma operación

Al guardar, recalcula `avg_rating`, `rating_count` y `reputation_score` en `companies` para la empresa calificada.

### GET `/ratings/{company_id}`

Devuelve las últimas 20 calificaciones recibidas (para el perfil de Mi Agencia).

```python
class RatingSummary(BaseModel):
    avg_rating: float | None
    rating_count: int
    reputation_score: int | None  # 0/1/2
    recent: list[RatingItem]
```

### GET `/companies/{company_id}/reputation`

Devuelve solo el semáforo y avg_rating (para mostrar en cards de mercado / Lonja).

---

## Frontend

### Componente `ReputationBadge`

```tsx
// traffic-light icon + avg_rating
// verde: 🟢 / amarillo: 🟡 / rojo: 🔴 / gris: sin datos
<ReputationBadge score={company.reputation_score} avg={company.avg_rating} count={company.rating_count} />
```

Aparece en:
- Cards de La Lonja (junto al nombre de la empresa solicitante)
- Perfil de Mi Agencia → pestaña "Reputación"
- Modal de ofertas recibidas en La Lonja
- VehicleCard en Mercado (si se decide exponer reputación ahí)

### Flujo de calificación

1. Cuando una oferta de La Lonja pasa a `accepted`, el sistema crea una notificación de tipo `rating_pending` para ambas partes
2. Al tocar la notificación → `RatingModal` (score 1–5 con estrellas, checkbox "¿El vehículo coincidió con lo declarado?", campo opcional de comentario)
3. POST /ratings → toast "Gracias por tu calificación"
4. El modal no vuelve a aparecer si ya calificó (UNIQUE constraint)

### Pestaña "Reputación" en Mi Agencia

```
Semáforo: 🟢 Verde
Rating promedio: 4.7 / 5  (23 calificaciones)
Condición declarada correcta: 91%

[Lista de calificaciones recibidas]
```

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Alembic | Crear tabla `company_ratings` |
| 2 | Alembic | Agregar `avg_rating`, `rating_count`, `reputation_score` a `companies` |
| 3 | Backend | Router `/ratings` con POST y GET |
| 4 | Backend | GET `/companies/{company_id}/reputation` |
| 5 | Backend | Lógica de recálculo de reputation_score |
| 6 | Frontend | Componente `ReputationBadge` |
| 7 | Frontend | `RatingModal` disparado por notificación |
| 8 | Frontend | Pestaña "Reputación" en Mi Agencia |
| 9 | Backend | Notificación `rating_pending` al aceptar oferta / publicar pre-toma |

---

## Acceptance criteria

- [ ] Después de aceptar una oferta de La Lonja, ambas partes reciben notificación para calificar
- [ ] Score 1–5 + checkbox de condición → POST /ratings funciona con validación anti-duplicado
- [ ] `avg_rating` y `reputation_score` se actualizan inmediatamente en `companies`
- [ ] `ReputationBadge` muestra semáforo correcto en Mi Agencia
- [ ] No se puede calificar la misma operación dos veces (error 409)
- [ ] Una empresa no puede calificarse a sí misma (error 400)
- [ ] Con < 3 calificaciones, el semáforo no se muestra (sin datos suficientes)
