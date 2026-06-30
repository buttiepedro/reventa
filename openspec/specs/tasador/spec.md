---
title: Tasador (Herramienta de Valoración de Tomas)
status: active
created: 2026-06-30
implemented: 2026-06-30
---

# Tasador

## Purpose

Herramienta que ayuda a las agencias a calcular el precio máximo al que les conviene tomar un vehículo usado, considerando el precio de mercado de ese modelo en la red Reventa, el margen de ganancia objetivo y los descuentos por estado del vehículo.

El "Termómetro de Mercado" muestra si hay muchos o pocos vehículos similares en la red, lo que impacta directamente en cuánto tiempo tardará en venderse.

## Conceptos clave

- **Precio Gremio**: precio promedio al que se están vendiendo vehículos del mismo modelo/año en la red Reventa. Se calcula sobre los vehículos `status=sold` o sobre los `status=available` como referencia.
- **Termómetro de Mercado**: indicador de demanda/oferta. Verde = poca oferta (buen momento para tomar), Rojo = mucha oferta (venta lenta, mayor riesgo).
- **Precio Máximo de Toma Sugerido**: `precio_gremio × (1 - margen/100) - descuentos_detectados`.
- **Descuentos por estado**: cubiertas gastadas, problemas de chapa, etc. Configurables por el sistema.

## Requirements

### Requirement: Consulta de precio y mercado

Las agencias SHALL consultar el precio de referencia de cualquier modelo.

#### Scenario: Consulta básica

- **WHEN** se ingresa año/modelo + kilómetros + margen deseado
- **THEN** se muestran:
  - Termómetro de mercado (gauge)
  - Etiqueta de mercado: "Subdemanda / Buena toma" | "Mercado equilibrado" | "Sobreoferta / Venta lenta"
  - Precio Gremio (promedio de red)
  - Precio Máximo de Toma Sugerido

#### Scenario: Modelo sin datos suficientes

- **WHEN** hay menos de 3 vehículos en la red para ese modelo/año
- **THEN** se indica "Datos insuficientes" y se usa el precio de mercado externo si está disponible

#### Scenario: Ajuste por kilómetros

- **WHEN** el km ingresado es mayor al promedio de la red para ese modelo
- **THEN** se aplica un descuento proporcional al precio sugerido

### Requirement: Descuentos por estado

El sistema SHALL permitir registrar defectos que impactan el precio.

#### Scenario: Agregar descuento

- **WHEN** se marca "Cubiertas gastadas" u otro ítem predefinido
- **THEN** se deduce el monto estándar del precio sugerido y se muestra en el detalle del cálculo

#### Scenario: Descuento personalizado

- **WHEN** se ingresa un monto libre de deducción
- **THEN** se suma a los descuentos y se recalcula el precio

### Requirement: Termómetro de mercado

El sistema SHALL mostrar el nivel de competencia para el modelo consultado.

#### Scenario: Cálculo del termómetro

- **GIVEN** N vehículos del mismo modelo/año `status=available` en la red
- **WHEN** se calcula el índice de saturación
- **THEN** se clasifica: verde (0-3), amarillo (4-7), rojo (8+) por unidades en red

#### Scenario: Actualización del termómetro

- **WHEN** cambia el stock de vehículos de ese modelo en la red
- **THEN** el índice se recalcula (sin cache larga, máximo 1h)

### Requirement: Historial de consultas

Las agencias SHOULD poder revisar consultas recientes del Tasador.

#### Scenario: Guardar consulta

- **WHEN** se completa una consulta en el Tasador
- **THEN** queda guardada en el historial de la empresa con fecha y resultado

## Modelo de datos

```sql
tasador_queries (opcional, para historial)
  id              UUID PK
  company_id      UUID FK
  model_ref       VARCHAR(200)  -- "Toyota Hilux 2023"
  make_id         UUID nullable FK
  model_id        UUID nullable FK
  year            INTEGER
  km              INTEGER
  desired_margin  DECIMAL(5,2)
  market_price    DECIMAL       -- precio_gremio calculado
  suggested_price DECIMAL       -- precio_maximo_toma
  market_index    DECIMAL       -- 0-1, donde 1 = saturado
  discounts       JSONB         -- [{label, amount}]
  created_at      TIMESTAMP
```

La lógica de precio gremio se calcula on-the-fly desde los vehículos de la red:
```sql
SELECT AVG(price) FROM vehicles
WHERE model ILIKE :model AND year = :year AND status IN ('available', 'sold')
AND created_at > now() - interval '90 days'
```

## Implementación sugerida

- `app/api/v1/endpoints/tasador.py` — POST /tasador/calculate
- `app/services/tasador.py` — calcular precio gremio, índice de mercado, precio sugerido
- `src/pages/tasador/Tasador.tsx` — formulario + gauge + resultado
- `src/components/ui/MarketThermometer.tsx` — gauge SVG semicircular

## Implementación (2026-06-30)

### Estado: Fase 1 — red interna + termómetro implementados

**Backend:**
- `backend/app/api/v1/endpoints/tasador.py`
- Endpoint: `GET /tasador/valuate?brand=&model=&year=&km=`
- Busca vehículos `status=available` con año ±2, brand/model ILIKE
- Ajuste km: ±2% por 10.000 km respecto al promedio de la red
- Trimmed mean 10% (elimina top/bottom 10% de precios)
- Retorna: `suggested_price`, `market_min`, `market_max`, `sample_count`, `price_samples`

**Frontend:**
- `frontend/src/pages/tasador/Tasador.tsx` — formulario (brand, model, year, km, offer_price) + Thermometer inline
- Thermometer: barra rango verde, línea verde en precio sugerido, dot ámbar en precio ofrecido, veredicto textual (Muy por debajo → Muy por encima), lista de precios en la red

**No implementado aún:**
- Scraper externo para modelos sin datos suficientes en la red
- Deducciones predefinidas por estado del vehículo
- Cascading selects con catálogo (actualmente inputs de texto libre)
- Historial de consultas por empresa
