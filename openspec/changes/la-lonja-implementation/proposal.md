---
title: La Lonja — Implementación Completa (Match + Ranking + Push)
type: feature
status: proposed
spec: la_lonja
created: 2026-06-30
---

# La Lonja — Implementación Completa

## Gap analysis

### Lo que existe hoy

- Spec de La Lonja documentado ✅ (`openspec/specs/la_lonja/spec.md`)
- **No existe** ningún código de implementación
- **No existe** tabla `client_requests` ni `stock_offers` ni `direct_matches`
- **No existen** endpoints de La Lonja
- **No existen** páginas frontend de La Lonja
- La tab "La Lonja" del BottomNav (diseño v2) no existe — actualmente hay un `NetworkCatalog`

### Lo que falta (implementación completa)

1. Tablas DB y modelos ORM: `client_requests`, `stock_offers`, `direct_matches`
2. Endpoints CRUD + match
3. Algoritmo de match cruzado (busca contra stock al publicar solicitud y viceversa)
4. Ranking de ofertas: historial de service + estado estético + precio + distancia
5. Push/notificaciones: notificación quirúrgica solo a dueños de stock que matchea
6. UI: feed de solicitudes, formulario de publicación, bandeja de ofertas

---

## Cambios requeridos

### Backend — modelos

**`app/models/client_request.py`**
```python
class ClientRequest(Base):
    __tablename__ = "client_requests"
    id: UUID PK
    company_id: UUID FK companies
    budget_min: Decimal nullable
    budget_max: Decimal
    payment_method: str  # 'cash', 'financed', 'trade', 'any'
    category: str nullable       # 'hatchback', 'suv', 'sedan', etc.
    reference_models: list[str]  # ARRAY(Text)
    filters: dict                # JSONB {max_km, min_year, fuel, transmission}
    status: str  # 'active', 'negotiating', 'closed'
    expires_at: datetime         # now() + 7 days
    created_at: datetime
```

**`app/models/stock_offer.py`**
```python
class StockOffer(Base):
    __tablename__ = "stock_offers"
    id: UUID PK
    client_request_id: UUID FK
    offering_company_id: UUID FK
    vehicle_id: UUID FK
    message: str nullable
    status: str  # 'pending', 'accepted', 'rejected'
    rank_score: Decimal nullable  # calculado al crear la oferta
    created_at: datetime
```

**`app/models/direct_match.py`**
```python
class DirectMatch(Base):
    __tablename__ = "direct_matches"
    id: UUID PK
    client_request_id: UUID FK
    vehicle_id: UUID FK
    notified_company_id: UUID FK   # empresa que publicó la solicitud
    vehicle_company_id: UUID FK    # empresa dueña del vehículo
    status: str  # 'pending', 'accepted', 'rejected', 'expired'
    created_at: datetime
```

**Campos adicionales en Vehicle** (para ranking):
```sql
ALTER TABLE vehicles ADD COLUMN has_service_history BOOLEAN DEFAULT false;
ALTER TABLE vehicles ADD COLUMN aesthetic_condition VARCHAR(10) DEFAULT 'good';
-- aesthetic_condition: 'excellent', 'good', 'fair', 'poor'
```

### Backend — algoritmo de match

**`app/services/match.py`**

