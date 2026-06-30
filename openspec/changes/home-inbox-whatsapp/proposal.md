---
title: Home Dashboard v2 — Inbox Transaccional + Integración WhatsApp
type: feature
status: proposed
spec: la_lonja, notifications
created: 2026-06-30
---

# Home Dashboard v2 — Inbox Transaccional + Integración WhatsApp

## Gap analysis

### Lo que existe hoy

- `Home.tsx` es una página básica/placeholder ✅ (existe el archivo)
- Sistema de notificaciones in-app con polling 30s ✅
- Badge de campana en header ✅
- **No existe** sección de inbox de matches/ofertas directas en Home
- **No existe** ninguna integración con WhatsApp
- **No existe** actividad resumida (consultas, ofertas, match directos, vehículos)
- **No existe** sección "Alertas y novedades" tipo feed

### Lo que falta

1. **Home rediseñado** con dashboard de actividad, inbox de matches y alertas
2. **MatchCard** para matches directos y ofertas recibidas en La Lonja
3. **Integración WhatsApp** — deeplink `https://wa.me/{phone}?text=...` con mensajes pre-formateados
4. **Stats de actividad** — contadores en tiempo real desde el backend
5. **Feed de alertas** — agrupación de notificaciones recientes por tipo

---

## Cambios requeridos

### Backend

**`GET /api/v1/home/stats`** (nuevo endpoint)
```json
{
  "consultas_recibidas": 12,
  "ofertas_pendientes": 5,
  "match_directos": 3,
  "vehiculos_publicados": 8
}
```
Calcula en tiempo real desde: notificaciones no leídas por tipo, vehículos activos, ofertas en La Lonja.

**`GET /api/v1/home/inbox`** (nuevo endpoint)
Devuelve los ítems más recientes del inbox transaccional:
- Matches directos pendientes (de La Lonja)
- Ofertas de stock recibidas para mis búsquedas
- Aceptaciones de pre-tomas
Paginado, los 10 más recientes.

**Campo `phone` en Company** (o en User con rol company_admin):
```sql
ALTER TABLE companies ADD COLUMN phone VARCHAR(30) nullable;
```
Necesario para construir el deeplink de WhatsApp.

### Frontend

**`src/pages/home/Home.tsx`** (refactor completo)

Estructura de la pantalla:
```
[Barra de búsqueda global]
[Toggle Sin Cliente / Con Cliente]
[MatchCard (si hay match activo)]
[StatsRow: Consultas / Ofertas / Matches / Vehículos]
[Alertas y novedades — últimas 5 notificaciones]
```

**`src/components/ui/MatchCard.tsx`** (nuevo)
```typescript
// Props: matchType ('lonja_offer' | 'pre_toma_acceptance' | 'direct_match')
// Muestra: descripción del match, agencia, precio
// Botones: Aceptar | Rechazar | WhatsApp
```

**WhatsApp deeplink** (utilidad `src/utils/whatsapp.ts`):
```typescript
export function buildWhatsAppUrl(phone: string, template: WhatsAppTemplate, vars: Record<string, string>): string {
  const text = TEMPLATES[template].replace(/{(\w+)}/g, (_, k) => vars[k] ?? '')
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
}

const TEMPLATES = {
  lonja_offer: "Hola! Soy {sender_name} de {sender_agency}. Vi tu búsqueda de {category} en La Lonja de Reventa. Tengo un {vehicle} en {price} que podría interesarte.",
  pre_toma_acceptance: "Hola {receiver_name}! Te escribo por la Pre Toma del {vehicle} que publicaste en Reventa. Estoy interesado/a. ¿Podemos hablar?",
  match_direct: "Hola! Soy {sender_name} de {sender_agency}. Reventa detectó que tengo el {vehicle} que tu cliente está buscando. ¿Lo hablamos?",
}
```

**`src/components/ui/StatsRow.tsx`** (nuevo)
- Llama a `GET /home/stats` al montar + cada 60s
- 4 chips: número grande + label pequeño

**`src/components/ui/AlertFeed.tsx`** (nuevo)
- Toma las últimas 5 notificaciones del `notificationService`
- Muestra icono por tipo, texto, link y tiempo relativo

---

## Criterios de aceptación

- [ ] Home muestra resumen de actividad (stats de 4 métricas)
- [ ] MatchCard visible cuando hay matches o ofertas pendientes
- [ ] Botón WhatsApp en MatchCard abre WhatsApp con mensaje pre-formateado
- [ ] Feed de alertas muestra notificaciones recientes con link
- [x] Toggle Sin Cliente / Con Cliente visible en Header — implementado 2026-06-30
- [ ] Home se actualiza cada 60s sin recargar la página

## Estado parcial (2026-06-30)

**Implementado:**
- Sistema de notificaciones in-app completo: tabla `notifications`, polling 30s, badge en Header
- Toggle Con Cliente / Sin Cliente en Header (parte de pricing-dual-con-cliente)
- Columna `phone` en companies (migración 0006)

**Pendiente:**
- `GET /home/stats` endpoint (consultas, ofertas, matches, vehículos)
- `GET /home/inbox` endpoint con matches y ofertas recientes
- MatchCard component en Home
- StatsRow con datos reales
- AlertFeed usando notificaciones
- WhatsApp deeplinks (`src/utils/whatsapp.ts`)
