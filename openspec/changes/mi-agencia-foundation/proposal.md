---
title: Mi Agencia Foundation — CUIT Gatekeeper + Radar + Reputación
type: feature
status: proposed
spec: mi_agencia
created: 2026-06-30
---

# Mi Agencia Foundation — CUIT Gatekeeper + Radar + Reputación

## Gap analysis

### Lo que existe hoy en Company

```python
# Campos actuales de companies:
id, name, slug, is_active, created_at, updated_at
```

**Falta todo**:
- No existe `cuit`, `is_verified`, `verification_status`, `logo_url`, `description`
- No existe `lat`, `lng`, `address_text` (tratado también en mercado-geo-liquidaciones)
- No existe `phone`
- No existe `avg_rating`, `total_ratings`
- No existe tabla `company_ratings`
- No existe tabla `radar_entries` (modelo watchlist)
- No existe página "Mi Agencia" en el frontend (existe `admin/CompanyDetail.tsx` solo para super_admin)
- No existe flujo de "pending" para nuevas empresas — se crean activas directamente
- No existe bot de feedback post-transacción

---

## Parte 1: Extensión del modelo Company

### Migración

```sql
ALTER TABLE companies
  ADD COLUMN cuit VARCHAR(20) nullable,
  ADD COLUMN verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected'
  ADD COLUMN verification_notes TEXT nullable,  -- notas del revisor
  ADD COLUMN logo_url VARCHAR(500) nullable,
  ADD COLUMN description TEXT nullable,
  ADD COLUMN phone VARCHAR(30) nullable,
  ADD COLUMN lat DECIMAL(10,8) nullable,
  ADD COLUMN lng DECIMAL(11,8) nullable,
  ADD COLUMN address_text VARCHAR(500) nullable,
  ADD COLUMN avg_rating DECIMAL(2,1) nullable,
  ADD COLUMN total_ratings INTEGER DEFAULT 0;

-- Empresas existentes quedan como approved (no bloquear prod)
UPDATE companies SET verification_status = 'approved' WHERE is_active = true;
```

### Flujo de verificación CUIT

```
1. Nueva empresa creada por super_admin → verification_status = 'pending'
2. Company_admin completa perfil: CUIT, descripción, teléfono, logo
3. Super_admin recibe notificación in-app: "Nueva empresa pendiente de verificación"
4. Super_admin accede a Companies → verifica AFIP manualmente → marca 'approved' o 'rejected'
5. Si 'approved': empresa.is_active = true; se envía notificación al company_admin
6. Si 'rejected': empresa permanece inactiva; se envía motivo en notificación
```

**Regla**: empresas con `verification_status = 'pending'` o `'rejected'`:
- Sus usuarios pueden loguearse pero no pueden publicar vehículos ni acceder al Mercado
- Ven un banner explicativo: "Tu agencia está pendiente de verificación"

### Cambios en backend

**Modelo Company** — agregar todos los campos listados arriba

**Endpoint `PATCH /api/v1/companies/{id}/verify`** (solo super_admin):
```python
# body: { status: 'approved' | 'rejected', notes: str }
# Si approved: company.is_active = True
# Notificación al company_admin de la empresa
```

**Middleware/guard**: verificar `company.verification_status == 'approved'` en endpoints de vehículos y marketplace.

---

## Parte 2: Radar de Reposición

Watchlist de marcas/modelos que la empresa quiere adquirir. Actúa como filtro para notificaciones de Pre-Toma y La Lonja.

### Migración

```sql
CREATE TABLE radar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  brand VARCHAR(100) nullable,    -- null = cualquier marca (para esa categoría)
  model VARCHAR(100) nullable,    -- null = cualquier modelo de esa marca
  category VARCHAR(50) nullable,  -- 'suv', 'sedan', 'hatchback', etc.
  max_km INTEGER nullable,
  min_year INTEGER nullable,
  max_price DECIMAL(12,2) nullable,
  created_at TIMESTAMPTZ DEFAULT now(),
  INDEX(company_id)
);
```

### Uso del Radar

- **Pre-Toma**: notificaciones solo a empresas cuyo radar incluye ese modelo (ver change `mercado-geo-liquidaciones`)
- **La Lonja**: al publicar un vehículo, el match cruzado prioriza solicitudes de empresas con ese modelo en su radar
- **Onboarding**: al crear la empresa, se pide configurar al menos 3 entradas del radar

### Endpoints

```
GET    /api/v1/radar              → listar entradas del radar propio
POST   /api/v1/radar              → agregar entrada
DELETE /api/v1/radar/{id}         → eliminar entrada
```

