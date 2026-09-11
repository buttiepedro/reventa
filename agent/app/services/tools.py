"""Tools exposed to the model.

Each one is a thin wrapper over an endpoint that already exists: no business logic
lives here, and no call chooses a tenant — the JWT does that.

Write tools never write. They stage a proposal; `confirmar_accion_pendiente` is the
single place where a change actually reaches Reventa.
"""

import json
import logging
import uuid
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation
from app.services import actions
from app.services.reventa import ReventaClient, ReventaError


@dataclass
class ToolContext:
    """Everything a tool may touch. Nothing here is chosen by the model."""

    client: ReventaClient
    session: AsyncSession
    conversation: Conversation
    user_id: uuid.UUID

logger = logging.getLogger(__name__)

TOOLS: list[dict] = [
    {
        "name": "buscar_en_la_red",
        "description": (
            "Busca vehículos publicados por las agencias de la red del usuario. "
            "Usala para '¿tenés/hay un X?', '¿quién tiene un Corolla?', búsquedas por "
            "presupuesto, por patente o por cercanía. Los precios que devuelve son los "
            "de reventa entre agencias."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "brand": {"type": "string", "description": "Marca, ej. Toyota"},
                "model": {"type": "string", "description": "Modelo, ej. Corolla"},
                "year_min": {"type": "integer"},
                "year_max": {"type": "integer"},
                "budget": {
                    "type": "integer",
                    "description": "Presupuesto en pesos, ya convertido a número entero",
                },
                "plate": {"type": "string", "description": "Patente exacta"},
                "fuel_type": {"type": "string", "enum": ["gasoline", "diesel", "electric", "hybrid", "gnc"]},
                "transmission": {"type": "string", "enum": ["manual", "automatic"]},
                "liquidaciones": {
                    "type": "boolean",
                    "description": "true para ver solo unidades en liquidación",
                },
                "page_size": {"type": "integer", "description": "Máximo 20 por defecto"},
            },
        },
    },
    {
        "name": "mi_stock",
        "description": "Lista los vehículos cargados por la agencia del usuario.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "detalle_vehiculo",
        "description": "Trae el detalle completo de un vehículo por su id, incluido el link para compartir.",
        "input_schema": {
            "type": "object",
            "properties": {"vehicle_id": {"type": "string"}},
            "required": ["vehicle_id"],
        },
    },
    {
        "name": "pre_tomas_de_la_red",
        "description": "Pre-tomas activas publicadas por la red: autos que otras agencias están por tomar.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "mi_red_de_agencias",
        "description": "Agencias conectadas (favoritos confirmados) con las que el usuario comparte stock.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "solicitudes_lonja",
        "description": (
            "Solicitudes abiertas en La Lonja: autos que otras agencias están buscando "
            "para un cliente. Con mias=true devuelve las publicadas por el usuario."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "mias": {"type": "boolean"},
                "match_my_stock": {
                    "type": "boolean",
                    "description": "Solo solicitudes que matchean con el stock propio",
                },
            },
        },
    },
    {
        "name": "ofertas_de_solicitud",
        "description": "Ofertas recibidas en una solicitud de La Lonja.",
        "input_schema": {
            "type": "object",
            "properties": {"request_id": {"type": "string"}},
            "required": ["request_id"],
        },
    },
    {
        "name": "tasar",
        "description": (
            "Estima el valor de mercado de un vehículo según lo publicado en la red. "
            "Usala cuando pregunten cuánto vale o en cuánto tomar un auto."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "brand": {"type": "string"},
                "model": {"type": "string"},
                "year": {"type": "integer"},
                "km": {"type": "integer"},
            },
            "required": ["brand", "model", "year", "km"],
        },
    },
    {
        "name": "resumen_del_dia",
        "description": "Métricas de la agencia y bandeja de novedades: matches, ofertas, interesados.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "catalogo_marcas",
        "description": "Marcas del catálogo maestro. Usala para normalizar lo que escribió el usuario.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "proponer_carga_vehiculo",
        "description": (
            "Prepara la carga de un vehículo para que el usuario la confirme. NO carga nada: "
            "deja la propuesta lista y después vos le mostrás el resumen y le preguntás si "
            "confirma. Las fotos que mandó el usuario en este mensaje se adjuntan solas, no "
            "las pases vos. Si te falta un dato obligatorio, preguntáselo en vez de inventarlo."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "brand": {"type": "string", "description": "Marca normalizada, ej. Toyota"},
                "model": {"type": "string", "description": "Modelo, ej. Corolla"},
                "year": {"type": "integer"},
                "version": {"type": "string", "description": "Versión o trim, ej. XEI"},
                "color": {"type": "string"},
                "mileage": {"type": "integer", "description": "Kilómetros"},
                "fuel_type": {"type": "string", "enum": ["gasoline", "diesel", "electric", "hybrid", "gnc"]},
                "transmission": {"type": "string", "enum": ["manual", "automatic"]},
                "price_resale": {"type": "integer", "description": "Precio de reventa entre agencias, en pesos"},
                "price_public": {
                    "type": "integer",
                    "description": "Precio al público. Si el usuario no lo dijo, preguntáselo antes de proponer.",
                },
                "plate": {"type": "string"},
                "description": {"type": "string"},
                "resumen": {
                    "type": "string",
                    "description": "Resumen en una línea de lo que se va a cargar, para mostrarle al usuario",
                },
            },
            "required": [
                "brand", "model", "year", "color", "mileage",
                "fuel_type", "transmission", "price_resale", "resumen",
            ],
        },
    },
    {
        "name": "proponer_cambio_estado",
        "description": (
            "Prepara un cambio de estado de un vehículo propio (disponible, reservado, vendido). "
            "No lo aplica: queda pendiente de confirmación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vehicle_id": {"type": "string"},
                "status": {"type": "string", "enum": ["available", "reserved", "sold", "pre_toma"]},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["vehicle_id", "status", "resumen"],
        },
    },
    {
        "name": "proponer_cambio_precio",
        "description": (
            "Prepara un cambio de precio de un vehículo propio. No lo aplica: queda pendiente "
            "de confirmación. Aclarale al usuario cuál precio estás por tocar."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vehicle_id": {"type": "string"},
                "price_resale": {"type": "integer", "description": "Precio de reventa, en pesos"},
                "price_public": {"type": "integer", "description": "Precio al público, en pesos"},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["vehicle_id", "resumen"],
        },
    },
    {
        "name": "proponer_liquidacion",
        "description": (
            "Prepara la publicación de un vehículo propio en liquidación. El precio de "
            "liquidación tiene que ser al menos 15% menor al de reventa, y el auto tiene que "
            "estar disponible. No la aplica: queda pendiente de confirmación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vehicle_id": {"type": "string"},
                "liquidacion_price": {"type": "integer", "description": "Precio de liquidación, en pesos"},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["vehicle_id", "liquidacion_price", "resumen"],
        },
    },
    {
        "name": "proponer_solicitud_lonja",
        "description": (
            "Prepara la publicación de una solicitud en La Lonja: un auto que el usuario busca "
            "para un cliente. No la publica: queda pendiente de confirmación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "budget_max": {"type": "integer", "description": "Presupuesto máximo, en pesos"},
                "budget_min": {"type": "integer"},
                "payment_method": {"type": "string", "enum": ["any", "cash", "trade_in", "financed"]},
                "category": {"type": "string"},
                "reference_models": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Modelos de referencia, ej. [\"Corolla\", \"Cruze\"]",
                },
                "notes": {"type": "string"},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["budget_max", "resumen"],
        },
    },
    {
        "name": "proponer_oferta",
        "description": (
            "Prepara una oferta de un auto propio sobre una solicitud de La Lonja. No la envía: "
            "queda pendiente de confirmación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "request_id": {"type": "string"},
                "vehicle_id": {"type": "string", "description": "Auto propio que se ofrece"},
                "message": {"type": "string"},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["request_id", "vehicle_id", "resumen"],
        },
    },
    {
        "name": "proponer_respuesta_oferta",
        "description": (
            "Prepara aceptar o rechazar una oferta recibida en una solicitud propia. No la "
            "aplica: queda pendiente de confirmación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "offer_id": {"type": "string"},
                "new_status": {"type": "string", "enum": ["accepted", "rejected"]},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["offer_id", "new_status", "resumen"],
        },
    },
    {
        "name": "proponer_interes_pretoma",
        "description": (
            "Prepara marcar interés en una pre-toma de otra agencia, lo que le avisa al dueño. "
            "No lo marca: queda pendiente de confirmación."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "vehicle_id": {"type": "string"},
                "resumen": {'type': 'string', 'description': 'Resumen en una línea de lo que se va a hacer, para mostrarle al usuario'},
            },
            "required": ["vehicle_id", "resumen"],
        },
    },
    {
        "name": "confirmar_accion_pendiente",
        "description": (
            "Ejecuta la acción que quedó pendiente, y solo cuando el usuario la confirmó de "
            "forma explícita en su último mensaje ('sí', 'dale', 'confirmo'). Si dudás de si "
            "confirmó, volvé a preguntar en vez de llamar a esta tool."
        ),
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "descartar_accion_pendiente",
        "description": "Descarta la acción pendiente porque el usuario la rechazó o cambió de tema.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "catalogo_modelos",
        "description": "Modelos de una marca del catálogo, por make_id.",
        "input_schema": {
            "type": "object",
            "properties": {"make_id": {"type": "string"}},
            "required": ["make_id"],
        },
    },
]


