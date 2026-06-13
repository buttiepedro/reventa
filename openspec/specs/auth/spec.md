---
title: Autenticación y Roles
status: active
created: 2026-05-26
---

# Autenticación y Roles

## Purpose

Proveer un sistema de autenticación JWT con roles diferenciados (`super_admin`, `company_admin`, `company_user`) para soportar el modelo multi-tenant. El super admin se inicializa automáticamente desde variables de entorno en el primer deploy.

## Contexto

- Roles: `super_admin` (global), `company_admin` (por empresa), `company_user` (por empresa)
- Token: JWT HS256, expiración configurable vía `ACCESS_TOKEN_EXPIRE_MINUTES`
- Almacenamiento en cliente: `localStorage`
- Seed automático: al arrancar, si no hay `super_admin`, se crea uno con `ADMIN_EMAIL` / `ADMIN_PASSWORD`

## Requirements

### Requirement: Login con email y contraseña

Los usuarios SHALL autenticarse con email y contraseña y recibir un JWT.

#### Scenario: Login exitoso

- **WHEN** el usuario envía credenciales válidas a `POST /api/v1/auth/login`
- **THEN** recibe `{ access_token, token_type: "bearer" }` con status 200

#### Scenario: Credenciales incorrectas

- **WHEN** el usuario envía email o contraseña incorrectos
- **THEN** recibe status 401 con `{ detail: "Invalid credentials" }`

#### Scenario: Cuenta desactivada

- **WHEN** el usuario tiene `is_active=false`
- **THEN** recibe status 403 con `{ detail: "Account disabled" }`

### Requirement: Acceso a datos propios

Los usuarios autenticados SHALL consultar su propio perfil.

#### Scenario: Token válido

- **WHEN** el usuario llama `GET /api/v1/auth/me` con Bearer token válido
- **THEN** recibe sus datos completos con status 200

#### Scenario: Token inválido o expirado

- **WHEN** el usuario llama con token inválido o sin token
- **THEN** recibe status 401

### Requirement: Seed del super admin

El sistema SHALL crear automáticamente el primer super admin al arrancar si no existe ninguno.

#### Scenario: Primer deploy

- **WHEN** la aplicación arranca y no hay ningún usuario con `role=super_admin` en la DB
- **THEN** se crea un usuario con los valores de `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`

#### Scenario: Deploys subsiguientes

- **WHEN** la aplicación arranca y ya existe un `super_admin`
- **THEN** el seed no ejecuta ninguna acción (idempotente)

### Requirement: Control de acceso por rol

Los endpoints SHALL rechazar requests de usuarios sin el rol requerido.

#### Scenario: super_admin accede a recurso restringido

- **WHEN** un `super_admin` accede a cualquier endpoint protegido
- **THEN** la petición es procesada normalmente

#### Scenario: company_user intenta crear empresa

- **WHEN** un `company_user` o `company_admin` llama a `POST /api/v1/companies`
- **THEN** recibe status 403

## Implementación

- `app/core/security.py` — JWT y bcrypt
- `app/core/seed.py` — seed del super admin
- `app/api/deps.py` — `get_current_user`, `require_super_admin`, `require_admin`
- `src/context/AuthContext.tsx` — estado global en frontend
- `src/components/ProtectedRoute.tsx` — guardia de rutas por rol
