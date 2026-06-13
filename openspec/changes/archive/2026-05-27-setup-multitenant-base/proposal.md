---
title: Setup base multi-tenant con auth y gestión de empresas
type: feature
status: in-progress
spec: auth, companies, users
created: 2026-05-26
---

# Setup base multi-tenant con auth y gestión de empresas

## Descripción

Implementación inicial del sistema: infraestructura Docker, backend FastAPI, frontend React, base de datos PostgreSQL, y el sistema multi-tenant completo con autenticación JWT y roles.

## Cambios realizados

### Infraestructura
- `docker-compose.yml` — orquesta DB, backend y frontend
- `.env.example` — variables de entorno documentadas
- `backend/Dockerfile`, `frontend/Dockerfile`

### Backend (FastAPI)
- Estructura modular: `core/`, `models/`, `schemas/`, `repositories/`, `services/`, `api/v1/`
- Modelos SQLAlchemy async: `Company`, `User` con enum `Role`
- Migración Alembic: `0001_initial_schema.py`
- Autenticación JWT con bcrypt (`core/security.py`)
- Seed automático del super admin desde env vars (`core/seed.py`)
- API versionada `/api/v1/` con endpoints de auth, companies y users

### Frontend (React + TypeScript + Vite)
- `AuthContext` con estado global de sesión y token en localStorage
- `ProtectedRoute` con guardado por rol
- Páginas: `Login`, `admin/Companies`, `admin/CompanyDetail`
- Servicio HTTP centralizado con inyección automática del Bearer token

## Checklist

- [x] Docker Compose funcional
- [x] Modelos y migración inicial
- [x] Auth JWT con seed de super admin
- [x] CRUD de empresas (super admin)
- [x] CRUD de usuarios por empresa (super admin y company admin)
- [x] Frontend con login y panel de administración
- [x] Rutas protegidas por rol
