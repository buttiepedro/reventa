---
title: Modo "Con Cliente" (Audiencia Dual)
status: active
created: 2026-06-30
implemented: 2026-06-30
---

# Modo "Con Cliente" (Audiencia Dual)

## Purpose

Toggle global que permite a los usuarios de agencia cambiar el modo de visualización de la app entre vista B2B interna (`Sin Cliente`) y vista pública presentable al cliente final (`Con Cliente`). En modo Con Cliente se ocultan precios mayoristas, nombres de otras agencias e información competitiva.

## Contexto

- Los campos `price_resale` (precio gremio B2B) y `price_public` ya existen en el modelo `Vehicle`
- El toggle es **client-side** para renderizado — el backend siempre devuelve ambos precios para usuarios autenticados con empresa
- La protección real contra abuso es el PIN para desactivar + auto-lock
- `super_admin` no usa este toggle (no tiene clientes)

## Modos

### Modo [💼 Sin Cliente] (default)

| Campo | Visible |
|-------|---------|
| Precio Gremio (price_resale) | ✅ |
| Precio Público (price_public) | ✅ |
| Nombre de la agencia vendedora | ✅ |
| Logo de agencia | ✅ |
| Datos de contacto agencia | ✅ |
| Toda la UI completa | ✅ |

### Modo [👥 Con Cliente]

| Campo | Visible |
|-------|---------|
| Precio Gremio (price_resale) | ❌ ocultado |
| Precio Público (price_public) | ✅ |
| Nombre de la agencia vendedora | ❌ ocultado (reemplazado por "Agencia verificada") |
| Logo de agencia | ❌ ocultado |
| Datos de contacto agencia | ❌ ocultados |
| Secciones admin (Mi Stock, Favoritas, etc.) | ❌ navegación restringida |

## Requirements

### Requirement: Toggle de modo

Los usuarios company SHALL poder cambiar de modo desde la cabecera.

#### Scenario: Activar Con Cliente

- **WHEN** el usuario pulsa el toggle "Con Cliente"
- **THEN** la UI entra en modo Con Cliente inmediatamente (sin PIN requerido para activar)
- **AND** todos los precios gremio y nombres de agencia dejan de renderizarse

#### Scenario: Desactivar Con Cliente (requiere PIN)

- **WHEN** el usuario intenta volver a "Sin Cliente"
- **THEN** se muestra un modal de PIN de 4 dígitos
- **AND** solo si el PIN es correcto se desactiva el modo Con Cliente

#### Scenario: PIN incorrecto

- **WHEN** el usuario ingresa un PIN incorrecto
- **THEN** se muestra error "PIN incorrecto" y permanece en modo Con Cliente

### Requirement: Auto-lock por pantalla apagada

La app SHALL volver automáticamente a modo Con Cliente si se apagó la pantalla.

#### Scenario: Pantalla apagada con Con Cliente activo

- **WHEN** la pantalla se apaga (evento `visibilitychange` o `blur`) mientras está en Con Cliente
- **THEN** no hay cambio — sigue en Con Cliente al volver

#### Scenario: Pantalla apagada en Sin Cliente

- **WHEN** la pantalla se apaga mientras está en modo Sin Cliente
- **AND** el modo Con Cliente estuvo activo en los últimos 30 minutos
- **THEN** al recuperar el foco, la app vuelve automáticamente a modo Con Cliente

### Requirement: Configuración de PIN

Los company_admin SHALL poder configurar el PIN.

#### Scenario: Primer uso (sin PIN configurado)

- **WHEN** el usuario intenta desactivar Con Cliente por primera vez
- **THEN** se le pide crear un PIN de 4 dígitos (con confirmación)
- **AND** el PIN se guarda encriptado en el perfil de usuario (backend)

#### Scenario: Cambiar PIN

- **WHEN** company_admin accede a Configuración → PIN de Audiencia
- **THEN** puede cambiar el PIN (requiere el PIN actual)

### Requirement: Persistencia del estado

El modo SHALL persistir entre navegaciones dentro de la misma sesión.

#### Scenario: Navegar entre pantallas

- **WHEN** el usuario está en Con Cliente y navega de Mercado a La Lonja
- **THEN** permanece en Con Cliente

#### Scenario: Recargar página

- **WHEN** el usuario recarga la app
- **THEN** el modo vuelve a Sin Cliente (estado por defecto, requiere activación explícita)

## Implementación sugerida

### Frontend
- `src/context/AudienceContext.tsx` — contexto global con `mode: 'dealer' | 'client'`, `setMode()`, `requirePin()`
- `src/components/ui/AudienceToggle.tsx` — toggle en header
- `src/components/ui/PinModal.tsx` — modal de 4 dígitos
- Hook `useAudienceMode()` en cualquier componente para condicionar rendering
- `document.addEventListener('visibilitychange', ...)` para auto-lock

### Backend
- Endpoint `PUT /api/v1/users/me/audience-pin` — guardar PIN hasheado (bcrypt)
- Endpoint `POST /api/v1/users/me/audience-pin/verify` — verificar PIN, retorna token temporal o bool

### Campos a ocultar en vistas
- `price_resale` → no renderizar en cards ni detail cuando `mode === 'client'`
- `company.name` → sustituir por "Agencia verificada"
- `company.logo_url` → no mostrar
- Tabs de navegación: en Con Cliente solo mostrar Mercado (y opcionalmente La Lonja sin datos de agencia)

## Implementación (2026-06-30)

### Estado: Toggle + PIN client-side implementados

**Frontend:**
- `frontend/src/context/AudienceContext.tsx` — `mode: 'dealer' | 'client'`, PIN en sessionStorage bajo clave `audience_pin`; `enterClientMode()` instantáneo, `exitClientMode(pin)` verifica PIN
- `frontend/src/components/PinModal.tsx` — 4 inputs separados tipo password con inputMode=numeric, auto-avance al escribir dígito, auto-submit en 4° dígito, shake + clear en PIN incorrecto, tecla Escape cancela
- `frontend/src/components/Layout/Header.tsx` — pill "Sin Cliente" / "Con Cliente" (ámbar activo), menú "Configurar PIN cliente" / "Cambiar PIN cliente", dos instancias de PinModal (exit y set)
- `frontend/src/components/vehicles/VehicleCard.tsx` — oculta `price_resale`, muestra `price_public` en verde
- `frontend/src/pages/vehicles/VehicleDetail.tsx` — oculta sección precio gremio, muestra precio público como número verde grande
- `frontend/src/index.css` — `@keyframes shake` + `.animate-shake` para el PinModal

**Migración 0006:** columna `audience_pin_hash VARCHAR(60) nullable` añadida a `users`

**No implementado aún:**
- Endpoints backend de PIN (`PUT /users/me/audience-pin`, `POST /users/me/audience-pin/verify`) — el PIN se valida solo client-side
- Auto-lock por evento `visibilitychange`
- Ocultar nombre y logo de agencias ajenas en modo client (solo se oculta price_resale actualmente)
