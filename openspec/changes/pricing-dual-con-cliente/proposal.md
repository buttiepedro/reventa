---
title: Modelo de Precio Dual + Modo "Con Cliente"
type: feature
status: proposed
spec: con_cliente_mode, vehicles
created: 2026-06-30
---

# Modelo de Precio Dual + Modo "Con Cliente"

## Gap analysis

### Lo que existe hoy

- `vehicles.price_resale` (precio gremio/costo B2B) y `vehicles.price_public` (precio al público) **ya existen en el modelo** y la DB ✅
- El formulario VehicleForm tiene ambos campos ✅
- **No existe** ningún toggle de audiencia en la UI
- **No existe** modo Con Cliente — todos los precios siempre son visibles
- **No existe** protección por PIN
- **No existe** auto-lock

### Lo que falta

1. **AudienceContext** global en React — controla si se está en modo `dealer` o `client`
2. **Toggle en header** — switch "Sin Cliente / Con Cliente" visible en BottomNav o Header
3. **Conditional rendering** en todas las vistas que muestran precios o nombres de agencia
4. **PIN modal** — 4 dígitos requeridos para volver de Con Cliente → Sin Cliente
5. **Auto-lock** — si la pantalla se apaga mientras está en Sin Cliente y el modo Con Cliente estuvo activo recientemente, al volver bloquea automáticamente
6. **PIN storage** — el PIN se guarda hasheado en el backend por usuario (no solo en cliente)

---

## Cambios requeridos

### Backend (mínimo — el PIN)

```
PUT  /api/v1/users/me/audience-pin     → guardar/cambiar PIN (hash bcrypt)
POST /api/v1/users/me/audience-pin/verify → verificar PIN (retorna true/false)
```

- Agregar columna `audience_pin_hash VARCHAR(60) nullable` a tabla `users`
- Migración correspondiente

### Frontend

**`src/context/AudienceContext.tsx`** (nuevo)
```typescript
type AudienceMode = 'dealer' | 'client'
// - estado global: mode, setMode
// - requirePin(): abre PinModal antes de cambiar a 'dealer'
// - autoLock(): lógica visibilitychange
```

**`src/components/ui/AudienceToggle.tsx`** (nuevo)
- Toggle pill "💼 Sin Cliente / 👥 Con Cliente" en Header
- Al activar Con Cliente: inmediato, sin PIN
- Al desactivar: dispara requirePin()

**`src/components/ui/PinModal.tsx`** (nuevo)
- Input 4 dígitos (dots), botón confirmar
- En primer uso: flujo de creación de PIN (input + confirmación)
- Llama a `POST /audience-pin/verify` antes de permitir el cambio

**Conditional rendering en vistas existentes**:
- `NetworkCatalog.tsx` / `VehicleCardDark.tsx` — ocultar `price_resale` y `company.name`
- `VehicleDetail.tsx` — ocultar sección "Info de agencia" en modo client
- `PreTomaFeed.tsx` — ocultar nombre de empresa
- Navegación — en modo client, ocultar tabs Mi Stock / Favoritas / admin

**Auto-lock (`src/hooks/useAutoLock.ts`)**:
- `document.addEventListener('visibilitychange')`
- Si `document.hidden` y `mode === 'dealer'` con histórico de Con Cliente en la sesión → `setMode('client')`

---

## Criterios de aceptación

- [ ] Toggle visible en la UI para company_admin y company_user
- [ ] En modo Con Cliente: `price_resale` no visible en ninguna pantalla
- [ ] En modo Con Cliente: nombre y logo de agencias ajenas no visibles
- [ ] PIN requerido para volver a modo Sin Cliente
- [ ] PIN guardado de forma segura en backend (hash)
- [ ] Auto-lock funciona en dispositivo móvil real
- [ ] super_admin no ve el toggle (no aplica)
