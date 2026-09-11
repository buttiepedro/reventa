---
title: Agente WhatsApp
status: active
created: 2026-09-10
implemented: 2026-09-10
---

# Agente WhatsApp

## Purpose

Permitir que un usuario de Reventa consulte y opere sobre los datos de su agencia
conversando por WhatsApp, sin abrir la app. El agente resuelve la identidad a partir del
número desde el que se escribe, responde consultas sobre la red, el stock propio, La Lonja,
liquidaciones y el tasador, y carga vehículos a partir de fotos más una descripción en
lenguaje natural.

Se implementa como un servicio independiente (`agent/`) que consume la API pública
`/api/v1` con un JWT de corta vida emitido para el usuario vinculado. No accede a las
tablas de Reventa.

## Contexto

- Canal: WhatsApp Cloud API (Meta), **un único número de plataforma** para todos los tenants
- Modelo: Claude con tool use y visión, configurable vía `AGENT_MODEL` (default `claude-opus-5`)
- Cola: Redis + arq — el webhook nunca procesa en el request de Meta
- Tenant: sale del JWT del usuario vinculado; el agente nunca elige `company_id`
- Persistencia propia: schema `agent` en el mismo Postgres, sin FK a tablas de Reventa

## Conceptos clave

- **Vinculación**: relación verificada entre un `phone_e164` y un `user_id`. Un número
  pertenece a un solo usuario.
- **Token de servicio**: JWT de 5 minutos emitido por el backend para un `user_id`, a
  pedido del agente, con claim `svc: "agent"`.
- **Acción pendiente**: escritura propuesta por el agente que espera confirmación explícita
  del usuario. Caduca a los 15 minutos.
- **Ventana de 24h**: período tras el último mensaje del usuario durante el cual Meta
  permite responder con texto libre. Fuera de ella solo hay templates preaprobados.

## Requirements

### Requirement: Vinculación verificada del número

Un usuario SHALL vincular su número de WhatsApp a su cuenta probando control de ambos.

#### Scenario: Alta de la vinculación

- **GIVEN** el usuario está autenticado en la app
- **WHEN** solicita conectar WhatsApp desde Mi Agencia
- **THEN** recibe un código de 6 dígitos válido por 10 minutos

#### Scenario: Confirmación desde el teléfono

- **WHEN** el usuario envía ese código al número de la plataforma por WhatsApp
- **THEN** la vinculación queda `verified_at` y el agente responde nombrando su agencia

#### Scenario: Código vencido o incorrecto

- **WHEN** el código no coincide o pasaron más de 10 minutos
- **THEN** el agente rechaza la vinculación y no revela si el número existe en el sistema

#### Scenario: Demasiados intentos

- **WHEN** se acumulan 5 intentos fallidos para un mismo número
- **THEN** el código se invalida y hay que generar uno nuevo desde la app

#### Scenario: Un número, un usuario

- **WHEN** se intenta vincular un `phone_e164` ya vinculado y activo
- **THEN** la operación se rechaza; el número debe desvincularse primero

#### Scenario: Desvinculación

- **WHEN** el usuario desvincula el número desde la app
- **THEN** el siguiente mensaje desde ese número se trata como número desconocido

### Requirement: Aislamiento de números no vinculados

El agente SHALL NOT revelar dato alguno a un número sin vinculación verificada.

#### Scenario: Número desconocido

- **WHEN** escribe un número sin vinculación verificada
- **THEN** recibe una bienvenida genérica que explica cómo vincularse
- **AND** no recibe información de ninguna agencia, vehículo ni usuario

### Requirement: Recepción confiable de mensajes

El webhook SHALL aceptar solo tráfico legítimo de Meta y no perder ni duplicar mensajes.

#### Scenario: Firma válida

- **WHEN** llega un webhook con `X-Hub-Signature-256` válida para el app secret
- **THEN** el mensaje se encola y se responde 200 en menos de 1 segundo

#### Scenario: Firma inválida

- **WHEN** la firma no valida
- **THEN** se responde 403 y el mensaje no se encola

#### Scenario: Reintento de Meta

- **WHEN** llega un `message.id` ya registrado en `inbound_messages`
- **THEN** se responde 200 sin volver a procesarlo

#### Scenario: Verificación del webhook

- **WHEN** Meta hace el handshake `GET` con `hub.verify_token`
- **THEN** el servicio devuelve el `hub.challenge` si el token coincide

### Requirement: Operación acotada al tenant del usuario

El agente SHALL operar exclusivamente con los permisos del usuario vinculado.

#### Scenario: Token de servicio

- **WHEN** el worker necesita llamar a la API por un usuario
- **THEN** obtiene un JWT vía `POST /api/v1/auth/service-token` con `X-Service-Key`
- **AND** ese token vence a los 5 minutos y corresponde a un único usuario

#### Scenario: Sin fuga entre agencias

- **WHEN** el usuario pide stock, liquidaciones o solicitudes
- **THEN** el agente solo obtiene lo que la API devuelve para el `company_id` de su JWT

