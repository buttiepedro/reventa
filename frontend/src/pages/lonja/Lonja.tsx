import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lonjaService, type ClientRequest, type ClientRequestCreate, type StockOffer } from "@/services/lonjaService";
import { vehicleService } from "@/services/vehicleService";
import { buildWhatsAppUrl } from "@/utils/whatsapp";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import type { VehicleListItem } from "@/types/vehicle";

type Tab = "consultas" | "mis_consultas";

const PAYMENT_LABELS: Record<string, string> = {
  any: "Cualquier forma",
  cash: "Efectivo",
  financing: "Financiado",
  trade_in: "Toma en parte de pago",
};

function TabToggle({ active, onChange, count }: { active: Tab; onChange: (t: Tab) => void; count?: number }) {
  const tabs: { id: Tab; label: string; n?: number }[] = [
    { id: "consultas", label: "Consultas", n: count },
    { id: "mis_consultas", label: "Mis consultas" },
  ];
  return (
    <div className="flex gap-6 border-b border-line">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 transition-colors ${
              on ? "border-brand" : "border-transparent"
            }`}
          >
            <span className={`text-[13.5px] ${on ? "font-semibold text-ink" : "font-medium text-faint"}`}>{t.label}</span>
            {t.n != null && (
              <span className={`font-mono text-[11px] font-bold ${on ? "text-brand" : "text-faint"}`}>{t.n}</span>
            )}
          </button>
        );
      })}
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
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[17px] font-bold leading-none text-ink">
              ${Number(request.budget_max).toLocaleString()}
            </div>
            <div className="mt-1 text-[11.5px] text-faint">
              {PAYMENT_LABELS[request.payment_method] ?? request.payment_method}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold tracking-[0.05em] ${
            daysLeft <= 1 ? "bg-red-50 text-red-600" : "bg-mint text-brand"
          }`}>
            {daysLeft}D REST.
          </span>
        </div>
        <p className="mt-2.5 text-[14px] font-semibold leading-snug text-ink">
          {request.reference_models?.length
            ? request.reference_models.join(", ")
            : request.category ?? "Cualquier vehículo"}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {request.budget_min != null && (
            <span className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
              desde ${Number(request.budget_min).toLocaleString()}
            </span>
          )}
          {request.offer_count > 0 && (
            <span className="rounded-md border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
              {request.offer_count} oferta{request.offer_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
          <div className="min-w-0">
            <div className="truncate text-[11.5px] font-semibold text-muted">{request.company_name}</div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-[9px] border border-brand px-3.5 py-2 text-[12.5px] font-semibold text-brand transition-colors hover:bg-mint"
          >
            {expanded ? "Cancelar" : "Ofrecer mi stock"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-line-soft bg-canvas p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Seleccioná un vehículo de tu stock</label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15"
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
            className="w-full rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
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
      <button
        onClick={() => setShowForm(!showForm)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-strong"
      >
        {showForm ? "Cerrar" : "＋ Publicar Búsqueda de Cliente"}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-faint">Publicar consulta de cliente</p>
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
            <label className="text-xs font-semibold text-muted">Modelos de referencia (separados por coma)</label>
            <input
              type="text"
              value={modelsInput}
              onChange={(e) => setModelsInput(e.target.value)}
              placeholder="Ej: Toyota Hilux, Ford Ranger"
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted">Forma de pago</label>
            <select
              value={form.payment_method ?? "any"}
              onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15"
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
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50">
              {saving ? "Publicando..." : "Publicar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted">Cancelar</button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-2xl mb-2">🤝</p>
          <p className="text-sm font-semibold text-ink-soft">Sin consultas activas</p>
          <p className="mt-1 text-xs text-faint">Publicá las búsquedas de tus clientes para que la red te acerque opciones.</p>
        </div>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
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
                  req.status === "active" ? "bg-mint text-brand" : "bg-tab text-muted"
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
                          <span className="text-xs bg-mint text-brand px-2 py-0.5 rounded-full font-semibold">
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
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-xs font-semibold ${offer.status === "accepted" ? "text-green-600" : "text-gray-400"}`}>
                              {offer.status === "accepted" ? "Aceptada" : "Rechazada"}
                            </span>
                            {offer.status === "accepted" && offer.offering_company_phone && (
                              <a
                                href={buildWhatsAppUrl(offer.offering_company_phone, "lonja_offer", {
                                  vehicle: offer.vehicle_label,
                                  budget: String(Math.round(Number(req.budget_max))),
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] px-2 py-0.5 bg-[#25D366] text-white rounded-full font-semibold"
                              >
                                WhatsApp
                              </a>
                            )}
                          </div>
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
  const { user } = useAuth();
  const isReventa = user?.role === "reventa";
  const [tab, setTab] = useState<Tab>("consultas");
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [myVehicles, setMyVehicles] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchMyStock, setMatchMyStock] = useState(false);

  const loadRequests = () =>
    lonjaService.listRequests(matchMyStock)
      .then(setRequests)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    loadRequests();
  }, [matchMyStock]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    vehicleService.listMy().then(setMyVehicles).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-ink">La Lonja</h1>
        <p className="mt-0.5 text-[13px] text-faint">Demanda activa de la red entre agencias</p>
      </div>
      {isReventa && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Reventa Autorizado</span> — Podés ver las consultas activas y ofrecer tu stock, pero no podés publicar nuevas búsquedas.
        </div>
      )}
      <TabToggle active={tab} onChange={setTab} count={tab === "consultas" ? requests.length : undefined} />

      {tab === "consultas" && (
        <>
          <button
            onClick={() => setMatchMyStock((v) => !v)}
            className={`rounded-2xl border px-3 py-1 text-xs font-semibold transition-colors ${
              matchMyStock
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted"
            }`}
          >
            Para mi stock
          </button>
          {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-2xl mb-2">📋</p>
            <p className="text-sm font-semibold text-ink-soft">Sin consultas abiertas</p>
            <p className="mt-1 text-xs text-faint">Cuando otras agencias publiquen búsquedas de clientes, aparecerán acá.</p>
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
        )}
        </>
      )}

      {tab === "mis_consultas" && (
        isReventa ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <p className="text-2xl mb-2">🔒</p>
            <p className="text-sm font-semibold text-gray-700">Función no disponible</p>
            <p className="text-xs text-gray-400 mt-1">Las cuentas Reventa Autorizado no pueden publicar búsquedas. Solo podés ofrecer tu stock a las consultas de otros.</p>
          </div>
        ) : (
          <MyRequestsTab onRequestCreated={loadRequests} />
        )
      )}
    </div>
  );
}
