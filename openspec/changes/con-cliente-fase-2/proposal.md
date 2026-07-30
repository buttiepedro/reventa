---
title: Con Cliente fase 2 — PIN backend + auto-lock
type: feature
status: proposed
spec: con_cliente_mode
created: 2026-07-29
---

# Con Cliente — Fase 2

## Resumen

Completa las funcionalidades pendientes del modo Con Cliente: persistencia del PIN en backend (actualmente solo está en localStorage), auto-lock por inactividad de pantalla, y restricción de navegación en modo activo.

---

## Estado actual

- [x] Toggle Con Cliente en frontend (AudienceContext)
- [x] PIN verificado localmente en frontend
- [x] Ocultamiento de `company_name` en VehicleCard y VehicleDetail
- [x] Ocultamiento de `price_resale` en modo cliente
- [ ] PIN hasheado en backend
- [ ] Auto-lock por `visibilitychange`
- [ ] Restricción de tabs de navegación en modo Con Cliente

---

## 1. PIN en backend (hash bcrypt)

### Motivación

El PIN actual se valida localmente, lo que significa que cualquier usuario con acceso al localStorage puede extraerlo o eludirlo. El PIN debe vivir en el backend como hash bcrypt.

### Endpoints nuevos

```
PUT  /users/me/audience-pin     → establece o cambia el PIN
POST /users/me/audience-pin/verify → verifica un PIN candidato (no devuelve el hash)
DELETE /users/me/audience-pin   → elimina el PIN (deshabilita protección)
```

La columna `audience_pin_hash` ya existe en `users` según la migración anterior.

#### PUT /users/me/audience-pin

```python
class PinSet(BaseModel):
    pin: str  # 4–8 dígitos

@router.put("/me/audience-pin")
async def set_audience_pin(data: PinSet, current_user=Depends(get_current_user), session=Depends(get_session)):
    if not data.pin.isdigit() or not (4 <= len(data.pin) <= 8):
        raise HTTPException(400, "El PIN debe tener entre 4 y 8 dígitos")
    current_user.audience_pin_hash = bcrypt.hashpw(data.pin.encode(), bcrypt.gensalt()).decode()
    await session.flush()
    return {"ok": True}
```

#### POST /users/me/audience-pin/verify

```python
class PinVerify(BaseModel):
    pin: str

@router.post("/me/audience-pin/verify")
async def verify_audience_pin(data: PinVerify, current_user=Depends(get_current_user)):
    if not current_user.audience_pin_hash:
        return {"valid": True}  # sin PIN configurado = libre acceso
    valid = bcrypt.checkpw(data.pin.encode(), current_user.audience_pin_hash.encode())
    return {"valid": valid}
```

### Migración de frontend

- Al activar Con Cliente: `POST /users/me/audience-pin/verify` con el PIN ingresado
- Si `valid: true` → activar modo
- Eliminar la lógica local de validación de PIN en `AudienceContext`
- El PIN sigue ingresándose en el frontend (no se transmite por JWT) — solo la verificación viaja al backend

### Configuración de PIN desde Mi Agencia

Nueva sección en Mi Agencia → Perfil → "Seguridad":
```tsx
// Si no tiene PIN:
"Configurar PIN de Con Cliente"
[Ingresar PIN] [Confirmar PIN] → PUT /users/me/audience-pin

// Si tiene PIN:
"PIN configurado  ✓"
[Cambiar PIN] [Eliminar PIN]
```

---

## 2. Auto-lock por visibilitychange

### Motivación

Si el usuario activa Con Cliente y luego minimiza la app o bloquea el teléfono, al volver la app debería volver al modo seguro (pedir PIN de nuevo). Esto previene que el cliente tome el teléfono y navegue libremente.

### Implementación

En `AudienceContext.tsx`:

```tsx
useEffect(() => {
  if (!isClientMode) return

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      // Marcar que se necesita re-autenticar al volver
      sessionStorage.setItem('audience_lock_pending', 'true')
    }
    if (document.visibilityState === 'visible') {
      const needsLock = sessionStorage.getItem('audience_lock_pending')
      if (needsLock) {
        sessionStorage.removeItem('audience_lock_pending')
        setIsClientMode(false)  // desactiva modo, fuerza PIN al reactivar
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [isClientMode])
```

**Tiempo de gracia configurable (opcional):** solo lockear si `hidden` duró más de N segundos (evitar falsos positivos al cambiar de tab un momento). Implementar con `Date.now()` al entrar a hidden vs al volver.

---

## 3. Restricción de tabs en modo Con Cliente

En modo Con Cliente, el cliente no debería poder navegar a Mi Stock, La Lonja, Mi Agencia, o Tasador (info interna).

### Implementación en BottomNav

```tsx
// BottomNav.tsx
const { isClientMode } = useAudience()

// En modo Con Cliente, solo mostrar tabs permitidas:
const visibleTabs = isClientMode
  ? [{ to: '/mercado', icon: ShopIcon, label: 'Mercado' }]  // solo mercado
  : ALL_TABS

// Si el usuario intenta navegar a una ruta restringida via URL:
// Agregar guard en las rutas privadas (React Router)
```

### Guard de ruta

```tsx
// ProtectedFromClientMode.tsx
export function ProtectedFromClientMode({ children }: { children: ReactNode }) {
  const { isClientMode } = useAudience()
  const navigate = useNavigate()
  
  useEffect(() => {
    if (isClientMode) navigate('/mercado', { replace: true })
  }, [isClientMode])
  
  return isClientMode ? null : <>{children}</>
}
```

Envolver rutas internas en `<ProtectedFromClientMode>`.

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Backend | PUT /users/me/audience-pin (set PIN) |
| 2 | Backend | POST /users/me/audience-pin/verify |
| 3 | Backend | DELETE /users/me/audience-pin |
| 4 | Frontend | Migrar validación local → POST /verify en AudienceContext |
| 5 | Frontend | Sección "Seguridad" en Mi Agencia → Perfil |
| 6 | Frontend | `visibilitychange` auto-lock en AudienceContext |
| 7 | Frontend | Restricción de tabs en BottomNav en modo cliente |
| 8 | Frontend | `ProtectedFromClientMode` guard en rutas internas |

---

## Acceptance criteria

- [ ] PUT /users/me/audience-pin guarda hash bcrypt (no el PIN en texto plano)
- [ ] POST /verify devuelve `{ valid: true/false }` sin revelar el hash
- [ ] Al minimizar app con Con Cliente activo y volver, se requiere PIN de nuevo
- [ ] En modo Con Cliente, BottomNav solo muestra tab Mercado
- [ ] Navegar directamente a /stock o /lonja en modo Con Cliente redirige a /mercado
- [ ] PIN sin configurar = con cliente se puede activar sin PIN (comportamiento existente)
