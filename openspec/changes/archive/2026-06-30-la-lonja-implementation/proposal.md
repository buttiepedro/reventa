---
title: La Lonja — Implementación Completa (Match + Ranking + Push)
type: feature
status: archived
spec: la_lonja
created: 2026-06-30
archived_at: 2026-06-30
---

# La Lonja — Implementación Completa

## Gap analysis

### Lo que existía antes

- Spec de La Lonja documentado ✅
- **No existía** ningún código: sin tablas, sin endpoints, sin UI

### Lo que faltaba

1. Tablas DB y modelos ORM: `client_requests`, `stock_offers`, `direct_matches`
2. Endpoints CRUD + match
3. Algoritmo de match cruzado
4. Ranking de ofertas
5. Notificaciones quirúrgicas
6. UI: feed, formulario, bandeja de ofertas

---

## Implementado (2026-06-30)

### Checklist final

- [x] Tablas `client_requests`, `stock_offers`, `direct_matches` en migración 0006
- [x] Feed de solicitudes activas visible para todas las empresas
- [x] Publicar solicitud con `expires_at = now() + 7 días`
- [x] Ofrecer vehículo a una solicitud con rank_score calculado
- [x] Notificación in-app al recibir oferta
- [x] Ofertas vistas ordenadas por score (dueño de solicitud)
- [x] Aceptar / rechazar oferta
- [x] Tab "Mis consultas" con solicitudes propias
- [ ] Auto-matching al publicar solicitud/vehículo (DirectMatch automático no implementado)
- [ ] WhatsApp deeplinks al aceptar oferta
- [ ] Filtro "Para mi stock" compatible
- [ ] Solicitudes expiran automáticamente a los 7 días (columna existe, cron no implementado)

### Algoritmo de ranking implementado

```
price_score  = 70 pts si precio ≤ budget_max; 0 si supera
model_score  = 20 pts si brand+model en reference_models
recency_score = hasta 10 pts según año del vehículo (año actual = 10 pts, -1 pt por año)
```

### Archivos implementados

- `backend/app/schemas/lonja.py`
- `backend/app/api/v1/endpoints/lonja.py`
- `backend/app/api/v1/router.py` (lonja registrado)
- `frontend/src/pages/lonja/Lonja.tsx`
- `frontend/src/services/lonjaService.ts`