async def execute(name: str, args: dict, ctx: ToolContext) -> tuple[str, bool]:
    """Run one tool. Returns (content, is_error) for the tool_result block."""
    try:
        if name in _STATEFUL:
            return await _STATEFUL[name](args, ctx), False
        status_code, body = await _dispatch(name, args, ctx.client)
    except ReventaError as exc:
        return f"Error {exc.status_code}: {exc.detail}", True
    except Exception as exc:  # noqa: BLE001 — the model gets to see and recover
        logger.exception("Tool %s failed", name)
        return f"Error inesperado ejecutando {name}: {exc}", True

    if status_code >= 400:
        detail = body.get("detail") if isinstance(body, dict) else body
        return f"Error {status_code}: {detail}", True
    return json.dumps(body, ensure_ascii=False, default=str), False


async def _dispatch(name: str, args: dict, client: ReventaClient) -> tuple[int, object]:
    match name:
        case "buscar_en_la_red":
            return await client.get("/vehicles", args)
        case "mi_stock":
            return await client.get("/vehicles/my")
        case "detalle_vehiculo":
            return await client.get(f"/vehicles/{args['vehicle_id']}")
        case "pre_tomas_de_la_red":
            return await client.get("/vehicles/pre-toma")
        case "mi_red_de_agencias":
            return await client.get("/favorites")
        case "solicitudes_lonja":
            if args.get("mias"):
                return await client.get("/lonja/my-requests")
            return await client.get(
                "/lonja/requests", {"match_my_stock": args.get("match_my_stock")}
            )
        case "ofertas_de_solicitud":
            return await client.get(f"/lonja/requests/{args['request_id']}/offers")
        case "tasar":
            return await client.get("/tasador/valuate", args)
        case "resumen_del_dia":
            stats_code, stats = await client.get("/home/stats")
            inbox_code, inbox = await client.get("/home/inbox")
            if stats_code >= 400:
                return stats_code, stats
            return 200, {"stats": stats, "inbox": inbox if inbox_code < 400 else []}
        case "catalogo_marcas":
            return await client.get("/catalog/makes")
        case "catalogo_modelos":
            return await client.get("/catalog/models", {"make_id": args["make_id"]})
    return 400, {"detail": f"Tool desconocida: {name}"}


