---
title: Tasador v2 — Scraper Externo + Eliminación de Outliers
type: feature
status: proposed
spec: tasador
created: 2026-06-30
---

# Tasador v2 — Scraper Externo + Eliminación de Outliers

## Gap analysis

### Lo que existe hoy

- Spec del Tasador documentado ✅ (`openspec/specs/tasador/spec.md`)
- **No existe** ningún código de implementación del Tasador
- **No existe** endpoint `POST /api/v1/tasador/calculate`
- **No existe** cálculo de precio referencia desde la red interna
- **No existe** scraper externo

### Lo que falta

1. Implementación del endpoint del Tasador con cálculo desde la red interna
2. Scraper de portales externos para modelos con pocos datos en la red
3. Eliminación de outliers (valores extremos) en el cálculo de precio promedio
4. Output financiero completo con margen y deducciones

---

## Cambios requeridos

### Backend

**`app/services/tasador.py`** (nuevo)

```python
class TasadorService:
    
    async def calculate(self, make: str, model: str, year: int, km: int, margin_pct: float,
                        discounts: list[dict], session: AsyncSession) -> TasadorResult:
        
        # 1. Precio de referencia de la red interna
        internal_price = await self._get_internal_reference(make, model, year, session)
        
        # 2. Si hay pocos datos (<3 vehículos), usar scraper externo
        if internal_price is None:
            external_prices = await self._scrape_external(make, model, year)
            reference_price = self._trim_mean(external_prices)  # elimina outliers
            data_source = "external"
        else:
            reference_price = internal_price
            data_source = "internal"
        
        # 3. Ajuste por kilómetros (vs promedio del modelo)
        km_adjustment = self._km_adjustment(km, make, model, year)
        
        # 4. Índice de mercado (oferta/demanda)
        supply_count = await self._count_active_supply(make, model, year, session)
        market_index = min(1.0, supply_count / 10)  # normalizado 0-1, saturado en 10+ unidades
        
        # 5. Deducciones declaradas
        total_discounts = sum(d["amount"] for d in discounts)
        
        # 6. Precio máximo de toma
        adjusted = reference_price * (1 - km_adjustment)
        suggested_price = adjusted * (1 - margin_pct / 100) - total_discounts
        
        return TasadorResult(
            reference_price=reference_price,
            suggested_price=max(0, suggested_price),
            market_index=market_index,
            market_label=self._market_label(market_index),
            supply_count=supply_count,
            data_source=data_source,
            adjustments={
                "km_adjustment_pct": km_adjustment * 100,
                "margin_pct": margin_pct,
                "discounts": discounts,
                "total_discounts": total_discounts,
            }
        )
    
    def _trim_mean(self, prices: list[float], trim_pct: float = 0.15) -> float:
        """Elimina el 15% inferior y superior (outliers) y promedia el resto."""
        if not prices:
            return 0
        sorted_prices = sorted(prices)
        n = len(sorted_prices)
        cut = int(n * trim_pct)
        trimmed = sorted_prices[cut:n-cut] if cut > 0 else sorted_prices
        return sum(trimmed) / len(trimmed)
    
    def _market_label(self, index: float) -> str:
        if index < 0.3: return "Subdemanda / Buena oportunidad"
        if index < 0.6: return "Mercado equilibrado"
        return "Sobreoferta / Venta Lenta"
```

**Scraper externo** — `app/services/tasador_scraper.py`

```python
import httpx
from bs4 import BeautifulSoup

class TasadorScraper:
    """
    Scraper controlado para portales públicos argentinos.
    Rate-limited: máximo 1 consulta por modelo cada 6 horas (cache en Redis o DB).
    """
    
    SOURCES = [
        "mercadolibre",   # /autos/search?q={make}+{model}+{year}
        "deautos",        # portal alternativo
    ]
    
    async def fetch_prices(self, make: str, model: str, year: int) -> list[float]:
        # Verificar cache (última consulta para este modelo)
        cached = await self._get_cache(make, model, year)
        if cached:
            return cached
        
        prices = []
        async with httpx.AsyncClient(timeout=10.0) as client:
            for source in self.SOURCES:
                try:
                    raw = await self._fetch_source(client, source, make, model, year)
                    prices.extend(self._parse_prices(source, raw))
                except Exception:
                    continue  # fuente no disponible, continuar con la siguiente
        
        await self._set_cache(make, model, year, prices)
        return prices
    
    def _parse_prices(self, source: str, html: str) -> list[float]:
        """Extrae precios numéricos del HTML parseado con BeautifulSoup."""
        ...
```

**Cache de scraping** — tabla `scraper_cache`:
```sql
CREATE TABLE scraper_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(200) UNIQUE,  -- "{make}_{model}_{year}"
  prices JSONB,                   -- [12000, 13500, 14200, ...]
  fetched_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ          -- fetched_at + 6h
);
```

**Endpoint**:
```
POST /api/v1/tasador/calculate
Body: {
  make: str,
  model: str,
  year: int,
  km: int,
  desired_margin_pct: float,
  discounts: [{label: str, amount: float}]
}
Response: TasadorResult
```

### Frontend

**`src/pages/tasador/Tasador.tsx`** (nuevo — Tasador no existe hoy)

- Form: cascading selects de marca/modelo del catálogo, año, km, margen %
- Sección de deducciones: checkboxes predefinidos + monto libre
  - "Cubiertas gastadas" (deducción estándar configurable, ej: USD 800)
  - "Detalles de chapa" (USD 500)
  - "Parabrisas roto" (USD 400)
  - "Otro" (campo libre)
- Output: MarketThermometer + label + precio sugerido grande
- Badge "Datos de red interna" o "Datos de portales externos" para transparencia

**`src/components/ui/MarketThermometer.tsx`** (nuevo)
- SVG gauge semicircular, aguja animada, colores verde→amarillo→rojo
- Recibe `market_index: number` (0-1)

---

## Consideraciones legales y técnicas

- El scraping de portales debe respetar sus `robots.txt` y ToS
- Rate limiting estricto: máximo 1 request por modelo cada 6 horas
- User-Agent identificable como "Reventa-Market-Bot/1.0"
- Alternativa sin scraping: integración con InfoAuto API (si tienen API pública/privada)

---

## Criterios de aceptación

- [ ] `POST /tasador/calculate` funcional con datos de red interna
- [ ] Outliers eliminados (trimmed mean 15%)
- [ ] Si <3 datos en red → usa scraper externo
- [ ] Scraping cacheado 6hs por modelo (sin spam a portales)
- [ ] Output muestra: precio referencia, índice de mercado, precio sugerido, desglose
- [ ] MarketThermometer visual con aguja y label
- [ ] Deducciones predefinidas + monto libre restan del precio sugerido