```python
async def run_match_for_request(request: ClientRequest, session: AsyncSession):
    """Al publicar una solicitud: busca vehículos del stock de OTRAS empresas que la cumplan."""
    vehicles = await session.execute(
        select(Vehicle).where(
            Vehicle.status == 'available',
            Vehicle.company_id != request.company_id,
            Vehicle.price_public <= request.budget_max * 1.10,  # 10% tolerancia
            # filtros opcionales: km, año, fuel, transmission
        )
    )
    for vehicle in vehicles.scalars():
        match = DirectMatch(
            client_request_id=request.id,
            vehicle_id=vehicle.id,
            notified_company_id=request.company_id,
            vehicle_company_id=vehicle.company_id,
        )
        session.add(match)
        # Crear notificación in-app para la empresa de la solicitud
        await create_notification(
            company_id=request.company_id,
            title=f"Match directo: {vehicle.brand} {vehicle.model} {vehicle.year}",
            entity_type="direct_match",
            entity_id=match.id,
        )

async def run_match_for_vehicle(vehicle: Vehicle, session: AsyncSession):
    """Al publicar un vehículo: busca solicitudes activas que lo incluyan."""
    requests = await session.execute(
        select(ClientRequest).where(
            ClientRequest.status == 'active',
            ClientRequest.company_id != vehicle.company_id,
            ClientRequest.budget_max >= vehicle.price_public * 0.90,
            # filtros de categoría/km/año
        )
    )
    for req in requests.scalars():
        # ... crear DirectMatch + notificación para req.company_id
```

### Backend — ranking de ofertas

**Score algorítmico** (mayor = mejor):
```
score = (
  (has_service_history ? 40 : 0)         # 40 pts historial oficial
  + (aesthetic_condition == 'excellent' ? 30 : aesthetic_condition == 'good' ? 20 : 0)  # estado estético
  + max(0, 20 - (price_gremio / budget_max * 20))  # 20 pts si precio 0%, 0 si igual al tope
  + max(0, 10 - (distance_km / 50))       # 10 pts si mismo punto, 0 si >500km
)
```

El score se calcula al crear la `StockOffer` y se guarda en `rank_score`.

### Backend — endpoints

```
# Solicitudes
POST   /api/v1/lonja/requests           → crear solicitud (triggers match)
GET    /api/v1/lonja/requests           → feed de solicitudes activas de otras empresas
GET    /api/v1/lonja/requests/mine      → mis solicitudes propias
DELETE /api/v1/lonja/requests/{id}      → cerrar solicitud

# Ofertas
POST   /api/v1/lonja/requests/{id}/offers  → ofrecer un vehículo a una solicitud
GET    /api/v1/lonja/requests/{id}/offers  → ver ofertas rankeadas de una solicitud (dueño)
PATCH  /api/v1/lonja/offers/{id}/accept   → aceptar oferta
PATCH  /api/v1/lonja/offers/{id}/reject   → rechazar oferta

# Matches directos
GET    /api/v1/lonja/matches           → matches directos pendientes (inbox)
PATCH  /api/v1/lonja/matches/{id}/accept
PATCH  /api/v1/lonja/matches/{id}/reject
```

### Frontend

**`src/pages/lonja/Lonja.tsx`**
- Tabs: "Solicitudes activas" | "Mis solicitudes" | "Mis ofertas"
- Feed con ClientRequestCard, botón "Ofrecer mi Stock"

**`src/pages/lonja/PublishRequest.tsx`**
- Formulario: presupuesto, forma de pago, categoría, modelos referencia, filtros (km, año, combustible, transmisión)

**`src/pages/lonja/RequestDetail.tsx`**
- Vista de ofertas rankeadas con scoring visible
- Botones Aceptar/Rechazar + WhatsApp

**`src/components/ui/ClientRequestCard.tsx`**
- Presupuesto + categoría + filtros + agencia + tiempo + "Ofrecer mi Stock"

**Campos adicionales en VehicleForm.tsx**:
- Checkbox "Historial de servicio oficial" → `has_service_history`
- Select "Estado estético" → `aesthetic_condition` (Excelente / Bueno / Regular / Deteriorado)

---

## Criterios de aceptación

- [ ] Publicar solicitud dispara match contra stock activo
- [ ] Publicar vehículo dispara match contra solicitudes activas
- [ ] Match genera notificación in-app solo para empresas relevantes (sin spam masivo)
- [ ] Feed de solicitudes visible para todas las empresas activas
- [ ] Ofertas ordenadas por score (historial + estado + precio + distancia)
- [ ] WhatsApp disponible al aceptar una oferta o match
- [ ] Solicitudes expiran a los 7 días automáticamente
