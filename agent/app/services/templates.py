"""The proactive messages the agent may send, and nothing else.

Outside the 24h window Meta only accepts templates it approved in advance, so this
registry has to mirror what was submitted there: same name, same parameter order.
`text` is the wording used inside the window, where free text is allowed.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Template:
    meta_name: str
    params: tuple[str, ...]
    text: str

    def render(self, values: dict) -> str:
        return self.text.format(**{k: values.get(k, "") for k in self.params})

    def ordered(self, values: dict) -> list[str]:
        """Body parameters, in the order Meta expects them."""
        return [str(values.get(name, "")) for name in self.params]


TEMPLATES: dict[str, Template] = {
    "nueva_pretoma": Template(
        meta_name="nueva_pretoma",
        params=("label",),
        text="Nueva pre-toma en la red: {label}.",
    ),
    "nueva_oferta": Template(
        meta_name="nueva_oferta",
        params=("label",),
        text="Recibiste una oferta en La Lonja: {label}. Entrá a revisarla.",
    ),
    "oferta_aceptada": Template(
        meta_name="oferta_aceptada",
        params=("label",),
        text="¡Te aceptaron la oferta! {label}.",
    ),
}
