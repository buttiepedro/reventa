---
title: Mercado v2 — Geofencing + Liquidaciones + Pre-Toma con TTL y Cámara
type: feature
status: proposed
spec: marketplace, liquidaciones, geofencing, pre_toma
created: 2026-06-30
---

# Mercado v2 — Geofencing + Liquidaciones + Pre-Toma con TTL y Cámara

## Gap analysis

### Lo que existe hoy

- Marketplace (`GET /api/v1/vehicles`) funcional con filtros básicos ✅
- Pre-Toma implementada (status, interests, notificaciones a favoritas) ✅
- **No existe** `expires_at` en Pre-Toma (sin TTL de 24hs)
- **No existe** cron job de expiración
- **No existe** geolocalización (sin lat/lng en companies)
- **No existe** ordenamiento por distancia
- **No existe** sección Liquidaciones
- **No existe** validación de precio en Liquidaciones
- **No existe** restricción de cámara en upload de fotos de Pre-Toma
- **No existe** Radar de Reposición (Pre-Toma va a TODOS los favoritas, no a los que tienen ese modelo en su radar)

### Lo que falta

---

## Parte 1: Geofencing

### Cambios en Company

```sql
ALTER TABLE companies ADD COLUMN lat DECIMAL(10,8) nullable;
ALTER TABLE companies ADD COLUMN lng DECIMAL(11,8) nullable;
ALTER TABLE companies ADD COLUMN address_text VARCHAR(500) nullable;
```

### Cambios en query del Mercado

```python
# En get_network_list(), si el usuario tiene empresa con lat/lng:
haversine_expr = (
    6371 * func.acos(
        func.cos(func.radians(user_lat)) * func.cos(func.radians(Company.lat))
        * func.cos(func.radians(Company.lng) - func.radians(user_lng))
        + func.sin(func.radians(user_lat)) * func.sin(func.radians(Company.lat))
    )
).label("distance_km")

query = query.add_columns(haversine_expr).order_by(
    is_favorite_asc,  # favoritas primero
    haversine_expr.asc().nullslast()  # luego por distancia; sin coords → al final
)
```

### Frontend

- Card de vehículo muestra `"X km"` badge cuando hay coordenadas
- Mi Agencia → sección "Ubicación" con campo de dirección + botón "Usar mi ubicación" (Geolocation API)
- Filtro de radio (50km / 100km / 200km / Sin límite)

---

## Parte 2: Liquidaciones

*Ver spec completo: [[liquidaciones]]*

### Migración

```sql
CREATE TABLE liquidaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  liquidation_price DECIMAL(12,2) NOT NULL,
  reference_price DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX ON liquidaciones(status, expires_at);
```

### Validación de precio al publicar

```python
async def create_liquidacion(vehicle_id, liquidation_price, company_id, session):
    reference = await get_reference_price(vehicle, session)  # AVG de red últimos 90 días
    if liquidation_price >= reference * 0.85:
        raise HTTPException(422, f"Precio debe ser al menos 15% menor al de referencia (USD {reference:,.0f})")
    expires_at = datetime.utcnow() + timedelta(hours=72)
    ...
```

### Cron job de limpieza

```python
# APScheduler, cada 15 minutos
async def expire_liquidaciones(session):
    await session.execute(
        update(Liquidacion)
        .where(Liquidacion.expires_at <= func.now(), Liquidacion.status == 'active')
        .values(status='expired')
    )
```

Trigger automático: cuando `vehicle.status` cambia a `sold`/`reserved` → cancelar liquidación activa.

---

## Parte 3: Pre-Toma v2

### 3a. TTL de 24 horas

```sql
ALTER TABLE vehicles ADD COLUMN pre_toma_expires_at TIMESTAMPTZ nullable;
```

- Al cambiar a `status=pre_toma`: `pre_toma_expires_at = now() + 24h`
- `GET /api/v1/vehicles/pre-toma` filtra además `pre_toma_expires_at > now()`
- Cron job cada 15min: vehículos con `status=pre_toma` y `pre_toma_expires_at <= now()` → `status=available` (pasan a la red general automáticamente si nadie los tomó)
- Frontend muestra countdown "⏰ Cierra en Xhs" calculado desde `pre_toma_expires_at`

