---
title: La Lonja (Mercado de Demanda B2B)
status: active
created: 2026-06-30
implemented: 2026-06-30
---

# La Lonja

## Purpose

Mercado de demanda B2B: las agencias publican lo que sus clientes están buscando comprar. Otras agencias que tengan ese stock pueden ofrecérselo directamente. El sistema detecta matches automáticos y los presenta en el Home como "Match Directo".

La Lonja complementa el Mercado (oferta): si el Mercado es "tengo esto para vender", La Lonja es "mi cliente busca comprar esto".

## Conceptos clave

- **Solicitud de compra (ClientRequest)**: publicada por una agencia en nombre de un cliente. Incluye presupuesto, categoría, modelos de referencia y filtros.
- **Oferta de stock (StockOffer)**: respuesta de otra agencia, vinculando uno de sus vehículos a la solicitud.
- **Match Directo**: cuando el sistema detecta que un vehículo del stock de otra agencia coincide con una solicitud activa propia, se genera un match automático sin que el otro haya tenido que responder manualmente.

## Requirements

### Requirement: Publicar solicitud de compra

Las agencias SHALL publicar búsquedas activas de sus clientes.

#### Scenario: Crear solicitud sin cliente específico

- **WHEN** se publica `{ budget, payment_method, category, reference_models[], filters{} }`
- **THEN** la solicitud aparece en La Lonja para todas las agencias activas

#### Scenario: Crear solicitud con cliente registrado

- **WHEN** se vincula a un cliente de la agenda propia (Con Cliente mode)
- **THEN** la solicitud queda vinculada a ese cliente para seguimiento

#### Scenario: Expiración automática

- **WHEN** una solicitud lleva más de 7 días sin actividad
- **THEN** se marca como inactiva y deja de aparecer en el feed

### Requirement: Ver solicitudes activas

Las agencias SHALL ver las solicitudes publicadas por otras agencias.

#### Scenario: Feed de solicitudes

- **WHEN** se accede a La Lonja
- **THEN** se ven las solicitudes activas de TODAS las agencias (no solo favoritas), ordenadas por fecha

#### Scenario: Filtrar por lo que tengo

- **WHEN** se activa el modo "Para mi stock"
- **THEN** solo aparecen solicitudes compatibles con los vehículos propios publicados

### Requirement: Ofrecer stock

Las agencias SHALL responder a solicitudes con vehículos de su stock.

#### Scenario: Ofrecer un vehículo

- **WHEN** se pulsa "Ofrecer mi Stock" en una solicitud
- **THEN** aparece un selector de vehículos propios (filtrados por compatibilidad con la solicitud)
- **AND** al confirmar se crea una StockOffer que notifica a la agencia publicante

#### Scenario: Recibir oferta

- **WHEN** otra agencia ofrece stock para mi solicitud
- **THEN** aparece en mi Home (Inicio) bajo "Ofertas Pendientes" y en el contador de actividad

### Requirement: Match Directo

El sistema SHALL detectar matches automáticos entre solicitudes y stock.

#### Scenario: Match detectado al publicar solicitud

- **WHEN** se publica una solicitud
- **THEN** el sistema compara contra el stock visible de todas las agencias
- **AND** si hay match → genera MatchCard en el Home de la agencia publicante

#### Scenario: Match detectado al publicar vehículo

- **WHEN** se publica o activa un vehículo en el stock
- **THEN** el sistema compara contra las solicitudes activas de todas las agencias
- **AND** si hay match → MatchCard en el Home de la agencia que publicó la solicitud

#### Scenario: Aceptar match

- **WHEN** la agencia pulsa "Aceptar" en un MatchCard
- **THEN** se abre WhatsApp o canal de contacto con la otra agencia
- **AND** la solicitud se marca como "en negociación"

### Requirement: Gestión propia

Las agencias SHALL administrar sus propias solicitudes.

#### Scenario: Ver solicitudes propias

- **WHEN** se accede a "Mis solicitudes" desde La Lonja
- **THEN** se listan propias con estado (activa / en negociación / cerrada)

#### Scenario: Cerrar solicitud

- **WHEN** el cliente compró o ya no está interesado
- **THEN** la agencia puede cerrar manualmente la solicitud

## Modelo de datos

```sql
client_requests
  id              UUID PK
  company_id      UUID FK → companies.id
  budget          DECIMAL
  payment_method  VARCHAR(20)   -- 'cash', 'financed', 'trade'
  category        VARCHAR(100)  -- 'hatchback', 'suv_compacto', etc.
  reference_models TEXT[]       -- ['Clio', 'Gol Trend']
  filters         JSONB         -- {max_km, min_year, fuel, transmission, ...}
  status          VARCHAR(20)   -- 'active', 'negotiating', 'closed'
  expires_at      TIMESTAMP     -- now() + 7 days
  created_at      TIMESTAMP

stock_offers
  id                  UUID PK
  client_request_id   UUID FK → client_requests.id
  offering_company_id UUID FK → companies.id
  vehicle_id          UUID FK → vehicles.id
  message             TEXT nullable
  status              VARCHAR(20)  -- 'pending', 'accepted', 'rejected'
  created_at          TIMESTAMP

direct_matches
  id                  UUID PK
  client_request_id   UUID FK
  vehicle_id          UUID FK
  notified_company_id UUID FK  -- quien recibe el MatchCard
  status              VARCHAR(20)  -- 'pending', 'accepted', 'rejected', 'expired'
  created_at          TIMESTAMP
```

## Implementación sugerida

- `app/models/client_request.py`, `stock_offer.py`, `direct_match.py`
- `app/services/match.py` — lógica de matching, triggered al crear solicitud o vehículo
- `app/api/v1/endpoints/lonja.py`
- `src/pages/lonja/Lonja.tsx` — feed de solicitudes + CTA publicar
- `src/pages/lonja/PublishRequest.tsx` — formulario de solicitud
- `src/components/ui/ClientRequestCard.tsx`
- `src/components/ui/MatchCard.tsx`

## Implementación (2026-06-30)

### Estado: Fase 1 — CRUD + ranking de ofertas implementados

**Backend:**
- `backend/alembic/versions/0006_v2_foundation.py` — tablas `client_requests`, `stock_offers`, `direct_matches`
- `backend/app/schemas/lonja.py` — `ClientRequestCreate/Read`, `StockOfferCreate/Read`
- `backend/app/api/v1/endpoints/lonja.py`:
  - `GET /lonja/requests` — feed activo (excluye propia empresa)
  - `GET /lonja/my-requests` — mis solicitudes
  - `POST /lonja/requests` — crea con `expires_at = now + 7 días`
  - `DELETE /lonja/requests/{id}` — cancela (status=cancelled)
  - `GET /lonja/requests/{id}/offers` — solo visible al dueño de la solicitud
  - `POST /lonja/requests/{id}/offers` — crea oferta con rank_score calculado + Notification
  - `PATCH /lonja/offers/{id}?new_status=accepted|rejected`

**Algoritmo de ranking implementado:**
- price_score: 70 pts (0 si fuera del presupuesto)
- model_score: 20 pts (si brand+model está en reference_models)
- recency_score: hasta 10 pts (según año del vehículo)

**Frontend:**
- `frontend/src/pages/lonja/Lonja.tsx` — 2 tabs: "La red busca" | "Mis consultas"
- `frontend/src/services/lonjaService.ts`

**No implementado aún:**
- Auto-matching al publicar solicitud/vehículo (DirectMatch automático)
- WhatsApp deeplinks al aceptar una oferta
- Filtro "Para mi stock" compatible con stock propio
