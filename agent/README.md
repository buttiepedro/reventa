# Agente WhatsApp

Servicio conversacional sobre WhatsApp para usuarios de Stockar. Consulta y opera
sobre los datos de la agencia del usuario **únicamente a través de la API pública**
`/api/v1`: no accede a las tablas de Stockar.

Spec: [`openspec/specs/agente_whatsapp/spec.md`](../openspec/specs/agente_whatsapp/spec.md)

## Piezas

| Componente | Rol |
|---|---|
| `app/api/webhook.py` | Webhook de Meta: valida firma, deduplica, encola |
| `app/worker.py` | Worker arq: identidad, fotos y turnos de conversación |
| `app/services/agent.py` | El loop del modelo con tool use y visión |
| `app/services/tools.py` | Catálogo de tools (lectura + propuestas de escritura) |
| `app/services/actions.py` | Propuestas pendientes y el único camino que ejecuta una escritura |
| `app/services/linking.py` | Vinculación verificada número ↔ usuario |

## Invariantes

- Un número sin vinculación verificada **nunca** recibe datos de nadie.
- El agente no elige tenant: pide un JWT de 5 minutos por usuario y la API hace el resto.
- Ninguna escritura se ejecuta sin confirmación explícita, y las propuestas vencen
  a los 15 minutos.

## Tests

Los tests que tocan base de datos necesitan un Postgres real (el schema usa JSONB y
un índice único parcial). Sin la variable, se saltean solos.

```bash
docker run --rm -d --name agent-test-db \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=test \
  -p 55432:5432 postgres:16-alpine

AGENT_TEST_DATABASE_URL="postgresql+asyncpg://test:test@localhost:55432/test" \
  python -m alembic upgrade head

AGENT_TEST_DATABASE_URL="postgresql+asyncpg://test:test@localhost:55432/test" \
  python -m pytest
```

## Migraciones

Alembic propio, con su tabla de versiones dentro del schema `agent`, separado del
historial del backend. Corren solas al arrancar el servicio.

## Notificaciones proactivas

Apagadas por defecto. `ENABLED_NOTIFICATIONS` es una lista blanca: un template que no
está ahí no se manda, y eso no es un error, es el estado normal hasta que Meta lo
apruebe.

Los nombres en [`app/services/templates.py`](app/services/templates.py) tienen que
coincidir con los templates registrados en Meta, y el orden de los parámetros también.

Dentro de la ventana de 24h el aviso va como texto libre (no se cobra); fuera de ella,
como template. El agente elige solo, y deja constancia del canal en
`outbound_notifications`.

**Cuidado con `nueva_pretoma`**: le llega a toda la red en cada publicación, así que es
el más caro por mucho. Conviene arrancar habilitando solo `oferta_aceptada`.

El usuario puede apagar los avisos desde Mi Agencia sin desvincular el número.
