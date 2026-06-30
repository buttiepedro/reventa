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
    <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm font-bold text-gray-800">Termómetro de mercado</p>
        <span className="text-xs text-gray-400">{result.sample_count} referencia{result.sample_count !== 1 ? "s" : ""} en la red</span>
      </div>

      {/* Bar */}
      <div className="relative h-4 bg-gray-100 rounded-full overflow-visible mx-2">
        {/* Market range */}
        <div className="absolute inset-y-0 left-0 right-0 bg-green-100 rounded-full" />
        {/* Suggested price marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1 h-6 bg-green-500 rounded-full z-10"
          style={{ left: `${suggestedPct}%` }}
        />
        {/* Offer price marker */}
        {offerPct !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-amber-500 rounded-full ring-2 ring-white z-20"
            style={{ left: `${offerPct}%`, transform: "translate(-50%, -50%)" }}
          />
        )}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <div>
          <p className="font-semibold text-gray-600">${Number(market_min).toLocaleString()}</p>
          <p>Mínimo</p>
        </div>
        <div className="text-center">
          <p className="font-bold text-green-700">${Number(suggested_price).toLocaleString()}</p>
          <p className="text-green-600">Sugerido</p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-600">${Number(market_max).toLocaleString()}</p>
          <p>Máximo</p>
        </div>
      </div>

      {/* Verdict */}
      {offerPrice !== null && verdict && (
        <div className={`text-center text-sm font-bold ${verdictColor} border-t border-gray-100 pt-3`}>
          {verdict}
          <p className="text-xs font-normal text-gray-400 mt-0.5">
            Tu oferta: ${Number(offerPrice).toLocaleString()}
          </p>
        </div>
      )}

      {/* Samples */}
      {result.price_samples.length > 1 && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">Precios en la red</p>
          <div className="flex flex-wrap gap-1.5">
            {result.price_samples.map((p, i) => (
              <span key={i} className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full">
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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);

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
      <h1 className="text-xl font-bold text-gray-900">Tasador</h1>

      <form onSubmit={handleValuate} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Ingresá los datos de la toma</p>
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
          className="w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
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
            <div className="bg-white rounded-xl shadow-sm p-8 text-center">
              <p className="text-2xl mb-2">🔍</p>
              <p className="text-sm font-semibold text-gray-700">Sin referencias en la red</p>
              <p className="text-xs text-gray-400 mt-1">
                No hay vehículos similares disponibles en la red aún.
                El tasador mejora a medida que más agencias carguen stock.
              </p>
            </div>
          ) : (
            <Thermometer result={result} offerPrice={offerPrice} />
          )}
        </>
      )}
    </div>
  );
}
