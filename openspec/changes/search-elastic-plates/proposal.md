---
title: Búsqueda Elástica por Presupuesto y Búsqueda por Dominio (Patente)
type: feature
status: proposed
spec: marketplace, vehicles
created: 2026-06-30
---

# Búsqueda Elástica por Presupuesto y Búsqueda por Dominio (Patente)

## Gap analysis

### Lo que existe hoy

- Filtros en `GET /api/v1/vehicles`: `brand`, `model`, `year_min`, `year_max`, `company_id`
- Búsqueda por texto (`q`) con ILIKE sobre brand + model
- **No existe** búsqueda por precio/presupuesto
- **No existe** tolerancia elástica en búsqueda por precio
- **No existe** campo `plate` (patente/dominio) en el modelo Vehicle
- **No existe** búsqueda por patente

### Lo que falta

1. **Campo `plate`** en modelo Vehicle (opcional, no indexado como PK)
2. **Ruta de búsqueda inteligente** en el buscador global: si el input es texto → busca marca/modelo; si es número → busca precio con elasticidad; si coincide con patrón de patente → busca por dominio
3. **Filtro por presupuesto con elasticidad** en el endpoint: `budget` param → devuelve vehículos con `price_public` entre `budget` y `budget × 1.15`

---

## Cambios requeridos

### Backend

**Modelo Vehicle** — nueva columna:
```sql
ALTER TABLE vehicles ADD COLUMN plate VARCHAR(20) nullable;
CREATE INDEX idx_vehicles_plate ON vehicles (plate);
```

**Endpoint `GET /api/v1/vehicles`** — nuevos parámetros:
- `budget: int | null` → filtro `price_public BETWEEN budget AND budget * 1.15`
- `budget_tolerance: float = 0.15` → multiplicador configurable (default 15%)
- `plate: str | null` → filtro `plate ILIKE :plate` (búsqueda parcial de patente)
- Detectar si `q` es un número → tratarlo como `budget` automáticamente

```python
if params.q and params.q.strip().isdigit():
    # redirigir a búsqueda por budget
    budget = int(params.q.strip())
    query = query.where(Vehicle.price_public.between(budget, budget * (1 + tolerance)))
elif params.q and is_plate_pattern(params.q):
    # patrón AAA-NNN o AB-NNN-CD (patentes argentinas)
    query = query.where(Vehicle.plate.ilike(f"%{params.q}%"))
elif params.q:
    query = query.where(or_(
        Vehicle.brand.ilike(f"%{params.q}%"),
        Vehicle.model.ilike(f"%{params.q}%"),
    ))
```

**Schema VehicleCreate/VehicleUpdate** — agregar `plate: str | None = None`

**VehicleForm.tsx** — agregar campo "Dominio (Patente)" (opcional)

### Frontend

**Barra de búsqueda global** (Home + Mercado):
- Placeholder: "Buscar marca, modelo, dominio o presupuesto..."
- Detección automática de tipo de input:
  - Solo números → tooltip: "Buscando vehículos hasta USD X (±15%)"
  - Patrón de patente → tooltip: "Buscando por dominio"
  - Texto → búsqueda por marca/modelo
- Badge explicativo cuando se usa búsqueda por presupuesto: "Mostrando ±15% de tolerancia"

---

## Criterios de aceptación

- [ ] Campo `plate` en formulario de vehículo (opcional)
- [ ] Búsqueda por número aplica tolerancia del 15% sobre `price_public`
- [ ] Búsqueda por patente retorna vehículos con coincidencia parcial
- [ ] Buscador detecta tipo de input automáticamente (texto / número / patente)
- [ ] Badge explicativo visible cuando se busca por presupuesto
- [ ] Tolerancia configurable sin redeploy (parámetro en env o endpoint)
