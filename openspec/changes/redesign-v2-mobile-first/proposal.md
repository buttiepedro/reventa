---
title: Rediseño Visual Mayor + Nuevas Secciones (v2 Mobile-First)
type: feature
status: proposed
spec: vehicles, marketplace, pre_toma, la_lonja, tasador, mi_agencia
created: 2026-06-30
---

# Rediseño Visual Mayor + Nuevas Secciones (v2 Mobile-First)

## Visión general

Migrar la app de un layout web de escritorio a un diseño mobile-first con navegación por tabs inferior y una identidad visual unificada. Se suma una nueva sección **La Lonja** (demanda B2B), un **Tasador** con termómetro de mercado, y un perfil de **Mi Agencia** con métricas y reputación.

---

## Sistema de diseño

### Paleta de colores

| Rol | Color | Uso |
|-----|-------|-----|
| Primary | `#16A34A` (green-600) | Botones CTA, estados activos, badges positivos |
| Primary light | `#DCFCE7` (green-100) | Fondos de badges y chips verdes |
| Surface dark | `#111827` (gray-900) | Cards de vehículos (imagen + info sobre dark bg) |
| Surface card | `#FFFFFF` | Cards de contenido (solicitudes, alertas) |
| Background | `#F3F4F6` (gray-100) | Fondo general de pantallas |
| Text primary | `#111827` | Títulos y precios |
| Text secondary | `#6B7280` (gray-500) | Labels, metadatos, subtítulos |
| Danger | `#DC2626` (red-600) | Botón Rechazar, alerta sobreoferta |
| Warning | `#D97706` (amber-600) | Termómetro zona naranja |
| Countdown | `#FFFFFF` sobre `#111827` | Badges "Cierra en Xhs" |

### Tipografía

- **Familia**: Inter (ya en uso vía Tailwind)
- **Precios**: `text-2xl font-bold` — USD 49.800
- **Títulos de sección**: `text-lg font-semibold`
- **Labels de stats**: `text-xs text-gray-500 uppercase tracking-wide`
- **Valores de stats**: `text-xl font-bold`
- **Metadatos de cards**: `text-sm text-gray-500`

### Componentes reutilizables

#### VehicleCardDark
Card de vehículo con imagen a full-width, fondo oscuro (`bg-gray-900`), texto blanco, badge countdown y corazón.
```
┌──────────────────────┐
│   [foto full width]  │  ♡ (top right)
│ Toyota Hilux 2023    │
│ 32.000 km · Diésel   │
│ Precio Gremio        │
│ USD 49.800           │
│ ⏰ Cierra en 4hs     │
└──────────────────────┘
```

#### ClientRequestCard
Card de solicitud de La Lonja con presupuesto, categoría, filtros y CTA.
```
┌──────────────────────────────────────────┐
│ Cliente con USD 15.000 Efectivo          │
│ busca Hatchback (Clio, Gol Trend)        │
│ • Menos de 100.000 km                   │
│ • Transmisión Manual                     │
│ Agencia del Norte · hace 25 min          │
│                      [Ofrecer mi Stock] │
└──────────────────────────────────────────┘
```

#### MatchCard
Card destacada en Inicio cuando hay un match directo.
```
┌──────────────────────────────────────────┐
│ ◎  ¡Match Directo de La Lonja!          │
│    Agencia del Norte ofrece              │
│    USD 15.000 de contado                 │
│    por tu Clio 2019.                     │
│                                          │
│  [✓ Aceptar] [✗ Rechazar] [WhatsApp]   │
└──────────────────────────────────────────┘
```

#### StatsRow
Fila de 4 métricas con valor grande + label pequeño debajo.
```
[ 12 Consultas ] [ 5 Ofertas ] [ 3 Match ] [ 8 Vehículos ]
```

#### TabToggle (pill)
Selector de tab estilo pill, fondo gris claro, tab activo en verde con texto blanco.
```
[ Pre-Tomas (24hs) ]  [ Liquidaciones (72hs) ]
      (activo/verde)         (inactivo/gris)
```

#### MarketThermometer
Gauge semicircular de verde a rojo con aguja y label de posición.
- `Verde` → Subdemanda / Buena oportunidad de toma
- `Amarillo` → Mercado equilibrado
- `Rojo` → Sobreoferta / Venta Lenta

#### AgencyBadge
Logo circular + nombre + badge "CUIT Verificado ✓" + stars.

### Navegación inferior (BottomNav)

5 tabs fijos, siempre visibles:
```
[ 🏠 Inicio ] [ ♟ La Lonja ] [ 🛒 Mercado ] [ 📊 Tasador ] [ 👤 Mi Agencia ]
```
- Tab activo: icono + label en verde
- Tab inactivo: icono + label en gray-500
- Fondo blanco, borde superior `border-t border-gray-200`
- Reemplaza el sidebar/header nav actual

---

## Pantallas

### 1. Inicio (Home Dashboard)

**Barra superior**: search global "Buscar marca, modelo, dominio..." con icono lupa.

**Tabs**: "Sin Cliente" | "Con Cliente" (toggle, determina qué contenido mostrar).

**MatchCard** (si hay matches): destacada al tope, con Aceptar/Rechazar/WhatsApp.

**Resumen de actividad**: StatsRow — Consultas Recibidas / Ofertas Pendientes / Match Directos / Vehículos Publicados.

**Alertas y novedades**: lista de alertas recientes con icono de categoría (campana, lápiz, mensaje), texto y link "Ver →".

---

### 2. La Lonja

**CTA principal**: botón full-width "+ Publicar Búsqueda de Cliente".

**Lista "Solicitudes de compra activas"** con "Ver todas" link + ClientRequestCards.

