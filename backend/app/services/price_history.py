"""Registro de precios observados, y precios sugeridos a partir de ellos.

El tasador miraba sólo el stock publicado en ese instante: si en el momento de
la consulta no había dos autos parecidos a la venta, no sugería nada, y lo que
se había vendido la semana pasada no contaba. Acá se acumulan los precios para
que eso deje de depender de la foto del día.
"""

import logging
from decimal import Decimal
from statistics import mean

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.price_point import VehiclePricePoint
from app.models.vehicle import Vehicle

logger = logging.getLogger(__name__)

PUBLICADO = "publicado"
VENDIDO = "vendido"
LIQUIDADO = "liquidado"


async def record(
    session: AsyncSession,
    vehicle: Vehicle,
    kind: str,
    price_resale: Decimal | None = None,
    price_public: Decimal | None = None,
) -> None:
    """Guarda un punto. Nunca interrumpe la operación que lo disparó."""
    try:
        session.add(
            VehiclePricePoint(
                vehicle_id=vehicle.id,
                company_id=vehicle.company_id,
                brand=vehicle.brand,
                model=vehicle.model,
                year=vehicle.year,
                version=vehicle.version,
                mileage=vehicle.mileage,
                kind=kind,
                price_resale=price_resale if price_resale is not None else vehicle.price_resale,
                price_public=price_public if price_public is not None else vehicle.price_public,
            )
        )
    except Exception:  # noqa: BLE001
        logger.exception("No se pudo registrar el precio de %s", vehicle.id)


def _trimmed_mean(values: list[float], trim_pct: float = 0.1) -> float:
    """Recorta los extremos: un precio mal tipeado no puede mover la sugerencia."""
    if not values:
        return 0.0
    ordered = sorted(values)
    cut = max(1, int(len(ordered) * trim_pct))
    trimmed = ordered[cut:-cut] if len(ordered) > 2 * cut else ordered
    return mean(trimmed)


async def history_for(
    session: AsyncSession, brand: str, model: str, year: int, year_span: int = 2
) -> list[VehiclePricePoint]:
    return list(
        (
            await session.scalars(
                select(VehiclePricePoint).where(
                    VehiclePricePoint.brand.ilike(f"%{brand}%"),
                    VehiclePricePoint.model.ilike(f"%{model}%"),
                    VehiclePricePoint.year >= year - year_span,
                    VehiclePricePoint.year <= year + year_span,
                )
            )
        ).all()
    )


def suggested(points: list[VehiclePricePoint], km: int) -> dict:
    """Precio sugerido de reventa y de público a partir del historial.

    Los liquidados quedan afuera del precio de referencia: son ventas forzadas y
    arrastran el promedio hacia abajo. Se devuelven aparte, que es la pregunta
    distinta de "cuánto pierdo si tengo que salir rápido".
    """
    de_mercado = [p for p in points if p.kind in (PUBLICADO, VENDIDO)]
    liquidados = [p for p in points if p.kind == LIQUIDADO]

    def ajustar(valores: list[tuple[float, int]]) -> float | None:
        if len(valores) < 2:
            return None
        precios = [v for v, _ in valores]
        km_prom = mean([k for _, k in valores])
        # Mismo criterio que usaba el tasador: 2% por cada 10.000 km de diferencia.
        factor = 1 + (((km_prom - km) / 10_000) * 0.02) if km > 0 else 1
        return round(_trimmed_mean(precios) * factor)

    reventa = ajustar([(float(p.price_resale), p.mileage) for p in de_mercado if p.price_resale])
    publico = ajustar([(float(p.price_public), p.mileage) for p in de_mercado if p.price_public])
    liquidacion = ajustar([(float(p.price_resale), p.mileage) for p in liquidados if p.price_resale])

    return {
        "sugerido_reventa": reventa,
        "sugerido_publico": publico,
        "sugerido_liquidacion": liquidacion,
        "muestras": len(de_mercado),
        "muestras_liquidacion": len(liquidados),
        "vendidos": sum(1 for p in de_mercado if p.kind == VENDIDO),
    }
