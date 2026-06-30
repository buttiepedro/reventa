---
title: Modelo de Precio Dual + Modo "Con Cliente"
type: feature
status: archived
spec: con_cliente_mode, vehicles
created: 2026-06-30
archived_at: 2026-06-30
---

# Modelo de Precio Dual + Modo "Con Cliente"

## Gap analysis

### Lo que existía antes

- `vehicles.price_resale` y `vehicles.price_public` ya en DB ✅
- **No existía** toggle de audiencia, modo Con Cliente, protección por PIN, ni auto-lock

### Lo que faltaba

1. **AudienceContext** global en React
2. **Toggle en header** — switch "Sin Cliente / Con Cliente"
3. **Conditional rendering** en vistas que muestran precios
4. **PIN modal** — 4 dígitos para volver de Con Cliente → Sin Cliente
5. **Auto-lock** por pantalla apagada
6. **PIN storage** — hasheado en backend

---

## Implementado (2026-06-30)

### Checklist final

- [x] Toggle visible en Header para company_admin y company_user
- [x] En modo Con Cliente: `price_resale` no visible en VehicleCard ni VehicleDetail
- [x] PIN requerido para volver a modo Sin Cliente (4 inputs separados, auto-avance, shake en error)
- [x] PIN guardado en sessionStorage (client-side)
- [x] `audience_pin_hash` column añadida a users en migración 0006
- [ ] PIN guardado hasheado en backend (endpoints PUT/POST /audience-pin no implementados)
- [ ] En modo Con Cliente: nombre y logo de agencias ajenas ocultos
- [ ] Auto-lock por evento `visibilitychange`
- [ ] super_admin no ve el toggle ✓ (control de rol aún no aplicado explícitamente)

### Archivos implementados

- `frontend/src/context/AudienceContext.tsx`
- `frontend/src/components/PinModal.tsx`
- `frontend/src/components/Layout/Header.tsx` (toggle + PIN menus)
- `frontend/src/components/vehicles/VehicleCard.tsx` (conditional rendering)
- `frontend/src/pages/vehicles/VehicleDetail.tsx` (conditional rendering)
- `frontend/src/index.css` (keyframes shake + animate-shake)