Cada card tiene:
- Presupuesto + forma de pago (efectivo / financiado / permuta)
- Categoría buscada + modelos de referencia
- Filtros adicionales (km máximos, año, combustible, transmisión)
- Agencia publicante + tiempo
- Botón "Ofrecer mi Stock" → abre selector de vehículos del stock propio

**Match directo**: cuando la solicitud de otra agencia coincide exactamente con un vehículo propio, aparece en Inicio como MatchCard.

*Ver spec: [[la_lonja]]*

---

### 3. Mercado

**TabToggle**: Pre-Tomas (24hs) | Liquidaciones (72hs)

**Pre-Tomas tab**:
- Header "Pre-Tomas activas" + "Ver todas"
- VehicleCardDark con countdown "⏰ Cierra en Xhs"
- Corazón para guardar
- Las pre-tomas desaparecen del feed al vencer el timer (24hs)

**Liquidaciones tab**:
- Misma estructura, timer de 72hs
- Empresas publican stock a precio de liquidación con tiempo límite
- Nueva entidad: `Liquidacion` con precio especial y fecha de cierre

---

### 4. Tasador

Formulario con tres inputs:
- **Año/Modelo**: select con cascada del catálogo (makes → models)
- **Kilómetros**: input numérico
- **Margen Deseado (%)**: input porcentaje

**MarketThermometer**: gauge que refleja oferta/demanda del modelo en el mercado de la red Reventa.

**Precio Máximo de Toma Sugerido**: cálculo basado en `precio_gremio - descuentos - margen`. Incluye nota de descuentos detectados (cubiertas, estado).

*Ver spec: [[tasador]]*

---

### 5. Mi Agencia

**Header de agencia**: logo circular + nombre + "CUIT Verificado ✓" badge + rating.

**Stats row**: Vehículos en stock / % Operaciones exitosas / Tiempo promedio de respuesta / Calificación promedio.

**"Nuestro Stock"**: grilla 2×N de VehicleCardDark con "Ver todos" link.

*Ver spec: [[mi_agencia]]*

---

## Cambios en entidades existentes

### Pre-Toma con countdown

- Agregar campo `expires_at: DateTime` en `vehicles` (nullable, solo para pre_toma)
- Al crear/cambiar a `pre_toma`, `expires_at = now() + 24h`
- Endpoint `GET /vehicles/pre-toma` filtra además `expires_at > now()`
- Job/check periódico: vehículos pre_toma con `expires_at` vencida → status vuelve a `available` o a nuevo status `expired_pre_toma`
- Frontend muestra countdown calculado como `expires_at - now()`

### Nueva entidad: Liquidacion

```sql
liquidaciones
  id           UUID PK
  vehicle_id   UUID FK → vehicles.id
  company_id   UUID FK → companies.id
  price        DECIMAL
  expires_at   TIMESTAMP  (now() + 72h)
  created_at   TIMESTAMP
```

---

## Impacto técnico por área

### Backend (nuevas entidades y endpoints)

- `app/models/client_request.py` — La Lonja
- `app/models/liquidacion.py` — Liquidaciones
- `app/services/match.py` — lógica de matching solicitud↔stock
- `app/api/v1/endpoints/lonja.py`
- `app/api/v1/endpoints/tasador.py`
- `app/api/v1/endpoints/liquidaciones.py`
- `vehicles` tabla: `expires_at` nullable

### Frontend (rediseño completo)

- `src/components/ui/BottomNav.tsx` — nueva nav inferior
- `src/components/ui/TabToggle.tsx` — pills de tab
- `src/components/ui/VehicleCardDark.tsx` — card oscura con countdown
- `src/components/ui/ClientRequestCard.tsx`
- `src/components/ui/MatchCard.tsx`
- `src/components/ui/StatsRow.tsx`
- `src/components/ui/MarketThermometer.tsx`
- `src/pages/home/Home.tsx` — dashboard con matches + alertas
- `src/pages/lonja/Lonja.tsx` + `PublishClientRequest.tsx`
- `src/pages/tasador/Tasador.tsx`
- `src/pages/agency/MyAgency.tsx`
- `src/pages/marketplace/Mercado.tsx` — refactor con tabs + liquidaciones
- `src/App.tsx` — nueva estructura de rutas bajo layout mobile

### Layout global

- Eliminar sidebar/header nav actual para company users
- Nuevo `MobileLayout.tsx` con `<Outlet />` + `<BottomNav />` fijo abajo
- `Header.tsx` queda simplificado: solo logo + campana notificaciones (sin links de navegación)
- Padding bottom en todas las páginas para no quedar tapadas por la nav

---

## Prioridad de implementación sugerida

1. **Sistema de diseño base**: BottomNav, TabToggle, VehicleCardDark, paleta, tipografía → unifica la app visualmente
2. **Mercado rediseñado**: refactor con nuevo diseño + tabs Pre-Tomas/Liquidaciones + countdown
3. **Mi Agencia**: perfil + stats + stock preview
4. **La Lonja**: nueva feature completa
5. **Tasador**: requiere datos de mercado (precio gremio por modelo)
6. **Match automático**: feature más compleja, depende de La Lonja + stock

## Checklist

- [ ] Sistema de diseño: paleta + componentes base documentados en Storybook o similar
- [ ] BottomNav implementado y funcionando en mobile
- [ ] Mercado refactorizado con VehicleCardDark
- [ ] Pre-Tomas con countdown (expires_at)
- [ ] Liquidaciones (nueva entidad + tab)
- [ ] Mi Agencia con stats reales
- [ ] La Lonja: publicar búsqueda + ver solicitudes + ofrecer stock
- [ ] Tasador: cálculo de precio máximo de toma
- [ ] Match Directo: notificación + MatchCard en Inicio
- [ ] Responsive: layout funciona correctamente en móvil
