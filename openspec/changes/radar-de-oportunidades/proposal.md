---
title: Avisos por Radar y respetar el estado elegido al cargar
type: feature
status: proposed
spec: marketplace
created: 2026-10-28
---

# Avisos por Radar, y que cargar un auto lo deje donde lo pediste

## Resumen

Dos cosas que salieron de la misma conversación.

La primera es un arreglo: cargar un auto tiene que dejarlo en el estado que
elegiste, sin pasarlo por Pre Toma en el camino.

La segunda es la que da valor: hoy el Radar de Mi Agencia guarda las marcas y
modelos que a cada agencia le interesan, y **nadie los mira**. Esta propuesta los
pone a trabajar — cuando aparece un auto que coincide, la agencia se entera — y
le da al agente de WhatsApp la tarea de completar ese Radar conversando.

---

## Qué es una Pre Toma

Vale dejarlo escrito porque es la base de todo lo demás: una Pre Toma es un auto
que la agencia **todavía no recibió** y está por tomar, normalmente en parte de
pago. Se publica a un precio por debajo del de mercado (del orden de un 15%) para
ver si alguien de la red lo quiere antes de quedárselo.

No es "stock en preparación": es una oportunidad que todavía puede no concretarse.

---

## Parte 1 — Respetar el estado elegido

### Cómo está hoy

| Vía de carga | Qué hace |
|---|---|
| Formulario web | Respeta el estado elegido (Disponible, Pre Toma, Reservado, Vendido) ✅ |
| Agente de WhatsApp | **Siempre** crea en `pre_toma`, fijo en el código ❌ |
| Liquidación | No se puede cargar directo: la API exige que el auto esté en `available` |

El agente nació así a propósito, para que un auto leído de una foto fuera
reversible. Pero convierte en Pre Toma algo que el usuario pidió publicar, y una
Pre Toma significa otra cosa: que el auto todavía no es tuyo.

### Qué cambia

- El agente crea el vehículo en el estado que el usuario pidió. Si no lo dijo,
  pregunta antes de proponer la carga, en vez de asumir.
- Cargar directo en liquidación no obliga a pasar por Pre Toma y Disponible.
- Nada de esto toca el camino que ya funciona bien: un auto publicado que se pasa
  a liquidación sigue igual.

---

## Parte 2 — Que el Radar avise

### Cómo está hoy

`RadarEntry` existe desde la primera versión de Mi Agencia y guarda marca, modelo,
km máximo, año mínimo y precio máximo. Tiene alta, baja y listado, y **ninguna
consulta lo cruza contra los vehículos**. Es una lista de deseos que nadie lee.

Mientras tanto, el aviso de Pre Toma le llega **a todas las agencias activas de la
red**, sin filtrar por nada. Eso ya es ruido, y por WhatsApp además se cobra por
conversación.

### Qué cambia

Cuando un vehículo entra en Pre Toma, se publica en la red o pasa a Liquidación,
salen **dos avisos distintos, con textos distintos**:

| Aviso | A quién | Por qué le llega |
|---|---|---|
| **Coincide con tu Radar** | Agencias cuyo Radar matchea marca, modelo, año, km y precio | Porque lo estaban buscando |
| **Novedad de una conectada** | Agencias conectadas con la que publica | Porque trabajan juntas |

Separados a propósito: si llegan con el mismo texto, nadie entiende por qué le
llegó, y a la semana los silencia a todos.

Una agencia que cumple las dos condiciones recibe **un solo aviso**, el de Radar,
que es el más específico.

### El agente completa el Radar

Si la agencia no tiene nada cargado en el Radar, la próxima vez que le escriba al
agente, este le pregunta qué marcas y modelos busca y lo guarda. No insiste: si el
usuario no quiere, no se le vuelve a preguntar por un tiempo.

Con el Radar cargado, el agente puede además recomendar autos de la red que
coincidan, cuando se lo pidan.

---

## Alcance

### Incluye
- El agente respeta el estado pedido al cargar un vehículo
- Carga directa en liquidación sin pasar por Pre Toma ni Disponible
- Matcheo de vehículos contra el Radar, al entrar en Pre Toma, al publicarse y al liquidarse
- Dos tipos de aviso con texto propio, sin duplicar cuando una agencia califica para ambos
- El agente pregunta por el Radar cuando está vacío, y recomienda autos que coincidan

### No incluye
- Cambiar el Radar de modelo de datos: alcanza con los campos que ya tiene
- Avisos por cambios de precio de un auto ya publicado
- Que el Radar aprenda solo de las búsquedas de cada agencia

---

## Preguntas abiertas

- **¿Qué tan flexible es el matcheo?** El Radar guarda modelo como texto, y los
  vehículos también. "Corolla" contra "Corolla XEI" tiene que matchear; eso depende
  de la normalización que propone el change `catalogo-unificacion-modelos`.
- **¿Hay tope de avisos?** Una agencia con diez entradas de Radar amplias puede
  recibir media red. Conviene medirlo antes de elegir un límite.
- **¿El aviso de Pre Toma a toda la red se mantiene?** Con el Radar andando pierde
  sentido, y es el más caro por WhatsApp. Habría que apagarlo, pero recién cuando
  haya suficientes Radares cargados como para que no se deje de avisar nada.

---

## Acceptance criteria

- [ ] Pedirle al agente que cargue un auto como disponible lo deja en `available`, no en `pre_toma`
- [ ] Si no se dijo el estado, el agente lo pregunta antes de proponer la carga
- [ ] Un auto se puede cargar directo en liquidación sin pasar por Pre Toma
- [ ] Un vehículo que coincide con el Radar de otra agencia le dispara un aviso al publicarse
- [ ] El mismo vehículo dispara aviso al pasar a Pre Toma y al pasar a Liquidación
- [ ] Una agencia conectada y con Radar coincidente recibe un solo aviso, el de Radar
- [ ] El texto del aviso dice si llegó por Radar o por conexión
- [ ] Con el Radar vacío, el agente lo pregunta en la siguiente conversación
- [ ] Si el usuario no quiere cargarlo, el agente no vuelve a preguntar en esa conversación
