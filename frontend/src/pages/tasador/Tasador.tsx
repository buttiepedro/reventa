import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";

interface ValuationResult {
  brand: string;
  model: string;
  year: number;
  km: number;
  suggested_price: number | null;
  market_min: number | null;
  market_max: number | null;
  sample_count: number;
  price_samples: number[];
  source: string;
}

interface FormState {
  brand: string;
  model: string;
  year: number;
  km: number;
  offer_price: string;
}

interface Deducciones {
  cubiertas: boolean;
  chapa: boolean;
  parabrisas: boolean;
  custom: string;
}

const DEDUCCION_ITEMS = [
  { key: "cubiertas" as const, label: "Cubiertas desgastadas", amount: 800 },
  { key: "chapa" as const, label: "Daños estéticos / chapa", amount: 500 },
  { key: "parabrisas" as const, label: "Parabrisas roto", amount: 400 },
];

// ─── Thermometer ─────────────────────────────────────────────

function Thermometer({
  result,
  offerPrice,
}: {
  result: ValuationResult;
  offerPrice: number | null;
}) {
  const { market_min, market_max, suggested_price } = result;
  if (!market_min || !market_max || !suggested_price) return null;

  const range = market_max - market_min;
  const toPercent = (v: number) => Math.min(100, Math.max(0, ((v - market_min) / range) * 100));

  const suggestedPct = toPercent(suggested_price);
  const offerPct = offerPrice !== null ? toPercent(offerPrice) : null;

  let verdict = "";
  let verdictColor = "";
  if (offerPrice !== null) {
    const diff = ((offerPrice - suggested_price) / suggested_price) * 100;
    if (diff < -15) { verdict = "Muy por debajo del mercado"; verdictColor = "text-blue-600"; }
    else if (diff < -5) { verdict = "Por debajo del mercado"; verdictColor = "text-green-600"; }
    else if (diff <= 5) { verdict = "Precio de mercado"; verdictColor = "text-green-700"; }
    else if (diff <= 15) { verdict = "Por encima del mercado"; verdictColor = "text-amber-600"; }
    else { verdict = "Muy por encima del mercado"; verdictColor = "text-red-600"; }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Termómetro de mercado</p>
        <span className="font-mono text-[11px] text-faint">
          {result.sample_count} ref.{result.sample_count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Gradient bar: demanda alta → sobreoferta */}
      <div className="px-1">
        <div className="relative h-2.5 rounded-full" style={{ background: "linear-gradient(90deg,#1FA34F 0%,#8FC93A 32%,#E8B62C 62%,#D9663A 82%,#B42318 100%)" }}>
          {/* Suggested price marker */}
          <div
            className="absolute -top-[3px] h-[16px] w-[3px] -translate-x-1/2 rounded-sm bg-ink"
            style={{ left: `${suggestedPct}%` }}
            title="Sugerido"
          />
          {/* Offer price marker */}
          {offerPct !== null && (
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface ring-2 ring-ink"
              style={{ left: `${offerPct}%` }}
              title="Tu oferta"
            />
          )}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.06em] text-faint">
          <span>Demanda alta</span>
          <span>Sobreoferta</span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between px-1">
        <div>
          <p className="font-mono text-[13px] font-semibold text-ink-soft">${Number(market_min).toLocaleString()}</p>
          <p className="text-[11px] text-faint">Mínimo</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-[13px] font-bold text-brand">${Number(suggested_price).toLocaleString()}</p>
          <p className="text-[11px] text-brand">Sugerido</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[13px] font-semibold text-ink-soft">${Number(market_max).toLocaleString()}</p>
          <p className="text-[11px] text-faint">Máximo</p>
        </div>
      </div>

      {/* Verdict */}
      {offerPrice !== null && verdict && (
        <div className={`border-t border-line-soft pt-3 text-center text-sm font-bold ${verdictColor}`}>
          {verdict}
          <p className="mt-0.5 font-mono text-xs font-normal text-faint">
            Tu oferta: ${Number(offerPrice).toLocaleString()}
          </p>
        </div>
      )}

      {/* Samples */}
      {result.price_samples.length > 1 && (
        <div className="border-t border-line-soft pt-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.06em] text-faint">Precios en la red</p>
          <div className="flex flex-wrap gap-1.5">
            {result.price_samples.map((p, i) => (
              <span key={i} className="rounded-md bg-canvas px-2 py-0.5 font-mono text-[11px] text-muted">
                ${Number(p.toFixed(0)).toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────

export function Tasador() {
  const [form, setForm] = useState<FormState>({
    brand: "", model: "", year: new Date().getFullYear() - 3, km: 50000, offer_price: "",
  });
  const [deducciones, setDeducciones] = useState<Deducciones>({
    cubiertas: false, chapa: false, parabrisas: false, custom: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);

  const totalDeduccion =
    (deducciones.cubiertas ? 800 : 0) +
    (deducciones.chapa ? 500 : 0) +
    (deducciones.parabrisas ? 400 : 0) +
    Number(deducciones.custom || 0);

  const set = (key: keyof FormState, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleValuate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.model) return;
    setLoading(true);
    setResult(null);
    try {
      const params = new URLSearchParams({
        brand: form.brand,
        model: form.model,
        year: String(form.year),
        km: String(form.km),
      });
      const data = await api.get<ValuationResult>(`/tasador/valuate?${params}`);
      setResult(data);
    } catch {
      toast.error("Error al calcular la valoración.");
    } finally {
      setLoading(false);
    }
  };

  const offerPrice = form.offer_price ? Number(form.offer_price) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">Tasador</h1>
        <p className="mt-0.5 text-[13px] text-faint">Media recortada sobre operaciones comparables de la red</p>
      </div>

      <form onSubmit={handleValuate} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Datos de la toma</p>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Marca *"
            required
            value={form.brand}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="Toyota"
          />
          <Input
            label="Modelo *"
            required
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="Hilux"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Año"
            type="number"
            min={1990}
            max={new Date().getFullYear() + 1}
            value={form.year}
            onChange={(e) => set("year", Number(e.target.value))}
          />
          <Input
            label="Kilometraje"
            type="number"
            min={0}
            value={form.km}
            onChange={(e) => set("km", Number(e.target.value))}
          />
        </div>
        <Input
          label="Precio de toma ofrecido $ (opcional)"
          type="number"
          min={0}
          value={form.offer_price}
          onChange={(e) => set("offer_price", e.target.value)}
          placeholder="Ej: 15000000"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[10px] bg-brand py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {loading ? "Calculando..." : "Tasar"}
        </button>
      </form>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {result && !loading && (
        <>
          {result.sample_count === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm font-semibold text-ink-soft">Sin referencias en la red</p>
              <p className="mt-1 text-xs text-faint">
                No hay vehículos similares disponibles en la red aún.
                El tasador mejora a medida que más agencias carguen stock.
              </p>
            </div>
          ) : (
            <>
              <Thermometer result={result} offerPrice={offerPrice} />

              {/* Deducciones */}
              <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Deducciones por estado</p>
                <div className="space-y-2">
                  {DEDUCCION_ITEMS.map(({ key, label, amount }) => (
                    <label key={key} className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={deducciones[key]}
                          onChange={(e) => setDeducciones((d) => ({ ...d, [key]: e.target.checked }))}
                          className="w-4 h-4 rounded accent-red-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <span className="text-sm text-red-500 font-semibold">-${amount.toLocaleString()}</span>
                    </label>
                  ))}
                  <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-2">
                    <span className="shrink-0 text-sm text-ink-soft">Otra deducción ($)</span>
                    <input
                      type="number"
                      min={0}
                      value={deducciones.custom}
                      onChange={(e) => setDeducciones((d) => ({ ...d, custom: e.target.value }))}
                      placeholder="0"
                      className="w-28 rounded-[10px] border border-line px-2.5 py-1.5 text-right font-mono text-sm text-ink focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15"
                    />
                  </div>
                </div>

                {totalDeduccion > 0 && result.suggested_price && (
                  <div className="space-y-1 border-t border-line-soft pt-3">
                    <div className="flex justify-between text-xs text-muted">
                      <span>Precio sugerido de red</span>
                      <span className="font-mono">${Number(result.suggested_price).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-600">
                      <span>Total deducciones</span>
                      <span className="font-mono">-${totalDeduccion.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Precio máximo de toma — dark card */}
              {result.suggested_price != null && (
                <div className="rounded-2xl bg-ink p-5">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: "#7FCB9C" }}>
                    Precio máximo de toma sugerido
                  </p>
                  <p className="mt-2 font-mono text-[32px] font-bold leading-none tracking-tight text-white">
                    ${Math.max(0, result.suggested_price - totalDeduccion).toLocaleString()}
                  </p>
                  <p className="mt-2.5 text-[12px] leading-relaxed" style={{ color: "#A5AEA9" }}>
                    {totalDeduccion > 0
                      ? `Calculado restando $${totalDeduccion.toLocaleString()} en deducciones del precio sugerido de la red.`
                      : "Basado en la media recortada de operaciones comparables de la red."}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
