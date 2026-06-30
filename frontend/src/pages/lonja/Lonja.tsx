import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lonjaService, type ClientRequest, type ClientRequestCreate, type StockOffer } from "@/services/lonjaService";
import { vehicleService } from "@/services/vehicleService";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import type { VehicleListItem } from "@/types/vehicle";

type Tab = "consultas" | "mis_consultas";

const PAYMENT_LABELS: Record<string, string> = {
  any: "Cualquier forma",
  cash: "Efectivo",
  financing: "Financiado",
  trade_in: "Toma en parte de pago",
};

function TabToggle({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-2">
      {(["consultas", "mis_consultas"] as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
            active === t ? "bg-green-600 text-white" : "bg-white text-gray-500 border border-gray-200"
          }`}
        >
          {t === "consultas" ? "La red busca" : "Mis consultas"}
        </button>
      ))}
    </div>
  );
}

// ─── ClientRequest Card ──────────────────────────────────────

function RequestCard({
  request,
  myVehicles,
  onOfferSent,
}: {
  request: ClientRequest;
  myVehicles: VehicleListItem[];
  onOfferSent: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const daysLeft = Math.max(0, Math.ceil((new Date(request.expires_at).getTime() - Date.now()) / 86_400_000));

  const handleSubmitOffer = async () => {
    if (!selectedVehicle) return;
    setSending(true);
    try {
      await lonjaService.submitOffer(request.id, selectedVehicle, message || undefined);
      toast.success("Oferta enviada.");
      setExpanded(false);
      setSelectedVehicle("");
      setMessage("");
      onOfferSent();
    } catch {
      toast.error("Error al enviar la oferta.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-xs text-gray-400 mb-0.5">{request.company_name}</p>
            <p className="text-base font-bold text-gray-900">
              {request.reference_models?.length
                ? request.reference_models.join(", ")
                : request.category ?? "Cualquier vehículo"}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
              <span>
                Presupuesto:{" "}
                <span className="font-semibold text-green-700">
                  {request.budget_min ? `$${Number(request.budget_min).toLocaleString()} – ` : "hasta "}
                  ${Number(request.budget_max).toLocaleString()}
                </span>
              </span>
              <span>· {PAYMENT_LABELS[request.payment_method] ?? request.payment_method}</span>
              {request.offer_count > 0 && (
                <span>· {request.offer_count} oferta{request.offer_count !== 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
          <span className={`ml-3 text-xs font-semibold shrink-0 ${daysLeft <= 1 ? "text-red-500" : "text-gray-400"}`}>
            {daysLeft}d
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs font-semibold text-green-600 hover:underline"
        >
          {expanded ? "Cancelar" : "Ofrecer vehículo →"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3 bg-gray-50">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Seleccioná un vehículo de tu stock</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— Elegí un vehículo —</option>
              {myVehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} {v.year} · ${Number(v.price_resale).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Mensaje opcional"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej: el auto está impecable, con service al día..."
          />
          <button
            onClick={handleSubmitOffer}
            disabled={!selectedVehicle || sending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 w-full"
          >
            {sending ? "Enviando..." : "Enviar oferta"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── My Requests Tab ─────────────────────────────────────────

function MyRequestsTab({ onRequestCreated }: { onRequestCreated: () => void }) {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientRequestCreate>({ budget_max: 0 });
  const [modelsInput, setModelsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedOffers, setExpandedOffers] = useState<Record<string, StockOffer[]>>({});
  const [loadingOffers, setLoadingOffers] = useState<string | null>(null);

  const reload = () =>
    lonjaService.listMyRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { reload(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: ClientRequestCreate = { ...form };
      if (modelsInput.trim()) {
        payload.reference_models = modelsInput.split(",").map((s) => s.trim()).filter(Boolean);
      }
      await lonjaService.createRequest(payload);
      setForm({ budget_max: 0 });
      setModelsInput("");
      setShowForm(false);
      reload();
      onRequestCreated();
      toast.success("Consulta publicada en La Lonja.");
    } catch {
      toast.error("Error al publicar la consulta.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    await lonjaService.cancelRequest(id).catch(() => toast.error("Error"));
    reload();
  };

  const toggleOffers = async (reqId: string) => {
    if (expandedOffers[reqId]) {
      setExpandedOffers((prev) => { const n = { ...prev }; delete n[reqId]; return n; });
      return;
    }
    setLoadingOffers(reqId);
    try {
      const offers = await lonjaService.listOffers(reqId);
      setExpandedOffers((prev) => ({ ...prev, [reqId]: offers }));
    } catch {
      toast.error("Error al cargar las ofertas.");
    } finally {
      setLoadingOffers(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs px-4 py-2 bg-green-600 text-white rounded-full font-semibold"
        >
          + Nueva consulta
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <p className="text-sm font-bold text-gray-900">Publicar consulta de cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Presupuesto mín. $"
              type="number"
              min={0}
              value={form.budget_min ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, budget_min: e.target.value ? Number(e.target.value) : undefined }))}
            />
            <Input
              label="Presupuesto máx. $ *"
              type="number"
              min={0}
              required
              value={form.budget_max || ""}
              onChange={(e) => setForm((f) => ({ ...f, budget_max: Number(e.target.value) }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Modelos de referencia (separados por coma)</label>
            <input
              type="text"
              value={modelsInput}
              onChange={(e) => setModelsInput(e.target.value)}
              placeholder="Ej: Toyota Hilux, Ford Ranger"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Forma de pago</label>
            <select
              value={form.payment_method ?? "any"}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="any">Cualquier forma</option>
              <option value="cash">Efectivo</option>
              <option value="financing">Financiado</option>
              <option value="trade_in">Toma en parte de pago</option>
            </select>
          </div>
          <Input
            label="Notas adicionales"
            value={form.notes ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || undefined }))}
            placeholder="Color preferido, año mínimo, etc."
          />
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? "Publicando..." : "Publicar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500">Cancelar</button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <p className="text-2xl mb-2">🤝</p>
          <p className="text-sm font-semibold text-gray-700">Sin consultas activas</p>
          <p className="text-xs text-gray-400 mt-1">Publicá las búsquedas de tus clientes para que la red te acerque opciones.</p>
        </div>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {req.reference_models?.length ? req.reference_models.join(", ") : "Cualquier vehículo"}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    hasta ${Number(req.budget_max).toLocaleString()} · {PAYMENT_LABELS[req.payment_method] ?? req.payment_method}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  req.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {req.status === "active" ? "Activa" : "Cerrada"}
                </span>
              </div>
              <div className="flex gap-4 mt-3">
                {req.offer_count > 0 && (
                  <button
                    onClick={() => toggleOffers(req.id)}
                    className="text-xs font-semibold text-green-600 hover:underline"
                  >
                    {loadingOffers === req.id ? "Cargando..." : expandedOffers[req.id] ? "Ocultar ofertas ▲" : `Ver ${req.offer_count} oferta${req.offer_count !== 1 ? "s" : ""} ▼`}
                  </button>
                )}
                {req.status === "active" && (
                  <button onClick={() => handleCancel(req.id)} className="text-xs text-red-400 hover:text-red-600">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
            {expandedOffers[req.id] && (
              <div className="border-t border-gray-100">
                {expandedOffers[req.id].map((offer) => (
                  <div key={offer.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{offer.vehicle_label}</p>
                        <p className="text-xs text-gray-400">{offer.offering_company_name} · ${Number(offer.vehicle_price).toLocaleString()}</p>
                        {offer.message && <p className="text-xs text-gray-500 mt-0.5 italic">"{offer.message}"</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-3">
                        {offer.rank_score !== null && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                            {Number(offer.rank_score).toFixed(0)}pts
                          </span>
                        )}
                        {offer.status === "pending" ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => lonjaService.updateOffer(offer.id, "accepted").then(() => toggleOffers(req.id))}
                              className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => lonjaService.updateOffer(offer.id, "rejected").then(() => toggleOffers(req.id))}
                              className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <span className={`text-xs font-semibold ${offer.status === "accepted" ? "text-green-600" : "text-gray-400"}`}>
                            {offer.status === "accepted" ? "Aceptada" : "Rechazada"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────

export function Lonja() {
  const [tab, setTab] = useState<Tab>("consultas");
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [myVehicles, setMyVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRequests = () =>
    lonjaService.listRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    loadRequests();
    vehicleService.listMy().then(setMyVehicles).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">La Lonja</h1>
      <TabToggle active={tab} onChange={setTab} />

      {tab === "consultas" && (
        loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm font-semibold text-gray-700">Sin consultas abiertas</p>
            <p className="text-xs text-gray-400 mt-1">Cuando otras agencias publiquen búsquedas de clientes, aparecerán acá.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                myVehicles={myVehicles.filter((v) => v.status === "available")}
                onOfferSent={loadRequests}
              />
            ))}
          </div>
        )
      )}

      {tab === "mis_consultas" && (
        <MyRequestsTab onRequestCreated={loadRequests} />
      )}
    </div>
  );
}
