---
title: Mi Agencia fase 2 — Ratings, verificación CUIT, logo S3
type: feature
status: proposed
spec: mi_agencia
created: 2026-07-29
---

# Mi Agencia — Fase 2

## Resumen

Completa las funcionalidades pendientes de Mi Agencia: sistema de ratings recibidos, flujo de verificación de CUIT por super admin, upload de logo a S3, y un gating de publicación para empresas no verificadas.

---

## 1. Sistema de ratings recibidos

Depende de la implementación del `semaforo-honestidad`. Una vez que existan `company_ratings`, Mi Agencia necesita mostrarlos.

### Pestaña "Reputación" en Mi Agencia

```tsx
// MiAgencia.tsx — nueva tab "Reputación"
// GET /ratings/{company_id}

interface RatingSummary {
  avg_rating: number | null
  rating_count: number
  reputation_score: number | null  // 0=rojo, 1=amarillo, 2=verde
  recent: RatingItem[]
}
```

UI:
- Semáforo grande (verde/amarillo/rojo) con número de estrellas promedio
- "X calificaciones recibidas"
- Lista de últimas calificaciones: empresa anónima (o iniciales) + score + "El vehículo coincidió: Sí/No" + comentario

---

## 2. Flujo de verificación de CUIT

### Objetivo

Las empresas deben acreditar un CUIT válido antes de poder publicar vehículos. El super admin aprueba o rechaza.

### Modelo de datos

```sql
ALTER TABLE companies
  ADD COLUMN cuit            VARCHAR(13),
  ADD COLUMN cuit_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN cuit_submitted_at TIMESTAMPTZ,
  ADD COLUMN cuit_reviewed_at  TIMESTAMPTZ,
  ADD COLUMN cuit_reviewer_id  UUID REFERENCES users(id);
```

### Flujo

1. **Empresa ingresa su CUIT** en Mi Agencia → pestaña Perfil → campo CUIT
   - POST /companies/me/cuit `{ cuit: "30-12345678-9" }`
   - Validación básica: formato 11 dígitos, dígito verificador (algoritmo módulo 11)
   - Setea `cuit_submitted_at = now()`

2. **Super admin recibe notificación**
   - Notificación interna: `entity_type="cuit_verification_pending"`
   - En el panel de super admin: lista de empresas con CUIT pendiente de verificación

3. **Super admin aprueba o rechaza**
   - PATCH /admin/companies/{id}/verify-cuit `{ approved: true | false, reason?: string }`
   - Si `approved=true`: `cuit_verified = true`, `cuit_reviewed_at = now()`
   - Si `approved=false`: notificación a la empresa con `reason`

4. **Gating en publicación de vehículos**
   - En POST /vehicles: si `company.cuit_verified == false`, error 403:
     ```json
     { "detail": "Tu empresa necesita verificar el CUIT antes de publicar vehículos." }
     ```
   - En el frontend, si el usuario intenta crear un vehículo → toast con link a Mi Agencia

5. **Banner de estado en Mi Agencia**
   ```tsx
   // Sin CUIT ingresado:
   "Completá tu CUIT para poder publicar vehículos en la red"
   // CUIT enviado, pendiente:
   "Tu CUIT está en revisión. Te notificaremos cuando sea aprobado."
   // Verificado:
   "✓ CUIT verificado"
   // Rechazado:
   "Tu CUIT fue rechazado. Motivo: {reason}. Corregilo y volvé a enviar."
   ```

---

## 3. Upload de logo a S3

### Backend

Endpoint:
```
POST /companies/me/logo     → sube logo, actualiza logo_url en companies
DELETE /companies/me/logo   → elimina logo
```

Implementación:
```python
@router.post("/me/logo")
async def upload_logo(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    session = Depends(get_session),
):
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(400, "Formato no soportado")
    if file.size > 2 * 1024 * 1024:  # 2MB
        raise HTTPException(400, "El logo no puede superar 2MB")
    
    key = f"logos/{current_user.company_id}/{uuid4()}{ext}"
    s3.upload_fileobj(file.file, BUCKET, key, ExtraArgs={"ContentType": file.content_type})
    url = f"https://{BUCKET}.s3.amazonaws.com/{key}"
    
    company.logo_url = url
    await session.flush()
    return {"logo_url": url}
```

Columna ya debe existir o agregar:
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
```

### Frontend

En Mi Agencia → pestaña Perfil:

```tsx
// LogoUploader component
<div className="flex items-center gap-4">
  {company.logo_url ? (
    <img src={company.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-cover" />
  ) : (
    <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl">
      {company.name[0]}
    </div>
  )}
  <div>
    <label className="cursor-pointer text-sm text-blue-600 hover:underline">
      {company.logo_url ? "Cambiar logo" : "Subir logo"}
      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
    </label>
    {company.logo_url && (
      <button onClick={handleDeleteLogo} className="block text-xs text-red-400 mt-1">Eliminar</button>
    )}
    <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WEBP · máx 2MB</p>
  </div>
</div>
```

El logo aparece en:
- Perfil de Mi Agencia
- Conexiones (radar) — avatar de empresa conectada
- Mi Agencia pública (cuando se implemente)

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Alembic | `cuit`, `cuit_verified`, `cuit_submitted_at`, `cuit_reviewed_at`, `cuit_reviewer_id` en companies |
| 2 | Alembic | `logo_url` en companies (si no existe) |
| 3 | Backend | POST/DELETE /companies/me/cuit |
| 4 | Backend | PATCH /admin/companies/{id}/verify-cuit |
| 5 | Backend | Gate en POST /vehicles para CUIT no verificado |
| 6 | Backend | POST/DELETE /companies/me/logo con S3 |
| 7 | Backend | Notificación `cuit_verification_pending` al super admin |
| 8 | Frontend | Campo CUIT + estado en Mi Agencia → Perfil |
| 9 | Frontend | Banner de estado de verificación |
| 10 | Frontend | Panel de super admin para aprobar/rechazar |
| 11 | Frontend | `LogoUploader` en Mi Agencia → Perfil |
| 12 | Frontend | Pestaña Reputación (depende de semaforo-honestidad) |

---

## Acceptance criteria

- [ ] Empresa puede ingresar CUIT con validación de formato y dígito verificador
- [ ] Super admin recibe notificación al enviarse un CUIT
- [ ] Aprobación de super admin setea `cuit_verified = true`
- [ ] POST /vehicles devuelve 403 si `cuit_verified = false`
- [ ] Logo sube a S3, URL persiste en `companies.logo_url`
- [ ] Logo visible en perfil de Mi Agencia inmediatamente tras upload
- [ ] Pestaña Reputación muestra semáforo y últimas calificaciones (requiere semaforo-honestidad)
