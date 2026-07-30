---
title: Liquidaciones — UI completa + validación + TTL cron
type: feature
status: proposed
spec: liquidaciones
created: 2026-07-29
---

# Liquidaciones — UI completa

## Resumen

El modelo de datos y las migraciones para Liquidaciones ya existen, pero la UI está pendiente. Esta propuesta cubre: formulario de publicación, listado en el tab Mercado, validación de precio (≥15% por debajo de referencia), TTL de 72h con cron de expiración y cancelación automática al marcar el vehículo como vendido.

---

## Estado actual

- Columnas `is_liquidacion`, `liquidacion_price`, `liquidacion_expires_at` existen en `vehicles`
- No hay UI para publicar ni ver liquidaciones
- No hay validación de precio mínimo
- No hay cron de expiración

---

## Reglas de negocio

1. **Precio mínimo**: `liquidacion_price` ≤ `price_resale * 0.85` (al menos 15% de descuento)
2. **TTL**: 72 horas desde la publicación. Al vencer, `is_liquidacion = false` automáticamente
3. **Cancelación**: Si el vehículo pasa a `status = sold`, limpiar `is_liquidacion = false` y `liquidacion_expires_at = null`
4. **Visibilidad**: Solo agencias de la red ven el precio de liquidación (el modo Con Cliente no lo revela)
5. **Quién puede publicar**: `company_admin` y `company_user` (no `reventa`)

---

## Backend

### Endpoint nuevo: `PATCH /vehicles/{id}/liquidar`

```python
class LiquidarRequest(BaseModel):
    liquidacion_price: Decimal

@router.patch("/{vehicle_id}/liquidar")
async def publish_liquidacion(vehicle_id: UUID, data: LiquidarRequest, ...):
    # Validar que price ≤ vehicle.price_resale * 0.85
    if data.liquidacion_price > vehicle.price_resale * Decimal("0.85"):
        raise HTTPException(400, "El precio de liquidación debe ser al menos 15% menor al precio de venta")
    vehicle.is_liquidacion = True
    vehicle.liquidacion_price = data.liquidacion_price
    vehicle.liquidacion_expires_at = datetime.now(timezone.utc) + timedelta(hours=72)
```

### Endpoint nuevo: `DELETE /vehicles/{id}/liquidar`

Cancela la liquidación (sin eliminar el vehículo).

```python
vehicle.is_liquidacion = False
vehicle.liquidacion_price = None
vehicle.liquidacion_expires_at = None
```

### Cron de expiración

En el background loop existente (`app/tasks/background.py`) agregar tarea cada 3600s:

```python
async def expire_liquidaciones(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    stmt = (
        update(Vehicle)
        .where(Vehicle.is_liquidacion == True, Vehicle.liquidacion_expires_at <= now)
        .values(is_liquidacion=False, liquidacion_price=None, liquidacion_expires_at=None)
    )
    await session.execute(stmt)
```

### Cancelación automática al vender

En `PATCH /vehicles/{id}` o `PATCH /vehicles/{id}/status`, cuando `status → sold`:

```python
if new_status == VehicleStatus.SOLD and vehicle.is_liquidacion:
    vehicle.is_liquidacion = False
    vehicle.liquidacion_price = None
    vehicle.liquidacion_expires_at = None
```

### Schema de respuesta

Asegurarse que `VehicleListItem` y `VehicleDetail` incluyen:
```python
is_liquidacion: bool
liquidacion_price: Decimal | None
liquidacion_expires_at: datetime | None
```

### Filtro en GET /vehicles

Agregar query param `?liquidaciones=true` para filtrar solo vehículos en liquidación.

---

## Frontend

### Banner en VehicleCard

```tsx
{vehicle.is_liquidacion && vehicle.liquidacion_price && (
  <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
    LIQUIDACIÓN
  </div>
)}
```

Y precio alternativo en la card:
```tsx
{vehicle.is_liquidacion && vehicle.liquidacion_price ? (
  <div>
    <p className="text-xs text-gray-400 line-through">${price_resale}</p>
    <p className="text-lg font-bold text-red-600">${liquidacion_price}</p>
    <p className="text-[10px] text-red-400">Expira en {horasRestantes}h</p>
  </div>
) : (
  <p className="text-lg font-bold">${price_resale}</p>
)}
```

### Tab "Liquidaciones" en Mercado

En `Mercado.tsx`, agregar tab adicional o filtro chip "Liquidaciones" que filtre `is_liquidacion === true`.

### Modal "Publicar liquidación" en MyStock

En la fila de cada vehículo en Mi Stock → botón "Liquidar" (solo si `status = available`):

```tsx
// LiquidacionModal
// Input: precio de liquidación
// Muestra: descuento calculado + advertencia si no llega al 15%
// Muestra: "Expira en 72h desde ahora"
// Botón: "Publicar liquidación"  → PATCH /vehicles/:id/liquidar
```

### Timer countdown

En Mi Stock, para vehículos en liquidación activa, mostrar `liquidacion_expires_at` como countdown:
```
LIQUIDACIÓN ACTIVA · Expira en 23h 14m  [Cancelar]
```

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Backend | PATCH /vehicles/{id}/liquidar con validación 15% |
| 2 | Backend | DELETE /vehicles/{id}/liquidar |
| 3 | Backend | Tarea cron de expiración cada 3600s |
| 4 | Backend | Cancelación automática al cambiar status a sold |
| 5 | Backend | Agregar `?liquidaciones=true` en GET /vehicles |
| 6 | Frontend | Banner LIQUIDACIÓN en VehicleCard |
| 7 | Frontend | Precio tachado + precio de liquidación en cards |
| 8 | Frontend | Tab/filtro Liquidaciones en Mercado |
| 9 | Frontend | Modal "Publicar liquidación" en MyStock |
| 10 | Frontend | Countdown timer en liquidaciones activas |

---

## Acceptance criteria

- [ ] No se puede publicar liquidación con precio > `price_resale * 0.85` (error 400)
- [ ] Vehículo en liquidación muestra banner rojo LIQUIDACIÓN en Mercado
- [ ] A las 72h, `is_liquidacion` se resetea automáticamente (cron)
- [ ] Al marcar vehículo como vendido, liquidación se cancela inmediatamente
- [ ] Filtro "Liquidaciones" en Mercado muestra solo los vehículos relevantes
- [ ] Timer countdown visible en Mi Stock para liquidaciones activas
- [ ] Role `reventa` puede ver liquidaciones pero no publicarlas