#### Scenario: Clave de servicio ausente o inválida

- **WHEN** se llama a `/auth/service-token` sin `X-Service-Key` válida
- **THEN** la respuesta es 401 y no se emite token

### Requirement: Consultas sobre el producto

El agente SHALL responder consultas de lectura sobre la red, el stock propio, La Lonja,
liquidaciones, tasación y la red de agencias.

#### Scenario: Búsqueda en la red

- **WHEN** el usuario pregunta "¿tenés Corollas 2019 hasta 25 palos?"
- **THEN** el agente consulta `GET /vehicles` con marca, modelo, año y presupuesto
- **AND** responde con los resultados visibles para su agencia y sus precios

#### Scenario: Interpretación de montos coloquiales

- **WHEN** el usuario expresa un precio como "25 palos" o "25 millones"
- **THEN** el agente lo interpreta como 25.000.000 antes de llamar a la API

#### Scenario: Sin resultados

- **WHEN** la consulta no arroja resultados
- **THEN** el agente lo dice explícitamente y ofrece publicar una solicitud en La Lonja

### Requirement: Carga de vehículos desde fotos

El agente SHALL crear vehículos a partir de imágenes y una descripción en lenguaje natural.

#### Scenario: Fotos más descripción

- **GIVEN** un usuario vinculado
- **WHEN** envía fotos junto con "Corolla XEI 2019, 80 mil km, 25 palos"
- **THEN** el agente descarga los medios de Meta, los interpreta junto al texto
- **AND** normaliza marca, modelo y versión contra `GET /catalog/*`
- **AND** devuelve un borrador con los datos extraídos sin crear nada

#### Scenario: Confirmación y alta

- **WHEN** el usuario confirma el borrador
- **THEN** se crea el vehículo con `status=pre_toma` vía `POST /vehicles`
- **AND** se suben las imágenes, quedando la primera como `is_primary`
- **AND** el agente responde con el link al vehículo creado

#### Scenario: Datos faltantes

- **WHEN** faltan campos obligatorios del vehículo
- **THEN** el agente los pide antes de ofrecer el borrador

### Requirement: Confirmación explícita de toda escritura

El agente SHALL NOT crear ni modificar nada sin confirmación explícita del usuario.

#### Scenario: Propuesta antes de ejecutar

- **WHEN** el agente resuelve que corresponde una escritura
- **THEN** guarda la acción en `pending_action` y muestra un resumen legible
- **AND** no llama a la API hasta recibir confirmación

#### Scenario: Borrador vencido

- **WHEN** la confirmación llega más de 15 minutos después de la propuesta
- **THEN** el agente vuelve a mostrar el resumen y pide confirmar de nuevo

#### Scenario: Rechazo

- **WHEN** el usuario rechaza o cambia de tema
- **THEN** la acción pendiente se descarta sin ejecutarse

#### Scenario: Operaciones fuera de alcance

- **WHEN** el usuario pide crear empresas o usuarios, verificar CUIT, editar el catálogo
  maestro o borrar cualquier entidad
- **THEN** el agente lo deriva a la app y no ejecuta la operación

### Requirement: Trazabilidad de las acciones

Toda escritura ejecutada por el agente SHALL quedar auditada.

#### Scenario: Registro de la acción

- **WHEN** el agente ejecuta una tool de escritura
- **THEN** `agent_actions` guarda usuario, tool, argumentos, respuesta de la API y timestamp

### Requirement: Notificaciones proactivas acotadas

El agente SHALL poder avisar de eventos de Reventa, solo con los tres permisos dados.

#### Scenario: Apagado por defecto

- **WHEN** un template no está en la lista de habilitados
- **THEN** no se envía nada y el evento se descarta sin error

#### Scenario: Usuario que no quiere avisos

- **WHEN** el usuario desactivó las notificaciones desde la app
- **THEN** no recibe mensajes proactivos, aunque el template esté habilitado

#### Scenario: Dentro de la ventana de 24h

- **WHEN** el usuario escribió hace menos de 24 horas
- **THEN** el aviso se manda como texto libre, sin costo de conversación

#### Scenario: Fuera de la ventana de 24h

- **WHEN** pasaron más de 24 horas desde el último mensaje del usuario
- **THEN** el aviso se manda como template preaprobado, nunca como texto libre

#### Scenario: Trazabilidad del gasto

- **WHEN** se envía o falla un aviso
- **THEN** queda registrado en `outbound_notifications` con canal, estado y motivo

### Requirement: Límites del canal

El agente SHALL respetar las restricciones de la Cloud API de Meta.

#### Scenario: Contenido no soportado

- **WHEN** el usuario envía un audio, video o documento
- **THEN** el agente explica que por ahora solo procesa texto e imágenes

#### Scenario: Límite de consumo

- **WHEN** un usuario supera el límite diario de mensajes configurado
- **THEN** el agente lo informa y deja de procesar hasta el día siguiente
