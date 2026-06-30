---
title: Geofencing y Ordenamiento por Distancia
status: active
created: 2026-06-30
implemented: 2026-06-30
---

# Geofencing y Ordenamiento por Distancia

## Purpose

Incorporar coordenadas geográficas a las empresas para ordenar el Mercado, La Lonja y las notificaciones de Pre-Toma por proximidad física. El algoritmo de Haversine calcula distancias en línea recta (km) entre la ubicación de la empresa del usuario y la empresa dueña de cada vehículo/solicitud.

## Contexto

- Columnas `lat` y `lng` en la tabla `companies` (DECIMAL, nullable — no obligatorio)
- Si una empresa no tiene coordenadas, se muestra al final del feed sin orden de distancia
- No requiere PostGIS para Haversine básico — se puede calcular en SQL con trigonometría. PostGIS es opcional para consultas avanzadas de radio fijo.
- La ubicación de la empresa se configura una sola vez en Mi Agencia (no tracking en tiempo real)

## Fórmula Haversine (implementación SQL PostgreSQL)

```sql
-- Distancia en km entre (lat1, lng1) y (lat2, lng2)
6371 * acos(
  cos(radians(:user_lat)) * cos(radians(c.lat))
  * cos(radians(c.lng) - radians(:user_lng))
  + sin(radians(:user_lat)) * sin(radians(c.lat))
)
```

## Requirements

### Requirement: Configuración de ubicación de empresa

Las empresas SHALL poder configurar su ubicación geográfica.

#### Scenario: Guardar coordenadas

- **WHEN** company_admin ingresa su dirección o arrastra un pin en el mapa
- **THEN** se guardan `lat` y `lng` en la empresa
- **AND** la dirección se guarda como texto (geocodificación externa o ingreso manual)

#### Scenario: Empresa sin coordenadas

- **WHEN** una empresa no configuró su ubicación
- **THEN** sus vehículos aparecen al final del feed (sin distancia calculada)

### Requirement: Ordenamiento en el Mercado

El feed del Mercado SHALL ordenarse por distancia al usuario logueado.

#### Scenario: Ordenamiento primario por distancia

- **WHEN** el usuario logueado tiene empresa con coordenadas
- **THEN** el feed de vehículos se ordena: primero de favoritas confirmadas, luego por distancia ascendente
- **AND** se muestra "X km" en cada card

#### Scenario: Filtro por radio

- **WHEN** se aplica el filtro "Radio: 50km"
- **THEN** solo se muestran vehículos de empresas dentro de ese radio

### Requirement: Ordenamiento en La Lonja

Las solicitudes de La Lonja SHALL mostrar la distancia a la empresa solicitante.

#### Scenario: Distancia en ClientRequestCard

- **WHEN** se listan solicitudes en La Lonja
- **THEN** cada card muestra la distancia en km a la agencia solicitante

#### Scenario: Factor de cercanía en el ranking de ofertas

- **WHEN** se rankean las respuestas a una solicitud
- **THEN** la cercanía geográfica es el 4° criterio de ranking (después de historial, estado estético y precio)

### Requirement: Notificaciones pre-toma por radar geográfico (futuro)

Las notificaciones de Pre-Toma SHOULD respetar un radio máximo configurable por empresa.

#### Scenario: Radio de radar

- **WHEN** una empresa tiene `radar_radius_km` configurado (ej: 150km)
- **THEN** solo recibe notificaciones de Pre-Toma de empresas dentro de ese radio

## Cambios en modelo Company

```sql
-- Agregar a companies:
lat              DECIMAL(10, 8) nullable   -- latitud
lng              DECIMAL(11, 8) nullable   -- longitud
address_text     VARCHAR(500) nullable     -- dirección legible
radar_radius_km  INTEGER nullable          -- radio de notificaciones (default null = sin límite)
```

## Implementación sugerida

- Migración agrega lat, lng, address_text, radar_radius_km a companies
- `app/repositories/vehicle.py` — get_network_list agrega ORDER BY distancia Haversine
- `app/repositories/liquidacion.py` — mismo ordenamiento
- `app/repositories/client_request.py` — distancia en listado de La Lonja
- `src/pages/agency/MyAgency.tsx` — configuración de ubicación (mapa o lat/lng manual)
- `src/components/ui/VehicleCardDark.tsx` — badge "X km"

## Implementación (2026-06-30)

### Estado: Haversine backend + configuración de coordenadas implementados

**Migración 0006** — nuevos campos en `companies`:
`lat DECIMAL(10,8)`, `lng DECIMAL(11,8)`, `address_text VARCHAR(500)`

**Backend:**
- `backend/app/repositories/vehicle.py` — función `_haversine_km(lat1, lon1, lat2_col, lon2_col)` con `func.power/sin/cos/radians/asin/sqrt`
- `get_network_list()` acepta `viewer_lat: float | None`, `viewer_lng: float | None`; JOIN a `Company` cuando hay coords; ORDER BY distancia `NULLS LAST`
- `backend/app/services/vehicle.py` — `get_network_list()` consulta `companies.lat/lng` del usuario logueado y las pasa al repo

**Frontend:**
- `frontend/src/pages/agency/MyAgency.tsx` — inputs lat/lng en tab Perfil para configuración manual de coordenadas

**No implementado aún:**
- Badge "X km" en las cards del mercado (distancia calculada en backend, no expuesta en el schema de VehicleListItem)
- Filtro por radio en el Mercado
- Botón "Usar mi ubicación" con Geolocation API
- Ordenamiento por distancia en La Lonja (sólo en Mercado por ahora)
- `radar_radius_km` en companies (no incluido en migración 0006)
