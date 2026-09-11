---
title: Agente WhatsApp — servicio conversacional sobre la API de Reventa
type: feature
status: archived
spec: agente_whatsapp
created: 2026-09-10
archived_at: 2026-09-10
---

# Agente WhatsApp — Consultar y cargar stock desde WhatsApp

## Resumen

Tercer servicio del monorepo (`agent/`), independiente del backend, que expone un agente
conversacional por WhatsApp. Se conecta a una app de Meta (WhatsApp Cloud API) con un
número único de plataforma. Cada usuario vincula **su** número personal a su cuenta de
Reventa; cuando escribe desde ese número, el agente responde con los datos de su agencia
y opera en su nombre.

El agente **no toca la base de datos de Reventa**. Todo lo hace vía `POST/GET /api/v1`,
con un JWT de corta vida emitido para el usuario vinculado. El aislamiento multi-tenant
que ya existe en el backend sigue siendo el único borde de seguridad.

Capacidades: consultar la red, el stock propio, La Lonja, liquidaciones y el tasador; y
cargar vehículos mandando fotos + una descripción en lenguaje natural
("es un Corolla XEI 2019, 80 mil km, 25 palos").

---

## Motivación

El vendedor de agencia vive en WhatsApp. Hoy, para saber si en la red hay un Corolla 2019
tiene que abrir la app, loguearse y filtrar; y para cargar un auto que está viendo en el
playón tiene que completar un formulario. La PWA Express
(`openspec/specs/pre_toma_express/spec.md`) atacó la carga desde el campo, pero sigue
exigiendo instalar y abrir una app.

WhatsApp elimina ese paso: el canal ya está abierto, ya tiene las fotos en el teléfono y
ya sabe escribir en él.

---

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Ubicación | Servicio nuevo `agent/`, habla con Reventa **solo vía API** |
| Escrituras | **Confirmación explícita siempre** — nada se crea ni modifica sin un "sí" |
| Alcance | Producto completo: vehículos, Lonja, liquidaciones, tasador, red |
| Cola | **Redis + arq** — servicio nuevo en el compose |
| Modelo | Claude con tool use + visión, configurable vía `AGENT_MODEL` (default `claude-opus-5`) |
| Números | Un único número de plataforma (una WABA), no uno por agencia |

---

## Arquitectura

```
WhatsApp
   │
   ▼
Meta Cloud API ──► POST /webhook  (agent/, FastAPI)
                      │  1. valida X-Hub-Signature-256 (HMAC-SHA256, app secret)
                      │  2. dedupe por message.id
                      │  3. enqueue en Redis  →  200 OK  (< 1s, Meta corta a los 15s)
                      ▼
                   worker (arq)
                      │  resolve(phone) → user_id
                      │  POST /api/v1/auth/service-token → JWT 5 min del usuario
                      ▼
                   loop de Claude (tool use)  ◄──►  API Reventa /api/v1
                      │                              (Bearer JWT del usuario)
                      ▼
                   Meta /messages ──► respuesta al usuario
```

### Servicios en `docker-compose.yml`

| Servicio | Rol |
|---|---|
| `agent` | FastAPI: webhook de Meta + endpoints internos de vinculación |
| `agent-worker` | arq: consume la cola, corre el loop del agente |
| `redis` | cola + estado efímero de conversación |

`agent` y `agent-worker` comparten imagen y comparten la DB de Postgres del backend, pero
en un **schema propio (`agent`)**. No importan modelos de `app.models` ni consultan tablas
de Reventa: solo las suyas.

---

## Modelo de datos (schema `agent`)

### `whatsapp_links`
Vinculación número ↔ usuario. Un número pertenece a un solo usuario.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | UUID PK | |
| `phone_e164` | varchar(20) UNIQUE | `+5493416...` |
| `user_id` | UUID | referencia lógica a `users.id` (sin FK — otro schema) |
| `verified_at` | timestamptz nullable | null = pendiente |
| `code_hash` | varchar(60) nullable | bcrypt del código de 6 dígitos |
| `code_expires_at` | timestamptz nullable | 10 minutos |
| `attempts` | int | corta a los 5 intentos |
| `revoked_at` | timestamptz nullable | desvinculación |

### `conversations`
Una por número. Guarda el historial que se le pasa al modelo.

| Campo | Tipo | Nota |
|---|---|---|
| `id` / `phone_e164` / `user_id` | | |
| `messages` | jsonb | ventana de los últimos N turnos |
| `pending_action` | jsonb nullable | escritura esperando confirmación |
| `window_expires_at` | timestamptz | ventana de 24h de Meta |
| `last_message_at` | timestamptz | |

### `inbound_messages`
Idempotencia y auditoría. `meta_message_id` UNIQUE — Meta reintenta y no queremos
procesar dos veces la misma carga de un auto.

### `agent_actions`
Log de toda escritura ejecutada: qué tool, con qué argumentos, qué respondió la API, qué
usuario la confirmó y cuándo. Es la trazabilidad de "quién cargó este auto".

---

## Autenticación e identidad

### Vinculación del número (cambio en el frontend + backend)

