---
title: Catálogo de modelos que se arma solo, con unificación de duplicados
type: feature
status: proposed
spec: vehicle_catalog
created: 2026-10-09
---

# Catálogo de modelos desde el uso, con un worker que unifica duplicados

## Resumen

Las marcas son una lista cerrada que se sincroniza desde Mercado Libre, más la
opción "Otro". Modelo y versión son texto libre.

Esta propuesta cubre el paso siguiente: que el catálogo de **modelos** se construya
a partir de lo que realmente cargan las agencias, y que un worker nocturno detecte
variantes del mismo modelo escritas distinto y las unifique — solo cuando está
seguro, y preguntando en el panel de admin cuando no lo está.

---

## Por qué no se traen los modelos de una API

No existe una fuente gratuita con la relación marca → modelo del mercado argentino.
Está verificado, no supuesto:

| Fuente | Resultado |
|---|---|
| **CarAPI** | Paga. Catálogo estadounidense. |
| **NHTSA vPIC** | Gratis y sin auth, pero sin Cronos, sin Amarok, 11 modelos de Fiat. |
| **CarQuery** | Certificado SSL inválido (hostname mismatch). |
| **Wikidata** | Devuelve modelos de Alfa Romeo al pedir Fiat; 8 modelos para Volkswagen; sin Hilux ni Gol. |
| **Mercado Libre** | 200 marcas argentinas ✅ · 2770 modelos en **lista plana sin marca** ❌ · atributo de versiones **sin valores** ❌ |

Con MELI se probaron siete rutas distintas usando un token de aplicación válido:
`catalog_domains/.../attributes/MODEL/values` devuelve `route_not_found`, las facetas
de búsqueda y el API de productos devuelven 403, y `technical_specs` repite la misma
lista plana. La relación vive en el flujo de publicación del vendedor, no en la API.

InfoAuto es la única fuente local con motorizaciones reales, y es paga.

La conclusión práctica: los datos que necesitamos ya los están tipeando las agencias.
Lo que falta no es una fuente, es ordenar lo que entra.

---

## El problema a resolver

Con texto libre, el mismo auto entra escrito de varias formas:

```
BMW 240 i   ·  BMW 240i   ·  BMW 240 I
Corolla XEI ·  Corolla Xei 1.8  ·  COROLLA XEI
```

Eso rompe tres cosas: la búsqueda en la red no encuentra stock que existe, el tasador
promedia sobre muestras partidas, y el agente de WhatsApp normaliza contra un catálogo
sucio.

---

## Propuesta

### 1. El catálogo aprende de cada carga

Al crear o editar un vehículo, su `brand` + `model` se registran como entrada de
catálogo si no existía, con un contador de uso. Nada bloquea la carga: el catálogo es
consecuencia, no requisito.

El formulario sugiere con autocompletado sobre los modelos ya conocidos de esa marca,
ordenados por uso. Eso solo ya reduce la mayoría de las variantes, porque la segunda
persona que cargue un Corolla lo ve sugerido.

### 2. Un worker nocturno busca parecidos

Corre una vez por día, por marca, y compara los modelos entre sí.

**Normalización previa** (barata y de alta precisión): minúsculas, sin acentos,
espacios colapsados, y separación de letras y números pegados. Con eso
`BMW 240 i`, `BMW 240i` y `BMW 240 I` colapsan al mismo valor.

**Distancia de edición** sobre lo normalizado, para el resto.

Tres resultados posibles:

| Caso | Acción |
|---|---|
| Idénticos tras normalizar | **Unifica solo** y lo registra |
| Parecidos por encima del umbral | **Pregunta** en el panel de admin |
| Distintos | No hace nada |

`Corolla XEI` vs `Corolla XEI 1.8` cae en el segundo caso a propósito: puede ser la
misma versión escrita incompleta, o dos motorizaciones distintas. Eso no lo decide un
umbral, lo decide alguien que sabe de autos.

### 3. Una cola de sugerencias en el panel de admin

Cada sugerencia muestra los dos nombres, cuántos vehículos usa cada uno y de qué
agencias vienen. Tres botones: **unificar en A**, **unificar en B**, **son distintos**.

"Son distintos" se recuerda: ese par no se vuelve a sugerir nunca más. Sin eso, la cola
muestra lo mismo todas las noches y se deja de mirar, que es la forma más común en que
una herramienta así muere.

### 4. Unificar reescribe los vehículos

Unificar no es solo tocar el catálogo: actualiza el `model` de los vehículos afectados
al nombre ganador. Queda registrado quién unificó qué y cuándo, y **se puede deshacer**:
un merge mal hecho sobre cientos de vehículos sin vuelta atrás es peor que el duplicado.

---

## Alcance

### Incluye
- Tabla de modelos por marca con contador de uso, alimentada al crear y editar vehículos
- Autocompletado de modelo en el formulario y en la app móvil
- Worker nocturno de detección, con unificación automática solo para coincidencias exactas tras normalizar
- Cola de sugerencias en el panel de super admin, con el par rechazado recordado
- Unificación que reescribe los vehículos, auditada y reversible

### No incluye
- Motorizaciones. La versión sigue siendo texto libre hasta que haya una fuente que valga.
- Unificar marcas: son lista cerrada desde MELI.
- Unificar entre marcas distintas.

---

## Preguntas abiertas

- **¿Qué umbral de distancia?** Hay que medirlo contra los datos reales, no elegirlo de
  antemano. Con pocos vehículos cargados conviene arrancar conservador y aflojar mirando
  qué sugiere.
- **¿La unificación automática necesita aviso?** Aun siendo exacta tras normalizar,
  reescribe vehículos de otra agencia. Puede alcanzar con dejarlo en el log, o convenir
  avisarle al dueño.
- **¿Qué pasa con los modelos que nadie volvió a usar?** Un typo cargado una sola vez va
  a quedar en el catálogo para siempre ensuciando el autocompletado.

---

## Acceptance criteria

- [ ] Cargar un vehículo con un modelo nuevo lo agrega al catálogo de esa marca
- [ ] El formulario sugiere modelos conocidos de la marca elegida, por uso
- [ ] `BMW 240 i` y `BMW 240i` se unifican solas y queda registrado
- [ ] `Corolla XEI` y `Corolla XEI 1.8` llegan a la cola como sugerencia, no se unifican solas
- [ ] Marcar un par como distinto lo saca de la cola para siempre
- [ ] Unificar actualiza los vehículos que usaban el nombre perdedor
- [ ] Una unificación se puede deshacer y los vehículos vuelven a su valor anterior
- [ ] El worker corre una vez por día sin que nadie lo dispare
