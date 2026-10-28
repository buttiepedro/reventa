"""Cruza los vehículos contra el Radar de cada agencia y despacha los avisos.

El Radar existía desde la primera versión de Mi Agencia guardando marca, modelo,
año, km y precio, y ninguna consulta lo miraba. Acá se usa.

Hay dos motivos distintos por los que a una agencia le puede llegar un aviso —
porque estaba buscando ese auto, o porque trabaja con quien lo publica — y se
mandan con textos distintos a propósito: si llegan iguales, nadie entiende por
qué le llegó y a la semana los silencia.
"""

import asyncio
import logging
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.company import Company
from app.models.company_favorite import CompanyFavorite
from app.models.notification import Notification
from app.models.radar_entry import RadarEntry
from app.models.vehicle import Vehicle

logger = logging.getLogger(__name__)

# Qué ocurrió con el vehículo. Define el texto, no a quién le llega.
EVENT_PRE_TOMA = "pre_toma"
EVENT_PUBLICADO = "publicado"
EVENT_LIQUIDACION = "liquidacion"

_EVENT_WORDS = {
    EVENT_PRE_TOMA: "entró como pre-toma",
    EVENT_PUBLICADO: "se publicó en la red",
    EVENT_LIQUIDACION: "entró en liquidación",
}


def _texts(event: str, label: str, agency: str, price: Decimal | None) -> tuple[str, str]:
    """(título, cuerpo) del aviso por coincidencia de Radar."""
    importe = f" a ${int(price):,}".replace(",", ".") if price is not None else ""
    return (
        f"Coincide con tu Radar: {label}",
        f"{agency} {_EVENT_WORDS[event]}{importe}. Lo tenías en el Radar.",
    )


def _texts_connected(event: str, label: str, agency: str) -> tuple[str, str]:
    return (
        f"{agency}: {label}",
        f"Una agencia conectada {_EVENT_WORDS[event]} este vehículo.",
    )


def _matches(entry: RadarEntry, vehicle: Vehicle, price: Decimal) -> bool:
    """Una entrada de Radar matchea si todo lo que especifica se cumple.

    Los campos vacíos no filtran. `brand` siempre viene cargado — el alta lo exige —
    así que nunca hay una entrada que matchee con todo.
    """
    if entry.brand and entry.brand.strip().lower() not in vehicle.brand.strip().lower():
        return False
    if entry.model:
        # "Corolla" tiene que encontrar un "Corolla XEI": el modelo es texto libre
        # y la gente escribe la versión pegada al modelo.
        wanted, got = entry.model.strip().lower(), (vehicle.model or "").strip().lower()
        if wanted not in got and got not in wanted:
            return False
    if entry.min_year is not None and vehicle.year < entry.min_year:
        return False
    if entry.max_km is not None and vehicle.mileage > entry.max_km:
        return False
    if entry.max_price is not None and price > entry.max_price:
        return False
    return True


async def matching_companies(
    session: AsyncSession, vehicle: Vehicle, price: Decimal
) -> set[uuid.UUID]:
    """Agencias activas, distintas de la dueña, con una entrada de Radar que matchea."""
    entries = (
        await session.scalars(
            select(RadarEntry)
            .join(Company, Company.id == RadarEntry.company_id)
            .where(RadarEntry.company_id != vehicle.company_id, Company.is_active.is_(True))
        )
    ).all()
    return {e.company_id for e in entries if _matches(e, vehicle, price)}


async def connected_companies(session: AsyncSession, company_id: uuid.UUID) -> set[uuid.UUID]:
    """Conexiones aceptadas, en cualquiera de las dos direcciones."""
    records = (
        await session.scalars(
            select(CompanyFavorite).where(
                CompanyFavorite.status == "accepted",
                (CompanyFavorite.company_id == company_id)
                | (CompanyFavorite.favorite_company_id == company_id),
            )
        )
    ).all()
    return {
        r.favorite_company_id if r.company_id == company_id else r.company_id for r in records
    }


async def notify_opportunity(
    session: AsyncSession,
    vehicle: Vehicle,
    event: str,
    price: Decimal | None = None,
    broadcast_rest: bool = False,
) -> dict[str, int]:
    """Avisa a quien le interesa el auto y a quien trabaja con la agencia.

    Una agencia que cumple las dos condiciones recibe sólo el aviso de Radar, que
    es el que explica mejor por qué le llegó.
    """
    effective_price = price if price is not None else vehicle.price_resale
    agency = (await session.scalar(select(Company.name).where(Company.id == vehicle.company_id))) or "Una agencia"
    label = f"{vehicle.brand} {vehicle.model} {vehicle.year}"

    by_radar = await matching_companies(session, vehicle, effective_price)
    by_connection = await connected_companies(session, vehicle.company_id) - by_radar

    radar_title, radar_body = _texts(event, label, agency, price)
    conn_title, conn_body = _texts_connected(event, label, agency)
    url = "/mercado" if event != EVENT_PRE_TOMA else "/"

    for company_id in by_radar:
        session.add(Notification(company_id=company_id, title=radar_title, body=radar_body,
                                 entity_type=f"radar_{event}", entity_id=vehicle.id))
    for company_id in by_connection:
        session.add(Notification(company_id=company_id, title=conn_title, body=conn_body,
                                 entity_type=f"conectada_{event}", entity_id=vehicle.id))

    _dispatch_push(list(by_radar), radar_title, radar_body, url)
    _dispatch_push(list(by_connection), conn_title, conn_body, url)

    # El aviso de pre-toma a toda la red existe desde antes del Radar. Se mantiene
    # para no perder alcance mientras los Radares están vacíos, pero descontando a
    # quien ya fue avisado: nadie recibe el mismo auto dos veces. A medida que se
    # carguen Radares, este resto se achica solo.
    rest: set[uuid.UUID] = set()
    if broadcast_rest:
        everyone = set(
            (
                await session.scalars(
                    select(Company.id).where(
                        Company.id != vehicle.company_id, Company.is_active.is_(True)
                    )
                )
            ).all()
        )
        rest = everyone - by_radar - by_connection
        _dispatch_push(list(rest), f"Nueva Pre-Toma: {label}", "Publicada ahora en la red", "/")

    _dispatch_whatsapp(by_radar, "radar_match", {"label": label, "agencia": agency})
    if rest:
        _dispatch_whatsapp(rest, "nueva_pretoma", {"label": label})

    return {"radar": len(by_radar), "conectadas": len(by_connection), "resto": len(rest)}


def _dispatch_whatsapp(company_ids: set[uuid.UUID], template: str, params: dict) -> None:
    if not company_ids:
        return

    async def _run() -> None:
        from app.services.whatsapp_notify import notify_whatsapp

        try:
            async with AsyncSessionLocal() as bg:
                await notify_whatsapp(bg, list(company_ids), template, params)
                await bg.commit()
        except Exception:  # noqa: BLE001
            logger.exception("No se pudo despachar el aviso por WhatsApp")

    asyncio.create_task(_run())


def _dispatch_push(company_ids: list[uuid.UUID], title: str, body: str, url: str) -> None:
    """Sale en segundo plano: un aviso que no se puede entregar no puede voltear
    la operación que lo disparó."""
    if not company_ids:
        return

    async def _run() -> None:
        from app.services.push import send_push

        try:
            async with AsyncSessionLocal() as bg:
                for company_id in company_ids:
                    await send_push(bg, company_id, title, body, url)
                await bg.commit()
        except Exception:  # noqa: BLE001
            logger.exception("No se pudieron enviar los avisos de oportunidad")

    asyncio.create_task(_run())