1. El usuario entra a Mi Agencia → **Conectar WhatsApp**.
2. `POST /api/v1/whatsapp/link` (backend) → llama al servicio `agent` → devuelve un código
   de 6 dígitos válido 10 minutos.
3. El usuario le manda ese código al número de la plataforma por WhatsApp.
4. El agente valida y marca `verified_at`. Responde con el nombre de la agencia para que
   el usuario confirme visualmente que quedó bien vinculado.

El código va de la app hacia el teléfono, no al revés: eso prueba que quien escribe
controla **la cuenta y el número**. Un `phone_e164` desconocido recibe una respuesta
genérica de bienvenida y nunca datos de nadie.

### Token de servicio (cambio en el backend)

Endpoint nuevo `POST /api/v1/auth/service-token`, protegido por header
`X-Service-Key: {AGENT_SERVICE_KEY}` y restringido por red interna:

```
{ "user_id": "..." }  →  { "access_token": "...", "expires_in": 300 }
```

Emite un JWT normal para ese usuario, con TTL de 5 minutos y un claim `svc: "agent"` para
poder auditarlo y, si hace falta, negarle endpoints sensibles.

**El agente nunca elige `company_id`.** Sale del JWT, como para cualquier cliente.

---

## Catálogo de tools

Cada tool es un wrapper fino sobre un endpoint que ya existe. Sin lógica de negocio nueva
en `agent/`.

### Lectura

| Tool | Endpoint |
|---|---|
| `buscar_en_la_red` | `GET /vehicles` (brand, model, year, budget, plate, geo, liquidaciones) |
| `mi_stock` | `GET /vehicles/my` |
| `detalle_vehiculo` | `GET /vehicles/{id}` |
| `pre_tomas_de_la_red` | `GET /vehicles/pre-toma` |
| `mi_red_de_agencias` | `GET /favorites` |
| `solicitudes_lonja` | `GET /lonja/requests`, `GET /lonja/my-requests` |
| `ofertas_de_solicitud` | `GET /lonja/requests/{id}/offers` |
| `tasar` | `GET /tasador/valuate` |
| `resumen_del_dia` | `GET /home/stats`, `GET /home/inbox` |
| `catalogo` | `GET /catalog/makes|models|trims` — normaliza lo que dictó el usuario |

### Escritura (todas pasan por confirmación)

| Tool | Endpoint |
|---|---|
| `cargar_vehiculo` | `POST /vehicles` + `POST /vehicles/{id}/images/upload` |
| `cambiar_estado` | `PATCH /vehicles/{id}/status` |
| `actualizar_precio` | `PUT /vehicles/{id}` |
| `marcar_liquidacion` | `PATCH /vehicles/{id}/liquidar` |
| `publicar_solicitud` | `POST /lonja/requests` |
| `ofertar_stock` | `POST /lonja/requests/{id}/offers` |
| `responder_oferta` | `PATCH /lonja/offers/{id}` |
| `marcar_interes` | `POST /vehicles/{id}/interest` |

Fuera del alcance de las tools: crear empresas y usuarios, verificar CUIT, tocar el
catálogo maestro, borrar nada. Eso se hace en la app.

---

## Flujo: cargar un auto por fotos

```
Usuario: [3 fotos] "Corolla XEI 2019, 80 mil km, 25 palos"

1. Meta entrega media_id por foto → el worker las baja con el token de la app
2. Claude lee fotos + texto en un solo turno multimodal
3. Normaliza contra `catalogo` (Toyota / Corolla / XEI) y parsea "25 palos" → 25.000.000
4. Devuelve el borrador, NO crea nada:

   Agente: Te cargo esta pre-toma:
           Toyota Corolla XEI 2019 · 80.000 km · gris
           Reventa $25.000.000
           3 fotos
           Me falta el precio público. ¿Te pongo el mismo? ¿Confirmo?

5. Usuario: "sí, público 27"
6. POST /vehicles (status=pre_toma) → sube las 3 fotos → primera como primary
7. Agente: Listo. Ya está en la red → https://reventa.app/vehicles/{id}
```

El borrador vive en `conversations.pending_action` y **caduca a los 15 minutos**: si el
usuario vuelve una hora después y dice "dale", el agente vuelve a mostrar el resumen antes
de crear nada.

---

## Riesgos y límites conocidos

- **Ventana de 24h de Meta.** Fuera de una conversación activa solo se pueden mandar
  *templates* preaprobados. El agente elige el canal solo, pero los templates hay que
  registrarlos en Meta con el mismo nombre que están en `templates.py`.
- **El aviso de pre-toma le pega a toda la red.** Es el más caro por lejos: una
  publicación son N conversaciones facturadas. Conviene habilitar primero
  `oferta_aceptada` y `nueva_oferta`, que son de bajo volumen.
- **Un número compartido.** El usuario le escribe a "Reventa", no a su agencia. Un número
  por agencia implica multi-WABA, onboarding de Meta por cliente y otro modelo de costos.
- **Costo por mensaje.** Conversación de Meta + tokens de Claude (las fotos pesan). Hace
  falta un límite por usuario/día y un corte por gasto.
