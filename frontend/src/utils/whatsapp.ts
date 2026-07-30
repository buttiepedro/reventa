const TEMPLATES = {
  lonja_offer: "Hola! Vi la oferta de {vehicle} para mi búsqueda en La Lonja de Reventa (presupuesto ${budget}). ¿Podemos hablar?",
  pre_toma_acceptance: "Hola! Me escribo por la Pre Toma del {vehicle} que publicaste en Reventa. Estoy interesado/a. ¿Podemos hablar?",
  match_direct: "Hola! Soy {sender_name} de {sender_agency}. Reventa detectó que tengo el {vehicle} que tu cliente está buscando. ¿Lo hablamos?",
} as const;

type Template = keyof typeof TEMPLATES;

export function buildWhatsAppUrl(phone: string, template: Template, vars: Record<string, string>): string {
  const clean = phone.replace(/[+\s\-()]/g, "");
  const text = TEMPLATES[template].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}
