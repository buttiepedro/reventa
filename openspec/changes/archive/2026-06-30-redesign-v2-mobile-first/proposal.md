---
title: Rediseño Visual Mayor + Nuevas Secciones (v2 Mobile-First)
type: feature
status: archived
spec: vehicles, marketplace, pre_toma, la_lonja, tasador, mi_agencia
created: 2026-06-30
archived_at: 2026-06-30
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

#### ClientRequestCard
Card de solicitud de La Lonja con presupuesto, categoría, filtros y CTA.

#### MatchCard
Card destacada en Inicio cuando hay un match directo.

#### StatsRow
Fila de 4 métricas con valor grande + label pequeño debajo.

#### TabToggle (pill)
Selector de tab estilo pill, fondo gris claro, tab activo en verde con texto blanco.

#### MarketThermometer
Gauge semicircular de verde a rojo con aguja y label de posición.

#### AgencyBadge
Logo circular + nombre + badge "CUIT Verificado ✓" + stars.

### Navegación inferior (BottomNav)

5 tabs fijos, siempre visibles:
```
[ 🏠 Inicio ] [ ♟ La Lonja ] [ 🛒 Mercado ] [ 📊 Tasador ] [ 👤 Mi Agencia ]
```

---

## Implementado (2026-06-30)

### Checklist final

- [x] Sistema de diseño: paleta + componentes base (green-600 primary, BottomNav, Tailwind v4)
- [x] BottomNav implementado y funcionando en mobile (`src/components/Layout/BottomNav.tsx`)
- [x] Mercado refactorizado con cards de vehículos
- [x] Pre-Tomas con countdown (expires_at + TTL 24h + scheduler asyncio)
- [x] Mi Agencia: página con tabs Perfil / Conexiones / Radar
- [x] La Lonja: publicar solicitud + ver solicitudes + ofrecer stock + ranking
- [x] Tasador: cálculo con datos de red interna + termómetro lineal
- [x] Responsive: layout mobile-first con BottomNav fijo
- [ ] Liquidaciones — tabla creada en migración, tab UI muestra "próximamente"
- [ ] Match Directo automático — tablas creadas, lógica de match no implementada
- [ ] MarketThermometer SVG gauge semicircular — implementado como barra lineal