- **El modelo se equivoca leyendo fotos.** Por eso toda escritura se confirma y todo
  vehículo cargado por WhatsApp nace en `pre_toma` (reversible, con TTL propio).
- **Número reciclado.** Las operadoras reasignan números. `revoked_at` + revinculación
  manual desde la app; no hay renovación automática silenciosa.

---

## Migración requerida

| # | Tipo | Descripción |
|---|------|-------------|
| 1 | Infra | Servicios `agent`, `agent-worker`, `redis` en `docker-compose.yml` |
| 2 | Infra | App de Meta + WABA + número verificado + webhook HTTPS público |
| 3 | Alembic | Schema `agent`: `whatsapp_links`, `conversations`, `inbound_messages`, `agent_actions` |
| 4 | Backend | `POST /api/v1/auth/service-token` con `X-Service-Key` |
| 5 | Backend | `POST /api/v1/whatsapp/link` y `DELETE /api/v1/whatsapp/link` (proxy al agente) |
| 6 | Backend | Config: `AGENT_SERVICE_KEY`, `AGENT_BASE_URL` |
| 7 | Agent | Servicio nuevo `agent/`: webhook, worker, tools, loop de Claude |
| 8 | Agent | Config: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PHONE_NUMBER_ID`, `META_ACCESS_TOKEN`, `ANTHROPIC_API_KEY`, `REVENTA_API_URL`, `REDIS_URL` |
| 9 | Frontend | Sección "Conectar WhatsApp" en Mi Agencia (código + estado + desvincular) |

---

## Fases

1. **Fundación** ✅ *implementada* — servicio, webhook validado, cola, vinculación de
   número y las 11 tools de lectura (red, stock, Lonja, tasador, resumen, catálogo).
   Salida: "¿qué Corollas hay en la red?" contesta bien.
2. **Carga por fotos** ✅ *implementada* — descarga de medios de Meta, visión,
   normalización con catálogo, buffer de fotos con debounce, confirmación, `POST /vehicles`
   + imágenes.
3. **Producto completo** ✅ *implementada* — 8 escrituras (carga, estado, precio,
   liquidación, solicitud, oferta, respuesta a oferta, interés), todas tras confirmación
   y auditadas en `agent_actions`.
4. **Proactivo** ✅ *implementada, apagada* — avisos de pre-toma, nueva oferta y oferta
   aceptada, con opt-out por usuario y elección automática entre texto libre (dentro de la
   ventana de 24h) y template. Queda **desactivada** hasta que Meta apruebe los templates:
   se habilita de a uno con `ENABLED_NOTIFICATIONS`.

---

## Acceptance criteria

- [x] Un número no vinculado nunca recibe datos de ninguna agencia
- [x] El webhook responde 200 en < 1s y un `message.id` repetido no se procesa dos veces
- [x] Firma `X-Hub-Signature-256` inválida → 403, sin encolar
- [ ] "¿Tenés Corollas 2019 hasta 25 palos?" devuelve resultados de la red del usuario, con precios de su agencia
- [ ] 3 fotos + descripción crean un vehículo en `pre_toma` con las 3 imágenes, solo tras confirmación
- [x] Ninguna escritura se ejecuta sin confirmación explícita en el mensaje siguiente
- [x] Un borrador de más de 15 minutos se vuelve a resumir antes de ejecutarse
- [x] Toda escritura queda en `agent_actions` con usuario, tool, argumentos y respuesta
- [x] El JWT que usa el agente vence a los 5 minutos y es de un único usuario
- [x] Desvincular desde la app corta el acceso en el siguiente mensaje

---

---

## Estado al cierre

Las cuatro fases están implementadas. 84 tests automatizados cubren la vinculación, la
firma y deduplicación del webhook, la máquina de confirmación, el batch de fotos, las 8
escrituras, las notificaciones y la recuperación ante caídas del worker.

**Queda sin verificar** (los dos criterios sin tildar arriba): todo lo que depende de una
llamada real al modelo. El loop nunca corrió contra la API de Claude, así que los schemas
de las 21 tools, el `output_config` y el round-trip de bloques de contenido están sin
confirmar contra el servidor. Un primer mensaje real descarta las tres cosas.

**Pendiente fuera del código**: registrar los tres templates en Meta con el mismo nombre y
orden de parámetros que `agent/app/services/templates.py`. Hasta entonces
`ENABLED_NOTIFICATIONS` queda vacío y el agente solo responde.

**Deuda conocida**, relevada y no abordada: los resultados de las tools se serializan
enteros al modelo, las fotos van sin redimensionar, no hay prompt caching, la auditoría de
`agent_actions` no tiene pantalla, no hay retención de tablas y los tests no corren en CI.

---

## Out of scope (v1)

- Un número de WhatsApp por agencia (multi-WABA)
- Que el agente inicie conversaciones (requiere templates aprobados) — fase 4
- Atención al cliente final: el agente habla con usuarios de Reventa, no con compradores
- Audios y notas de voz — solo texto e imágenes
- Alta de empresas, usuarios, verificación de CUIT y catálogo maestro
- Borrado de cualquier entidad
