---
title: Geofencing fase 2 — Badge de distancia + filtro por radio
type: feature
status: proposed
spec: geofencing
created: 2026-07-29
---

# Geofencing — Fase 2

## Resumen

El ordenamiento por distancia (Haversine en SQL) ya funciona. Faltan: el badge "X km" en las cards de Mercado, el filtro por radio (50/100/200 km), y el botón de Geolocation API para actualizar la ubicación del usuario en tiempo real.

---

## Estado actual

- [x] Ordenamiento Haversine en GET /vehicles cuando `lat`/`lng` están presentes
- [x] Columnas `lat`, `lng` en `companies`
- [ ] Campo `distance_km` expuesto en la respuesta de GET /vehicles
- [ ] Badge "X km" en VehicleCard
- [ ] Filtro por radio en Mercado
- [ ] Botón "Usar mi ubicación" en Mercado

---

## 1. Exponer `distance_km` en la respuesta

### Backend

En `GET /vehicles`, cuando se recibe `lat` y `lng`, calcular `distance_km` por vehículo y agregarlo al schema de respuesta.

```python
# En vehicles.py — list_vehicles:
if lat is not None and lng is not None:
    # Haversine ya ordena; agregar distance_km al resultado
    distance_expr = (
        6371 * func.acos(
            func.cos(func.radians(lat)) * func.cos(func.radians(Company.lat))
            * func.cos(func.radians(Company.lng) - func.radians(lng))
            + func.sin(func.radians(lat)) * func.sin(func.radians(Company.lat))
        )
    ).label("distance_km")
    stmt = stmt.add_columns(distance_expr)
```

Schema update:
```python
class VehicleListItem(BaseModel):
    ...
    distance_km: float | None = None
```

### Filtro por radio

Query param adicional: `?radius_km=100`

```python
if lat is not None and lng is not None and radius_km is not None:
    stmt = stmt.having(distance_expr <= radius_km)
```

---

## 2. Badge "X km" en VehicleCard

```tsx
// VehicleCard.tsx
{vehicle.distance_km !== null && vehicle.distance_km !== undefined && (
  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-full backdrop-blur-sm">
    {vehicle.distance_km < 1
      ? "< 1 km"
      : `${Math.round(vehicle.distance_km)} km`}
  </span>
)}
```

El badge aparece sobre la imagen, esquina inferior derecha, solo si `distance_km` está presente.

---

## 3. Filtro por radio en Mercado

En `Mercado.tsx`, agregar chips de filtro de radio cuando hay ubicación activa:

```tsx
const RADIUS_OPTIONS = [
  { label: "50 km", value: 50 },
  { label: "100 km", value: 100 },
  { label: "200 km", value: 200 },
  { label: "Todo el país", value: null },
]

// Estado:
const [activeRadius, setActiveRadius] = useState<number | null>(null)

// En el fetch de vehículos:
const params = new URLSearchParams({ ... })
if (userLocation && activeRadius) {
  params.set("lat", String(userLocation.lat))
  params.set("lng", String(userLocation.lng))
  params.set("radius_km", String(activeRadius))
}
```

UI: chips horizontales debajo de la barra de búsqueda, solo visibles cuando hay ubicación activa:

```tsx
{userLocation && (
  <div className="flex gap-2 overflow-x-auto pb-1">
    {RADIUS_OPTIONS.map(opt => (
      <button
        key={opt.label}
        onClick={() => setActiveRadius(opt.value)}
        className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${activeRadius === opt.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
      >
        {opt.label}
      </button>
    ))}
  </div>
)}
```

---

## 4. Botón "Usar mi ubicación"

En Mercado, barra superior junto al buscador:

```tsx
const handleGeolocate = () => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      toast.success("Ubicación detectada. Mostrando vehículos cercanos.")
    },
    () => toast.error("No se pudo obtener la ubicación."),
    { timeout: 8000, maximumAge: 60000 }
  )
}

<button onClick={handleGeolocate} className="shrink-0 p-2 rounded-xl bg-gray-100 text-gray-600">
  <MapPinIcon className="w-5 h-5" />
</button>
```

La ubicación se guarda en `localStorage` con TTL de 1 hora para no pedir permisos en cada visita.

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Backend | Agregar `distance_km` calculado en GET /vehicles |
| 2 | Backend | Query param `?radius_km=N` filtra por Haversine HAVING |
| 3 | Backend | `distance_km` en schema `VehicleListItem` |
| 4 | Frontend | Badge "X km" en VehicleCard |
| 5 | Frontend | Chips de radio en Mercado (50/100/200/Todo) |
| 6 | Frontend | Botón geolocalización en Mercado |
| 7 | Frontend | Persistencia de ubicación en localStorage con TTL 1h |

---

## Acceptance criteria

- [ ] GET /vehicles con `lat`, `lng` devuelve `distance_km` en cada ítem
- [ ] GET /vehicles con `lat`, `lng`, `radius_km=50` devuelve solo vehículos dentro de 50km
- [ ] VehicleCard muestra badge "X km" cuando `distance_km` está presente
- [ ] Botón de geolocalización pide permiso y actualiza el feed
- [ ] Chips de radio solo aparecen cuando hay ubicación activa
- [ ] Con radio "Todo el país" (null), se ordena por distancia pero sin límite
