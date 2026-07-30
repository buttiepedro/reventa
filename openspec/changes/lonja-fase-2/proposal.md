---
title: La Lonja fase 2 — WhatsApp deeplinks + filtros + auto-expire
type: feature
status: proposed
spec: la_lonja
created: 2026-07-29
---

# La Lonja — Fase 2

## Resumen

Completa las funcionalidades pendientes de La Lonja: deeplinks de WhatsApp para ofertas aceptadas, cron de expiración automática de solicitudes, filtro "Para mi stock" y visualización de match directo.

---

## Items pendientes

### 1. WhatsApp deeplinks en oferta aceptada

Cuando el dueño de una solicitud acepta una oferta (`PATCH /offers/:id → accepted`), ambas partes necesitan un canal de contacto directo. WhatsApp es el estándar del mercado.

**Backend:**

Al aceptar oferta, generar `whatsapp_url` en la respuesta:
```python
# En update_offer_status, cuando new_status == "accepted":
phone = offer.offering_company.whatsapp_phone  # campo nuevo en companies
if phone:
    msg = urllib.parse.quote(
        f"Hola, acepté tu oferta para {offer.vehicle.brand} {offer.vehicle.model} {offer.vehicle.year} "
        f"(${float(offer.vehicle.price_resale):,.0f}) en La Lonja."
    )
    whatsapp_url = f"https://wa.me/{phone}?text={msg}"
```

Campo nuevo en `companies`:
```sql
ALTER TABLE companies ADD COLUMN whatsapp_phone VARCHAR(20);
```

**Frontend:**

En el modal de ofertas recibidas, cuando una oferta está `accepted`:
```tsx
<a
  href={offer.whatsapp_url}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
>
  <WhatsAppIcon /> Contactar por WhatsApp
</a>
```

También al notificar al ofertante que fue aceptado, incluir deeplink para contactar al solicitante.

**Template de mensaje para el ofertante (cuando le notifican que fue aceptado):**
```
Hola, tu oferta de {marca modelo año} fue aceptada en La Lonja. El comprador quiere coordinar.
```

---

### 2. Cron de expiración de solicitudes

Las solicitudes ya tienen `expires_at = now + 7 días`. El cron que actualiza `status = expired` automáticamente falta.

**Backend — agregar en `app/tasks/background.py`:**

```python
async def expire_lonja_requests(session: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    stmt = (
        update(ClientRequest)
        .where(
            ClientRequest.status == "active",
            ClientRequest.expires_at <= now,
        )
        .values(status="expired")
    )
    await session.execute(stmt)
```

Agregar al loop existente cada 3600s (junto al de pre-toma TTL).

---

### 3. Filtro "Para mi stock" en La Lonja

En el listado de solicitudes abiertas (`/lonja/requests`), agregar query param `?match_my_stock=true` que filtre solo las solicitudes cuyo rango de presupuesto cubre al menos un vehículo disponible de la empresa autenticada.

**Backend:**
```python
if match_my_stock:
    my_prices = select(Vehicle.price_resale).where(
        Vehicle.company_id == current_user.company_id,
        Vehicle.status == VehicleStatus.AVAILABLE,
    )
    subq = my_prices.scalar_subquery()
    stmt = stmt.where(
        ClientRequest.budget_max * 1.10 >= subq,
        ClientRequest.budget_min * 0.90 <= subq,
    )
```

**Frontend:**

Chip toggle en la tab "Solicitudes abiertas" de La Lonja:
```tsx
<button
  onClick={() => setMatchMyStock(!matchMyStock)}
  className={`px-3 py-1 rounded-full text-xs font-semibold ${matchMyStock ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"}`}
>
  Para mi stock
</button>
```

---

### 4. Visualización de match directo (direct_match)

Cuando `_run_auto_match` genera una notificación de tipo `lonja_match`, el Home ya la muestra como alerta. Falta que desde el detalle de la solicitud (al entrar desde la notificación), el vehículo que matcheó esté pre-seleccionado en el formulario de oferta.

**Frontend:**

En la URL de la notificación lonja_match, incluir `?vehicle_id={id}`:
```python
# En _run_auto_match, en la notificación:
entity_id=req.id  # ya existe
# agregar metadata al body:
body=f"... ¡Ofrecé tu stock! vehicle_id={first.id}"  # provisional
```

O mejor: crear un campo `metadata` JSONB en `notifications` para datos extra sin parsear strings.

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Alembic | `ALTER TABLE companies ADD COLUMN whatsapp_phone VARCHAR(20)` |
| 2 | Backend | Generar `whatsapp_url` al aceptar oferta |
| 3 | Backend | Campo whatsapp_phone en schemas de company |
| 4 | Backend | Cron de expiración de ClientRequest cada 3600s |
| 5 | Backend | Query param `?match_my_stock=true` en GET /lonja/requests |
| 6 | Frontend | Botón WhatsApp en modal de oferta aceptada |
| 7 | Frontend | Chip "Para mi stock" en tab Solicitudes |
| 8 | Frontend | Campo whatsapp_phone en Mi Agencia → perfil |
| 9 | Backend/Frontend | Metadata en notificaciones para pre-selección de vehículo |

---

## Acceptance criteria

- [ ] Al aceptar una oferta → botón "Contactar por WhatsApp" aparece para ambas partes
- [ ] Deeplink abre WhatsApp web/app con mensaje pre-armado
- [ ] Solicitudes expiradas (> 7 días) cambian a `status=expired` automáticamente
- [ ] Filtro "Para mi stock" devuelve solo solicitudes cuyo presupuesto cubre mi stock actual
- [ ] `whatsapp_phone` editable desde Mi Agencia → perfil
