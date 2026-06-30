---
title: Mi Agencia Foundation — CUIT Gatekeeper + Radar + Reputación
type: feature
status: archived
spec: mi_agencia
created: 2026-06-30
archived_at: 2026-06-30
---

# Mi Agencia Foundation — CUIT Gatekeeper + Radar + Reputación

## Gap analysis

### Lo que existía antes

```python
# Campos de companies antes de esta implementación:
id, name, slug, is_active, created_at, updated_at
```

Faltaban todos los campos de perfil, radar, reputación, y la página Mi Agencia.

---

## Implementado (2026-06-30)

### Checklist final

#### Extensión del modelo Company
- [x] Campos en migración 0006: `cuit`, `verification_status`, `logo_url`, `description`, `phone`, `lat`, `lng`, `address_text`, `avg_rating`, `total_ratings`
- [x] `GET /companies/me/profile`, `PATCH /companies/me/profile`

#### Radar de Reposición
- [x] Tabla `radar_entries` en migración 0006
- [x] `GET /companies/me/radar`, `POST /companies/me/radar`, `DELETE /companies/me/radar/{entry_id}`
- [x] Tab Radar en MyAgency.tsx con lista + formulario
- [ ] Pre-Toma filtra notificaciones por radar (backward compat implementado: si nadie tiene radar, notifica a todos)
- [ ] Onboarding pide configurar radar al crear empresa

#### Reputación
- [x] Tabla `company_ratings` en migración 0006
- [ ] Endpoints de calificación (tabla existe, sin endpoints)
- [ ] Job asincrónico de feedback 5 días post-transacción
- [ ] avg_rating actualizado en tiempo real

#### Mi Agencia (Frontend)
- [x] `frontend/src/pages/agency/MyAgency.tsx` — 3 tabs: Perfil | Conexiones | Radar
- [x] Tab Perfil: campos editables, banner si falta CUIT, link a stock propio
- [x] Tab Radar: CRUD de entradas
- [ ] Stats en tiempo real (vehículos, % exitosas, tiempo respuesta)
- [ ] Upload de logo a S3
- [ ] Banner de empresa pendiente de verificación

#### CUIT Gatekeeper
- [x] Columna `verification_status` en companies
- [ ] Flujo completo de aprobación/rechazo por super_admin
- [ ] Guard en endpoints de vehículos para empresas `pending`
- [ ] Notificación al super_admin de empresa pendiente

### Archivos implementados

- `backend/app/schemas/company.py` (`CompanyProfile`, `CompanyProfileUpdate`, `RadarEntryCreate/Read`)
- `backend/app/api/v1/endpoints/companies.py` (rutas `/me/profile` y `/me/radar`)
- `backend/app/api/v1/router.py` (ya registrado)
- `frontend/src/pages/agency/MyAgency.tsx`
- `frontend/src/types/index.ts` (`CompanyProfile`, `RadarEntry`)
- `frontend/src/services/companyService.ts` (métodos de perfil y radar)