# ─── Tools that touch conversation state instead of the API ──


async def _proponer_carga_vehiculo(args: dict, ctx: ToolContext) -> str:
    payload = {k: v for k, v in args.items() if k != "resumen" and v is not None}
    media_ids = [entry["id"] for entry in (ctx.conversation.media_buffer or []) if entry.get("id")]
    actions.propose(
        ctx.conversation,
        "crear_vehiculo",
        payload,
        args["resumen"],
        media_ids=media_ids,
    )
    fotos = f"{len(media_ids)} foto(s) adjuntas" if media_ids else "sin fotos"
    return (
        f"Propuesta guardada ({fotos}). Todavía NO se cargó nada. Mostrale el resumen al "
        "usuario con los datos y las fotos, y preguntale si confirma."
    )


async def _confirmar_accion_pendiente(args: dict, ctx: ToolContext) -> str:
    result = await actions.confirm(ctx.session, ctx.conversation, ctx.client, ctx.user_id)
    # The photos belonged to the draft that just ran; a new load starts clean.
    ctx.conversation.media_buffer = []
    ctx.conversation.media_buffer_at = None
    return result


async def _descartar_accion_pendiente(args: dict, ctx: ToolContext) -> str:
    actions.discard(ctx.conversation)
    ctx.conversation.media_buffer = []
    ctx.conversation.media_buffer_at = None
    return "Propuesta descartada. No se cargó ni se modificó nada."


def _proposer(action_type: str, fields: tuple[str, ...]):
    """Build a staging handler: validate-by-schema, store, ask for confirmation."""

    async def handler(args: dict, ctx: ToolContext) -> str:
        payload = {k: args[k] for k in fields if args.get(k) is not None}
        actions.propose(ctx.conversation, action_type, payload, args["resumen"])
        return (
            "Propuesta guardada. Todavía NO se aplicó nada. Mostrale el resumen al usuario "
            "y preguntale si confirma."
        )

    return handler


_STATEFUL = {
    "proponer_carga_vehiculo": _proponer_carga_vehiculo,
    "proponer_cambio_estado": _proposer("cambiar_estado", ("vehicle_id", "status")),
    "proponer_cambio_precio": _proposer("cambiar_precio", ("vehicle_id", "price_resale", "price_public")),
    "proponer_liquidacion": _proposer("liquidar", ("vehicle_id", "liquidacion_price")),
    "proponer_solicitud_lonja": _proposer(
        "crear_solicitud",
        ("budget_max", "budget_min", "payment_method", "category", "reference_models", "notes"),
    ),
    "proponer_oferta": _proposer("ofertar", ("request_id", "vehicle_id", "message")),
    "proponer_respuesta_oferta": _proposer("responder_oferta", ("offer_id", "new_status")),
    "proponer_interes_pretoma": _proposer("marcar_interes", ("vehicle_id",)),
    "confirmar_accion_pendiente": _confirmar_accion_pendiente,
    "descartar_accion_pendiente": _descartar_accion_pendiente,
}
