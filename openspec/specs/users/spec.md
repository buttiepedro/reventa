---
title: Gestión de Usuarios
status: active
created: 2026-05-26
---

# Gestión de Usuarios

## Purpose

Gestionar el ciclo de vida de usuarios dentro de empresas. Los usuarios pertenecen a exactamente una empresa y tienen un rol que determina sus permisos. La creación ocurre en el contexto de una empresa; la modificación e inhabilitación se hacen vía endpoints individuales.

## Contexto

- Modelo: `User` con `email` (único global), `hashed_password` (bcrypt), `full_name`, `role`, `company_id` (nullable para super_admin), `is_active`, timestamps
- Roles asignables vía API: solo `company_admin` y `company_user`
- Al eliminar empresa: usuarios se borran en CASCADE

## Requirements

### Requirement: Consulta de perfil de usuario

Los usuarios SHALL acceder a datos de usuarios dentro de sus permisos.

#### Scenario: Usuario consulta su propio perfil

- **WHEN** un usuario autenticado llama `GET /api/v1/users/{su_id}`
- **THEN** recibe sus datos con status 200

#### Scenario: company_admin consulta usuario de su empresa

- **WHEN** un `company_admin` llama con el `user_id` de un usuario de su empresa
- **THEN** recibe los datos del usuario con status 200

#### Scenario: Acceso a usuario de otra empresa

- **WHEN** un usuario intenta ver a alguien de otra empresa
- **THEN** recibe status 403

#### Scenario: super_admin consulta cualquier usuario

- **WHEN** el `super_admin` llama con cualquier `user_id` válido
- **THEN** recibe los datos con status 200

### Requirement: Actualización de usuario

Los admins SHALL actualizar datos y rol de usuarios en su scope.

#### Scenario: Actualización exitosa por company_admin

- **WHEN** un `company_admin` envía datos parciales a `PUT /api/v1/users/{id}` para un usuario de su empresa
- **THEN** recibe el usuario actualizado con status 200

#### Scenario: company_user intenta actualizar a otro usuario

- **WHEN** un `company_user` intenta actualizar a cualquier usuario
- **THEN** recibe status 403

### Requirement: Eliminación de usuario

Los admins SHALL eliminar usuarios dentro de su scope.

#### Scenario: Eliminación exitosa

- **WHEN** un `company_admin` o `super_admin` llama `DELETE /api/v1/users/{id}`
- **THEN** el usuario es eliminado y se devuelve status 204

#### Scenario: Usuario no encontrado

- **WHEN** se intenta eliminar un `user_id` inexistente
- **THEN** recibe status 404

## Implementación

- `app/models/user.py`, `app/services/user.py`, `app/repositories/user.py`
- `app/api/v1/endpoints/users.py`