### Frontend

**`src/pages/agency/MyAgency.tsx`** → sección "Radar de Reposición"
- Lista de entradas con marca, modelo, filtros
- Botón "+ Agregar al radar"
- Modal de creación con cascading selects del catálogo + filtros opcionales

---

## Parte 3: Sistema de Reputación

### Tabla de calificaciones

```sql
CREATE TABLE company_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_company_id UUID NOT NULL REFERENCES companies(id),
  rated_company_id UUID NOT NULL REFERENCES companies(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT nullable,
  entity_type VARCHAR(30),   -- 'lonja_deal', 'pre_toma_deal', 'direct_match'
  entity_id UUID nullable,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rater_company_id, entity_type, entity_id)  -- una cal. por transacción
);
```

Al recibir una calificación, recalcular y guardar en `companies.avg_rating`:
```sql
UPDATE companies
SET avg_rating = (SELECT AVG(rating) FROM company_ratings WHERE rated_company_id = :id),
    total_ratings = (SELECT COUNT(*) FROM company_ratings WHERE rated_company_id = :id)
WHERE id = :id;
```

### Bot de feedback asincrónico

5 días después de que una operación se marca como cerrada/exitosa:

```python
# Job de APScheduler — corre diariamente
async def send_feedback_requests(session):
    deals_to_rate = await session.execute(
        select(Deal)
        .where(
            Deal.status == 'completed',
            Deal.completed_at <= func.now() - timedelta(days=5),
            Deal.feedback_requested == False
        )
    )
    for deal in deals_to_rate.scalars():
        # Opción A: Notificación in-app
        await create_notification(
            company_id=deal.company_a_id,
            title="¿Cómo fue la operación?",
            body=f"Calificá a {deal.company_b_name} por el {deal.vehicle_description}",
            entity_type="rating_request",
            entity_id=deal.id,
        )
        # Opción B (futuro): WhatsApp al teléfono del company_admin
        deal.feedback_requested = True
```

**Opción B (WhatsApp bot)**: requiere integración con API de WhatsApp Business (Twilio o Meta directa). Documentar como dependencia futura.

### Endpoints

```
POST   /api/v1/ratings                    → crear calificación
GET    /api/v1/companies/{id}/ratings     → ver calificaciones de una empresa
GET    /api/v1/companies/{id}/profile     → perfil público con stats + rating
```

---

## Parte 4: Página Mi Agencia (Frontend)

**`src/pages/agency/MyAgency.tsx`** (nuevo):

```
Sección 1: Header de agencia
  Logo circular (upload) + nombre + "CUIT Verificado ✓" badge + rating
  
Sección 2: Stats
  [ 128 Vehículos ] [ 98% Exitosas ] [ 2.1hs Respuesta ] [ 4.8 Rating ]
  
Sección 3: Información de contacto / editable
  CUIT, teléfono, dirección, descripción

Sección 4: Radar de Reposición
  Lista de entradas + agregar nueva
  
Sección 5: Nuestro Stock
  Grid 2×N de últimos vehículos + "Ver todos"
  
Sección 6: Calificaciones recibidas
  Lista de ratings con comentarios
```

**Banner para empresas pendientes de verificación**:
```tsx
{company.verification_status === 'pending' && (
  <Banner type="warning">
    Tu agencia está pendiente de verificación. El equipo de Reventa revisará
    tu CUIT en las próximas 24-48hs. Mientras tanto podés configurar tu perfil.
  </Banner>
)}
```

---

## Criterios de aceptación

### CUIT Gatekeeper
- [ ] Nuevas empresas creadas en estado `pending`
- [ ] Super_admin recibe notificación de empresa pendiente
- [ ] Super_admin puede aprobar/rechazar desde Companies
- [ ] Empresas pendientes/rechazadas no pueden publicar vehículos
- [ ] Banner explicativo para empresa pendiente

### Radar
- [ ] CRUD de entradas del radar
- [ ] Pre-Toma filtra notificaciones por radar (cuando modelo coincide)
- [ ] Onboarding pide configurar radar al crear empresa

### Reputación
- [ ] Calificación 1-5 disponible tras operación completada
- [ ] Job asincrónico solicita feedback 5 días post-transacción (notificación in-app)
- [ ] avg_rating actualizado en tiempo real
- [ ] Perfil público de empresa muestra rating + operaciones

### Mi Agencia
- [ ] Página completa con todas las secciones
- [ ] Upload de logo (S3, igual que vehículos)
- [ ] Stats calculados en tiempo real
