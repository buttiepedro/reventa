---
title: Mi Agencia (Perfil de empresa con métricas y reputación)
status: active
created: 2026-06-30
implemented: 2026-06-30
---

# Mi Agencia

## Purpose

Perfil público + privado de cada empresa en la red. Las agencias pueden ver sus propias métricas de actividad y reputación, y otras agencias pueden ver el perfil de cualquier empresa al interactuar con sus vehículos o solicitudes.

## Conceptos clave

- **CUIT Verificado**: badge verde que indica que el super_admin validó la identidad fiscal de la empresa.
- **Operaciones exitosas**: porcentaje de negociaciones en La Lonja y pre-tomas que resultaron en una transacción.
- **Tiempo promedio de respuesta**: promedio de tiempo entre recibir una oferta/solicitud y responderla.
- **Calificación promedio**: rating 1-5 promediado de las valoraciones recibidas de otras agencias.

## Requirements

### Requirement: Perfil propio

Las agencias SHALL ver y editar su propio perfil.

#### Scenario: Ver Mi Agencia

- **WHEN** se accede a la tab "Mi Agencia"
- **THEN** se muestra: logo, nombre, CUIT, badge verificado si corresponde, stats y stock propio

#### Scenario: Editar perfil

- **WHEN** company_admin edita nombre, logo o descripción
- **THEN** los cambios se reflejan en la vista pública del perfil

### Requirement: Métricas de actividad

El sistema SHALL calcular y mostrar métricas reales de la empresa.

#### Scenario: Vehículos en stock

- Cuenta de vehículos propios con `status=available`

#### Scenario: Operaciones exitosas

- `(solicitudes_cerradas_como_venta + pretomas_aceptadas) / (solicitudes_cerradas_totales + pretomas_cerradas) × 100`
- Se muestra como porcentaje (ej: 98%)

#### Scenario: Tiempo promedio de respuesta

- Promedio en horas entre creación de oferta/match y respuesta de la empresa
- Se muestra como "2.1 hs"

#### Scenario: Calificación promedio

- Promedio de ratings recibidos de otras agencias post-transacción
- Se muestra con una decimal (ej: 4.8)

### Requirement: Badge de verificación

El super_admin SHALL verificar empresas como CUIT válido.

#### Scenario: Verificar empresa

- **WHEN** el super_admin activa `is_verified=true` en una empresa
- **THEN** aparece badge "CUIT Verificado ✓" en su perfil

#### Scenario: Vista pública del badge

- **WHEN** otra agencia ve el perfil de una empresa verificada
- **THEN** ve el badge junto al nombre

### Requirement: Stock visible en el perfil

El perfil SHALL mostrar una preview del stock activo de la empresa.

#### Scenario: Grilla de stock

- **WHEN** se accede a un perfil
- **THEN** se muestra una grilla 2×N de los últimos vehículos disponibles con "Ver todos"

### Requirement: Sistema de calificaciones

Las agencias SHALL poder calificar a otras tras una transacción.

#### Scenario: Calificar tras transacción

- **WHEN** una negociación en La Lonja o Pre Toma se cierra como exitosa
- **THEN** ambas partes pueden dejar una calificación 1-5 con comentario opcional

#### Scenario: Calificación visible

- **WHEN** otra agencia ve el perfil
- **THEN** ve rating promedio + cantidad de operaciones calificadas

## Cambios en el modelo Company

```sql
-- Agregar a companies:
is_verified     BOOLEAN DEFAULT false
logo_url        VARCHAR(500) nullable
description     TEXT nullable
avg_rating      DECIMAL(2,1) nullable   -- desnormalizado para performance
total_ratings   INTEGER DEFAULT 0
```

```sql
-- Nueva tabla:
company_ratings
  id              UUID PK
  rater_id        UUID FK → companies.id     (quien califica)
  ratee_id        UUID FK → companies.id     (calificado)
  rating          SMALLINT  (1-5)
  comment         TEXT nullable
  entity_type     VARCHAR(30)   -- 'lonja_deal', 'pre_toma_deal'
  entity_id       UUID nullable
  created_at      TIMESTAMP
  UNIQUE(rater_id, entity_type, entity_id)  -- una calificación por transacción
```

## Implementación sugerida

- `app/models/company.py` — agregar is_verified, logo_url, description, avg_rating
- `app/models/company_rating.py` — nuevo modelo
- `app/services/company_stats.py` — calcular métricas on-demand
- `app/api/v1/endpoints/agency.py` — GET /agency/me, GET /agency/{id}, POST /agency/rate
- `src/pages/agency/MyAgency.tsx` — vista propia con stats
- `src/pages/agency/AgencyProfile.tsx` — vista pública de otra agencia
- `src/components/ui/AgencyBadge.tsx` — logo + nombre + verified + rating
- `src/components/ui/StatsRow.tsx` — fila de 4 métricas

## Implementación (2026-06-30)

### Estado: Perfil + Radar implementados; Reputación y Verificación pendientes

**Migración 0006** — nuevos campos en `companies`:
`cuit`, `verification_status`, `logo_url`, `description`, `phone`, `lat`, `lng`, `address_text`, `avg_rating`, `total_ratings`

**Nuevas tablas en migración 0006:** `radar_entries`, `company_ratings` (estructura lista, sin endpoints aún)

**Backend:**
- `backend/app/schemas/company.py` — `CompanyProfile`, `CompanyProfileUpdate`, `RadarEntryCreate/Read`
- `backend/app/api/v1/endpoints/companies.py`:
  - `GET /companies/me/profile`
  - `PATCH /companies/me/profile` (exclude_unset=True)
  - `GET /companies/me/radar`
  - `POST /companies/me/radar`
  - `DELETE /companies/me/radar/{entry_id}`

**Frontend:**
- `frontend/src/pages/agency/MyAgency.tsx` — 3 tabs: Perfil | Conexiones | Radar
- Tab Perfil: campos editables (cuit, phone, description, lat, lng, address_text), banner si falta CUIT, link a `/vehicles/my`
- Tab Conexiones: solicitudes entrantes + confirmadas (pendiente de integración con favoritas)
- Tab Radar: lista de entradas + formulario (brand, model, max_km, min_year, max_price)

**No implementado aún:**
- Sistema de calificaciones (tabla existe, sin endpoints ni UI)
- Flujo de verificación CUIT por super_admin (campo verification_status existe)
- Bot de feedback post-transacción
- Upload de logo a S3 desde Mi Agencia
- Stats en tiempo real (vehículos en stock, % operaciones exitosas, tiempo de respuesta)
