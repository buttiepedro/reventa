---
title: Gestión de Empresas (Tenants)
status: active
created: 2026-05-26
---

# Gestión de Empresas (Tenants)

## Purpose

Permitir al `super_admin` gestionar las empresas (tenants) del sistema. Cada empresa es un contenedor aislado de usuarios. Solo el super admin puede crear, modificar o eliminar empresas.

## Contexto

- Modelo: `Company` con `id (UUID)`, `name`, `slug` (único, formato `^[a-z0-9-]+$`), `is_active`, timestamps
- Al eliminar una empresa, sus usuarios se eliminan en cascada
- Un usuario pertenece a exactamente una empresa (excepto `super_admin` que no tiene `company_id`)

## Requirements

### Requirement: Listado y creación de empresas

El `super_admin` SHALL gestionar el ciclo de vida completo de empresas.

#### Scenario: Listar empresas

- **WHEN** el `super_admin` llama `GET /api/v1/companies`
- **THEN** recibe un array de empresas con status 200

#### Scenario: Crear empresa con datos válidos

- **WHEN** el `super_admin` envía `{ name, slug }` válidos a `POST /api/v1/companies`
- **THEN** recibe la empresa creada con status 201

#### Scenario: Slug duplicado

- **WHEN** el `super_admin` intenta crear una empresa con un slug ya existente
- **THEN** recibe status 409 con `{ detail: "Slug already taken" }`

#### Scenario: Acceso denegado a roles menores

- **WHEN** un `company_admin` o `company_user` llama `GET /api/v1/companies`
- **THEN** recibe status 403

### Requirement: Acceso al detalle de empresa

Los miembros SHALL ver el detalle de su propia empresa.

#### Scenario: super_admin ve cualquier empresa

- **WHEN** el `super_admin` llama `GET /api/v1/companies/{id}`
- **THEN** recibe el detalle con status 200

#### Scenario: Usuario ve su propia empresa

- **WHEN** un `company_admin` o `company_user` llama con su propio `company_id`
- **THEN** recibe el detalle con status 200

#### Scenario: Usuario intenta ver empresa ajena

- **WHEN** un usuario llama con un `company_id` distinto al suyo
- **THEN** recibe status 403

### Requirement: Gestión de usuarios dentro de empresa

Los admins SHALL crear y listar usuarios en el scope de su empresa.

#### Scenario: Listar usuarios de empresa propia

- **WHEN** un `company_admin` llama `GET /api/v1/companies/{su_id}/users`
- **THEN** recibe la lista de usuarios de su empresa con status 200

#### Scenario: Crear usuario en empresa

- **WHEN** el `super_admin` o `company_admin` envía datos válidos a `POST /api/v1/companies/{id}/users`
- **THEN** se crea el usuario y se devuelve con status 201

#### Scenario: Intento de crear usuario con rol super_admin

- **WHEN** se intenta crear un usuario con `role=super_admin`
- **THEN** recibe status 403

## Implementación

- `app/models/company.py`, `app/services/company.py`, `app/repositories/company.py`
- `app/api/v1/endpoints/companies.py`
- `src/pages/admin/Companies.tsx`, `src/pages/admin/CompanyDetail.tsx`