### 3b. Cámara solamente (sin galería)

En el formulario de Pre-Toma Express (formulario simplificado para crear una pre-toma rápido):
```typescript
// En el input de imagen del formulario express:
<input
  type="file"
  accept="image/*"
  capture="environment"  // fuerza cámara trasera en mobile
  // SIN la opción de galería — la restricción es client-side
/>
```

**Nota**: la restricción de galería es solo UX (el atributo `capture` en mobile). El backend igual valida que sea imagen. En desktop no aplica el `capture`.

El formulario estándar de VehicleForm sigue permitiendo galería. Solo el formulario "Pre-Toma Express" (nuevo componente optimizado para mobile) usa `capture`.

### 3c. Radar de Reposición — filtro de notificaciones

Actualmente las notificaciones de Pre-Toma se envían a TODOS los favoritas confirmados. Con el Radar, solo se notifica a quienes tienen ese modelo en su lista de interés.

```python
async def _notify_favorites_pre_toma(vehicle: Vehicle, session: AsyncSession):
    confirmed_ids = await self.fav_repo.get_confirmed_ids(vehicle.company_id)
    
    # NUEVO: filtrar por radar si existe
    radar_companies = await session.execute(
        select(RadarEntry.company_id)
        .where(
            RadarEntry.company_id.in_(confirmed_ids),
            or_(
                RadarEntry.brand.ilike(vehicle.brand),
                RadarEntry.model.ilike(vehicle.model),
            )
        )
    )
    radar_ids = {r[0] for r in radar_companies}
    
    # Si nadie tiene radar configurado, notificar a todos (backward compat)
    targets = radar_ids if radar_ids else confirmed_ids
    
    for company_id in targets:
        await create_notification(company_id, ...)
```

*Ver spec Radar: [[mi_agencia]]*

---

## Criterios de aceptación

### Geofencing
- [x] Companies tienen lat/lng configurables en Mi Agencia — implementado 2026-06-30
- [ ] Mercado muestra distancia en km en cada card
- [x] Orden: favoritas primero, luego por distancia ascendente — Haversine en backend implementado 2026-06-30
- [x] Empresas sin coordenadas aparecen al final — ORDER BY distancia NULLS LAST

### Liquidaciones
- [ ] No se puede publicar liquidación si precio ≥ 85% del precio referencia
- [ ] Liquidaciones expiran a las 72hs (cron job)
- [ ] Tab "Liquidaciones (72hs)" en Mercado con countdown (muestra "próximamente")
- [ ] Al venderse el vehículo, la liquidación se cancela

### Pre-Toma v2
- [x] Pre-Toma tiene TTL de 24hs — `pre_toma_expires_at` en migración 0006, seteado en VehicleService
- [x] Al vencer el TTL, el vehículo pasa automáticamente a `available` — asyncio scheduler en lifespan, cada 3600s
- [ ] Countdown visible en el feed
- [ ] Formulario Pre-Toma Express usa `capture="environment"` en mobile (formulario unificado aún)
- [x] Notificaciones de Pre-Toma filtradas por Radar (backward compat: si nadie tiene radar, notifica a todos)

## Estado parcial (2026-06-30)

**Implementado:**
- Geofencing: lat/lng en companies, Haversine en `get_network_list()`, ORDER BY distancia NULLS LAST
- Pre-Toma TTL 24h: columna `pre_toma_expires_at`, scheduler asyncio en lifespan, `expire_pretoma_ttl()`
- Tabla `liquidaciones` creada en migración 0006

**Pendiente:**
- Badge "X km" en cards del Mercado (distancia calculada en backend, no expuesta en schema UI)
- Filtro por radio en Mercado
- Liquidaciones: validación de precio, cron job de expiración, UI completa (actualmente "próximamente")
