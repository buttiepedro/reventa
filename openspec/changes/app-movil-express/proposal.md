---
title: App Móvil Express — PWA con VAPID Push (segundo frontend)
type: feature
status: proposed
spec: pre_toma_express
created: 2026-07-29
---

# App Móvil Express — Pre-Toma Express + Push Notifications

## Resumen

Segundo frontend completo como Progressive Web App (PWA), desplegado en un **subdominio** del dominio principal (ej: `express.reventa.app`). Orientado 100% a mobile. Permite que un playero o captador cargue una pre-toma desde el campo en ~30 segundos (3 fotos + precio) y reciba notificaciones push vía VAPID sin necesidad de una app nativa.

El frontend principal (`reventa.app`) no cambia su stack. Este es un proyecto Vite/React independiente que comparte la misma API backend.

---

## Motivación

El flujo actual de carga de Pre-Tomas desde el frontend desktop requiere varios pasos y no está optimizado para fotos desde cámara. Los captadores de campo necesitan:

1. Cargar rápido, con poca conectividad
2. Cámara directa del teléfono (no gallery picker)
3. Recibir alertas en tiempo real sin tener la app abierta

---

## Alcance del segundo frontend

### Stack
- **Vite + React + TypeScript** (misma base que el frontend principal)
- **Tailwind CSS v4** — misma config
- **Directorio raíz**: `frontend-mobile/` en el monorepo
- **Dominio**: `express.{APP_DOMAIN}` (variable de entorno)
- **Build target**: PWA — `vite-plugin-pwa` (Workbox)

### Autenticación
Reutiliza el mismo JWT del backend. El login mobile puede ser una pantalla simplificada (email + password) que guarda el token en `localStorage` igual que el frontend principal. No hay sesión compartida automática entre subdominios (el usuario hace login en express por separado).

### Estructura de rutas (mobile)
```
/login          → LoginMobile
/               → DashboardMobile (Pre-Tomas pendientes + botón +)
/express/new    → ExpressUploadPage (flujo de 3 pasos)
/express/:id    → ExpressDetailPage (estado de la pre-toma)
```

---

## Flujo Express Upload (≤ 30 segundos)

### Paso 1 — Fotos (cámara)
```html
<input type="file" accept="image/*" capture="environment" multiple />
```
- 3 slots de foto (frente, lateral, interior)
- Preview inline
- Resize antes de upload: max 1200px, calidad 0.8 (evita timeout en 4G lento)

### Paso 2 — Datos mínimos
- Marca / Modelo / Año (autocomplete con catálogo existente)
- Kilometraje
- Precio de toma ofrecido

### Paso 3 — Confirmar
- Resumen en una pantalla
- Botón "Publicar Pre-Toma" → POST /vehicles con `status=pre_toma`
- Redirect a lista con toast "¡Pre-Toma publicada!"

### UX constraints
- Sin BottomNav, sin sidebar — pantalla completa de paso a paso
- Botones grandes (min 48px touch target)
- Sin scroll horizontal
- Funciona en 3G

---

## VAPID Push Notifications

### Backend — nuevas piezas

#### Tabla `push_subscriptions`
```sql
CREATE TABLE push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

#### Dependencia Python
```
pywebpush==2.0.0
```

#### Endpoints nuevos
```
POST   /push/subscribe        → guarda/actualiza suscripción del device
DELETE /push/subscribe        → elimina suscripción (logout)
POST   /push/test             → envía notificación de prueba (solo admin)
```

#### Función interna `send_push(company_id, title, body, url)`
- Consulta todas las `push_subscriptions` de la company
- Llama a `webpush()` de pywebpush por cada endpoint
- Si el endpoint devuelve 410 (Gone), elimina la suscripción
- Fire-and-forget (no bloquea la request HTTP)

#### Variables de entorno nuevas
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_CLAIM_EMAIL=noreply@reventa.app
```

Generar con:
```python
from py_vapid import Vapid
v = Vapid()
v.generate_keys()
print(v.public_key)
print(v.private_key)
```

#### Integrar en eventos existentes
| Evento | Trigger | Receptor |
|--------|---------|----------|
| Nueva pre-toma en la red | `status = pre_toma` en POST /vehicles | Todas las companies con interés configurado |
| Lonja match | `_run_auto_match` en POST /lonja/requests | Companies con vehículos matching |
| Oferta aceptada | PATCH /offers/:id → `accepted` | Offering company |
| Lonja: nueva oferta | POST /lonja/requests/:id/offers | Requesting company |

### Frontend mobile — Service Worker

#### Registro
```typescript
// main.tsx (frontend-mobile)
if ('serviceWorker' in navigator) {
  const reg = await navigator.serviceWorker.register('/sw.js')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: VAPID_PUBLIC_KEY,
  })
  await api.post('/push/subscribe', {
    endpoint: sub.endpoint,
    p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))),
    auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))),
  })
}
```

#### Service Worker (`sw.js` via vite-plugin-pwa)
```javascript
self.addEventListener('push', (event) => {
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### Frontend principal — también puede suscribirse
El frontend principal (`reventa.app`) puede incluir el mismo bloque de suscripción en su `App.tsx` después del login. Las notificaciones push llegarán al device esté en el subdominio o en el principal.

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Alembic | Crear tabla `push_subscriptions` |
| 2 | Alembic | Agregar `VAPID_PUBLIC_KEY` a config |
| 3 | Backend | Nuevo router `/push` con 3 endpoints |
| 4 | Backend | `send_push()` helper en `app/services/push.py` |
| 5 | Backend | Integrar `send_push()` en lonja, vehicles, offers |
| 6 | Frontend mobile | Nuevo proyecto `frontend-mobile/` |
| 7 | DevOps | Subdominio + build pipeline para `frontend-mobile/` |

---

## Acceptance criteria

- [ ] Usuario puede instalar el PWA desde el navegador mobile ("Agregar a pantalla de inicio")
- [ ] Pre-Toma cargada desde mobile aparece en el frontend principal < 5 segundos
- [ ] Push notification llega al device con la app cerrada cuando otra agencia publica una pre-toma
- [ ] Service Worker cachea assets core para funcionar offline (solo UI — requests requieren conexión)
- [ ] Upload de 3 fotos desde cámara funciona en iOS Safari y Android Chrome
- [ ] Tiempo de carga express (3 fotos + datos + confirmar) ≤ 60 segundos en 4G

---

## Out of scope (v1)

- App nativa (iOS/Android) — el PWA cubre el caso de uso
- Sincronización offline de datos (solo cache de UI)
- Push para el frontend desktop (el service worker es opt-in)
- Notificaciones email — queda para otra propuesta
