import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { companyService, type CompanyProfileUpdate, type RadarEntryCreate } from "@/services/companyService";
import { favoriteService, type FavoriteRequest } from "@/services/favoriteService";
import { whatsappService, type LinkCode, type LinkStatus } from "@/services/whatsappService";
import { api } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { ReputationBadge } from "@/components/ReputationBadge";
import { Spinner } from "@/components/ui/Spinner";
import { Input } from "@/components/ui/Input";
import type { Company, CompanyProfile, RadarEntry } from "@/types";

type Tab = "perfil" | "conexiones" | "radar" | "reputacion";

// ─── Tab Toggle ──────────────────────────────────────────────

function TabToggle({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "perfil", label: "Perfil" },
    { id: "conexiones", label: "Conexiones" },
    { id: "radar", label: "Radar" },
    { id: "reputacion", label: "Reputación" },
  ];
  return (
    <div className="flex gap-5 overflow-x-auto border-b border-line no-scrollbar">
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`-mb-px shrink-0 border-b-2 pb-2.5 text-[13px] transition-colors ${
              on ? "border-brand font-semibold text-ink" : "border-transparent font-medium text-faint"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Profile hero ────────────────────────────────────────────

function AgencyHero() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    companyService.getMyProfile().then(setProfile).catch(() => {});
  }, []);

  const rating = profile?.avg_rating != null ? Number(profile.avg_rating) : null;
  const light = rating == null ? "gray" : rating >= 4 ? "green" : rating >= 3 ? "amber" : "red";
  const lightLabel = { green: "Semáforo en verde", amber: "Semáforo en amarillo", red: "Semáforo en rojo", gray: "Sin calificaciones" }[light];
  const dotColor = { green: "bg-brand-lo", amber: "bg-amber-600", red: "bg-red-600", gray: "bg-gray-300" }[light];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* Cover */}
      <div className="h-28 photo-hatch" />
      <div className="px-4 pb-4">
        <div className="-mt-8 flex items-end gap-3.5">
          {profile?.logo_url ? (
            <img src={profile.logo_url} alt="" className="h-[68px] w-[68px] shrink-0 rounded-2xl border border-line bg-surface object-cover shadow-md" />
          ) : (
            <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-[28px] font-light text-ink shadow-md">
              {(profile?.name ?? "R")[0]}
            </span>
          )}
          <div className="pb-1">
            <div className="text-[17px] font-bold leading-tight text-ink">{profile?.name ?? "Mi Agencia"}</div>
            {profile?.cuit_verified ? (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                <span className="text-[12px] font-semibold text-brand">CUIT verificado</span>
              </div>
            ) : (
              <div className="mt-1 text-[12px] text-faint">CUIT sin verificar</div>
            )}
          </div>
        </div>

        {/* Semáforo */}
        <div className={`mt-3 flex items-center gap-2 rounded-[10px] border px-3 py-2.5 ${light === "green" ? "border-mint-border bg-mint" : "border-line bg-canvas"}`}>
          <span className="flex gap-1">
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
            <span className={`h-2 w-2 rounded-full ${dotColor}`} />
          </span>
          <span className={`text-[12.5px] font-semibold ${light === "green" ? "text-brand" : "text-muted"}`}>{lightLabel}</span>
          {rating != null && (
            <span className="ml-auto font-mono text-[12px] text-mint-ink">
              {rating.toFixed(1)} · {profile?.total_ratings ?? 0} op.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CUIT status banner ──────────────────────────────────────

function CuitBanner({ profile, onSubmit }: { profile: CompanyProfile; onSubmit: (cuit: string) => Promise<void> }) {
  const [cuit, setCuit] = useState(profile.cuit ?? "");
  const [saving, setSaving] = useState(false);

  if (profile.cuit_verified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700 flex items-center gap-2">
        <span className="text-base">✓</span>
        <span>CUIT verificado</span>
      </div>
    );
  }

  if (profile.cuit && profile.cuit_submitted_at && !profile.cuit_review_notes) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-700">
        Tu CUIT está en revisión. Te notificaremos cuando sea aprobado.
      </div>
    );
  }

  if (profile.cuit_review_notes) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
        <p className="text-sm text-red-700">
          <strong>CUIT rechazado.</strong> Motivo: {profile.cuit_review_notes}. Corregilo y volvé a enviar.
        </p>
        <div className="flex gap-2">
          <input
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
            placeholder="20-12345678-9"
            className="flex-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            onClick={async () => { setSaving(true); try { await onSubmit(cuit); } finally { setSaving(false); } }}
            disabled={saving || !cuit}
            className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? "..." : "Reenviar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-sm text-amber-700">
        <strong>Completá tu CUIT</strong> para poder publicar vehículos en la red.
      </p>
      <div className="flex gap-2">
        <input
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
          placeholder="20-12345678-9"
          className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={async () => { setSaving(true); try { await onSubmit(cuit); } finally { setSaving(false); } }}
          disabled={saving || !cuit}
          className="px-3 py-1.5 bg-amber-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {saving ? "..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}

// ─── Logo uploader ───────────────────────────────────────────

function LogoUploader({ profile, onLogoChange }: { profile: CompanyProfile; onLogoChange: (url: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await companyService.uploadLogo(file);
      onLogoChange(res.logo_url);
      toast.success("Logo actualizado.");
    } catch (err: unknown) {
      const detail = (err as { detail?: string }).detail ?? "Error al subir el logo.";
      toast.error(detail);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    try {
      await companyService.deleteLogo();
      onLogoChange(null);
      toast.success("Logo eliminado.");
    } catch {
      toast.error("Error al eliminar el logo.");
    }
  };

  return (
    <div className="flex items-center gap-4">
      {profile.logo_url ? (
        <img src={profile.logo_url} alt="Logo" className="w-16 h-16 rounded-xl object-cover border border-gray-100" />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-2xl font-bold text-gray-400">
          {profile.name[0]}
        </div>
      )}
      <div>
        <label className="cursor-pointer text-sm text-blue-600 hover:underline">
          {uploading ? "Subiendo..." : profile.logo_url ? "Cambiar logo" : "Subir logo"}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {profile.logo_url && (
          <button onClick={handleDelete} className="block text-xs text-red-400 mt-1 hover:text-red-600">
            Eliminar
          </button>
        )}
        <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WEBP · máx 2MB</p>
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────

// ─── WhatsApp link ───────────────────────────────────────────

function WhatsAppCard() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [code, setCode] = useState<LinkCode | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => whatsappService.getStatus().then(setStatus).catch(() => setStatus(null));

  useEffect(() => { reload(); }, []);

  // The agent is optional infrastructure: if it is not deployed, say nothing.
  if (status === null) return null;

  const handleConnect = async () => {
    setBusy(true);
    try {
      setCode(await whatsappService.requestCode());
    } catch {
      toast.error("No se pudo generar el código.");
    } finally {
      setBusy(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (!status.linked) return;
    const next = !status.notifications_enabled;
    setStatus({ ...status, notifications_enabled: next });  // optimistic: it is a switch
    try {
      await whatsappService.setNotifications(next);
    } catch {
      setStatus({ ...status, notifications_enabled: !next });
      toast.error("No se pudo cambiar el aviso.");
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    try {
      await whatsappService.revoke();
      setCode(null);
      toast.success("Número desvinculado.");
      reload();
    } catch {
      toast.error("No se pudo desvincular.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Asistente por WhatsApp</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            Vinculá tu número y consultá el stock de la red desde WhatsApp.
          </p>
        </div>
        {status.linked && (
          <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
            Vinculado
          </span>
        )}
      </div>

      {status.linked ? (
        <div className="space-y-3 border-t border-line pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink">{status.phone_masked}</p>
            <button
              onClick={handleRevoke}
              disabled={busy}
              className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
            >
              Desvincular
            </button>
          </div>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-[13px] text-muted">
              Avisarme por WhatsApp de ofertas y pre-tomas
            </span>
            <input
              type="checkbox"
              checked={status.notifications_enabled}
              onChange={handleToggleNotifications}
              className="h-4 w-4 shrink-0 accent-brand"
            />
          </label>
        </div>
      ) : code ? (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="text-[13px] text-muted">
            Mandá este código por WhatsApp
            {code.whatsapp_number ? <> al <span className="font-semibold text-ink">{code.whatsapp_number}</span></> : null}:
          </p>
          <p className="font-mono text-[28px] font-bold tracking-[0.2em] text-ink">{code.code}</p>
          <p className="text-[12px] text-faint">
            Vence a las {new Date(code.expires_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}.
            Cuando lo mandes, el asistente te confirma acá mismo por chat.
          </p>
          <button onClick={handleConnect} disabled={busy} className="text-xs font-semibold text-brand hover:underline disabled:opacity-50">
            Generar otro código
          </button>
        </div>
      ) : (
        <div className="border-t border-line pt-3">
          <button
            onClick={handleConnect}
            disabled={busy}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
          >
            {busy ? "Generando..." : "Conectar WhatsApp"}
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<CompanyProfileUpdate>({});
  const [saving, setSaving] = useState(false);

  const reload = () =>
    companyService.getMyProfile()
      .then((p) => { setProfile(p); setForm({ name: p.name, phone: p.phone ?? "", description: p.description ?? "", address_text: p.address_text ?? "", lat: p.lat ?? undefined, lng: p.lng ?? undefined }); })
      .catch(() => toast.error("No se pudo cargar el perfil."));

  useEffect(() => { reload(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: CompanyProfileUpdate = {};
      if (form.name) payload.name = form.name;
      if (form.phone !== undefined) payload.phone = form.phone || undefined;
      if (form.description !== undefined) payload.description = form.description || undefined;
      if (form.address_text !== undefined) payload.address_text = form.address_text || undefined;
      if (form.lat !== undefined) payload.lat = form.lat;
      if (form.lng !== undefined) payload.lng = form.lng;
      const updated = await companyService.updateMyProfile(payload);
      setProfile(updated);
      setEditing(false);
      toast.success("Perfil actualizado.");
    } catch {
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleCuitSubmit = async (cuit: string) => {
    try {
      await companyService.submitCuit(cuit);
      toast.success("CUIT enviado para verificación.");
      reload();
    } catch (err: unknown) {
      const detail = (err as { detail?: string }).detail ?? "CUIT inválido.";
      toast.error(detail);
    }
  };

  if (!profile) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!editing) {
    return (
      <div className="space-y-3">
        <CuitBanner profile={profile} onSubmit={handleCuitSubmit} />

        <WhatsAppCard />

        <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
              <p className="text-xs text-gray-400">@{profile.slug}</p>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-green-600 font-semibold hover:underline"
            >
              Editar
            </button>
          </div>

          <LogoUploader
            profile={profile}
            onLogoChange={(url) => setProfile((p) => p ? { ...p, logo_url: url } : p)}
          />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="CUIT" value={profile.cuit} />
            <Field label="Teléfono" value={profile.phone} />
            <Field label="Dirección" value={profile.address_text} className="col-span-2" />
          </div>
          {profile.description && (
            <p className="text-sm text-gray-600 border-t border-gray-100 pt-3">{profile.description}</p>
          )}
          {profile.avg_rating && (
            <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
              <span className="text-yellow-500 font-bold">★ {Number(profile.avg_rating).toFixed(1)}</span>
              <span className="text-xs text-gray-400">({profile.total_ratings} valoraciones)</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3">
            <Link to="/vehicles/my" className="text-sm text-green-600 font-semibold hover:underline">
              → Ver mi stock
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 space-y-4">
      <h2 className="text-base font-bold text-gray-900">Editar perfil</h2>
      <Input label="Nombre de agencia" value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      <Input label="Teléfono / WhatsApp" value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+54 9 11 1234-5678" />
      <Input label="Dirección" value={form.address_text ?? ""} onChange={(e) => setForm((f) => ({ ...f, address_text: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitud" type="number" step="any" value={form.lat ?? ""} onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value ? Number(e.target.value) : undefined }))} placeholder="-34.6037" />
        <Input label="Longitud" type="number" step="any" value={form.lng ?? ""} onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value ? Number(e.target.value) : undefined }))} placeholder="-58.3816" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[13px] font-semibold text-muted">Descripción</label>
        <textarea
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none focus:ring-[3px] focus:ring-brand/15"
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-2 text-gray-500 text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800">{value ?? <span className="text-gray-300">—</span>}</p>
    </div>
  );
}

// ─── Conexiones Tab ──────────────────────────────────────────

function ConexionesTab() {
  const [confirmed, setConfirmed] = useState<Company[]>([]);
  const [incoming, setIncoming] = useState<FavoriteRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const [c, i] = await Promise.all([
        favoriteService.getConfirmed(),
        favoriteService.getIncomingRequests(),
      ]);
      setConfirmed(c);
      setIncoming(i);
    } catch {
      toast.error("Error al cargar conexiones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const handleAccept = async (id: string) => {
    await favoriteService.acceptRequest(id).catch(() => toast.error("Error"));
    reload();
    toast.success("Conexión aceptada.");
  };

  const handleRemove = async (id: string) => {
    await favoriteService.remove(id).catch(() => toast.error("Error"));
    reload();
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {incoming.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="px-4 py-2.5 border-b border-gray-100 bg-amber-50">
            <p className="text-xs font-semibold text-amber-700">Solicitudes pendientes ({incoming.length})</p>
          </div>
          {incoming.map((r) => (
            <div key={r.requester_id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800">{r.requester_name}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(r.requester_id)}
                  className="rounded-2xl bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => handleRemove(r.requester_id)}
                  className="rounded-2xl border border-line px-3 py-1 text-xs font-medium text-muted"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Conectadas ({confirmed.length})</p>
        </div>
        {confirmed.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">Sin conexiones aún. Buscá agencias en el Mercado y enviá solicitudes.</p>
          </div>
        ) : (
          confirmed.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800">{c.name}</p>
              <button
                onClick={() => handleRemove(c.id)}
                className="text-xs text-red-400 hover:text-red-600"
              >
                Desconectar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Radar Tab ───────────────────────────────────────────────

function RadarTab() {
  const [entries, setEntries] = useState<RadarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RadarEntryCreate>({ brand: "" });
  const [saving, setSaving] = useState(false);

  const reload = () =>
    companyService.listRadar()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => { reload(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await companyService.createRadarEntry(form);
      setForm({ brand: "" });
      setShowForm(false);
      reload();
      toast.success("Entrada añadida al radar.");
    } catch {
      toast.error("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await companyService.deleteRadarEntry(id).catch(() => toast.error("Error"));
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-gray-800">Radar de reposición</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-2xl bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-strong"
          >
            + Agregar
          </button>
        </div>
        <p className="text-xs text-gray-400">Definí qué vehículos buscás. El sistema te notificará cuando haya matches.</p>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-line bg-surface p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">Nueva entrada</p>
          <Input label="Marca *" required value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
          <Input label="Modelo" value={form.model ?? ""} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value || undefined }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Km máximo" type="number" min={0} value={form.max_km ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_km: e.target.value ? Number(e.target.value) : undefined }))} />
            <Input label="Año mínimo" type="number" min={1990} value={form.min_year ?? ""} onChange={(e) => setForm((f) => ({ ...f, min_year: e.target.value ? Number(e.target.value) : undefined }))} />
          </div>
          <Input label="Precio máximo $" type="number" min={0} value={form.max_price ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_price: e.target.value ? Number(e.target.value) : undefined }))} />
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-[10px] bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-500 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center">
          <p className="text-2xl mb-2">📡</p>
          <p className="text-sm font-semibold text-gray-700">Radar vacío</p>
          <p className="text-xs text-gray-400 mt-1">Añadí las marcas y modelos que te interesan.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between px-4 py-3 border-b border-gray-50 last:border-0">
              <div>
                <p className="text-sm font-semibold text-gray-800">{entry.brand}{entry.model ? ` ${entry.model}` : ""}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[
                    entry.min_year ? `desde ${entry.min_year}` : null,
                    entry.max_km ? `hasta ${entry.max_km.toLocaleString()} km` : null,
                    entry.max_price ? `hasta $${Number(entry.max_price).toLocaleString()}` : null,
                  ].filter(Boolean).join(" · ") || "Sin filtros adicionales"}
                </p>
              </div>
              <button onClick={() => handleDelete(entry.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-3 mt-0.5">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reputación Tab ──────────────────────────────────────────

interface RatingSummary {
  avg_rating: number | null;
  total_ratings: number;
  reputation_score: number | null;
  recent: { id: string; rater_name: string; rating: number; comment: string | null; created_at: string }[];
}

function ReputacionTab() {
  const { user } = useAuth();
  const [data, setData] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.company_id) return;
    api.get<RatingSummary>(`/ratings/${user.company_id}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.company_id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  if (!data || data.total_ratings === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-3xl mb-2">⭐</p>
        <p className="text-sm font-semibold text-gray-700">Sin calificaciones aún</p>
        <p className="text-xs text-gray-400 mt-1">Las calificaciones aparecen después de completar operaciones en La Lonja.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-surface p-5 space-y-3">
        <div className="flex items-center gap-3">
          <ReputationBadge score={data.reputation_score} avg={data.avg_rating ?? undefined} count={data.total_ratings} size="md" />
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Promedio</p>
            <p className="font-bold text-gray-900">{data.avg_rating?.toFixed(1) ?? "—"} / 5</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Calificaciones</p>
            <p className="font-bold text-gray-900">{data.total_ratings}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500">Últimas calificaciones</p>
        </div>
        {data.recent.map((r) => (
          <div key={r.id} className="px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-800">{r.rater_name}</p>
                {r.comment && <p className="text-xs text-gray-500 mt-0.5 italic">"{r.comment}"</p>}
              </div>
              <span className="text-yellow-500 font-bold text-sm shrink-0 ml-2">{"★".repeat(r.rating)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────

export function MyAgency() {
  const [tab, setTab] = useState<Tab>("perfil");

  return (
    <div className="space-y-4">
      <AgencyHero />
      <TabToggle active={tab} onChange={setTab} />
      {tab === "perfil" && <ProfileTab />}
      {tab === "conexiones" && <ConexionesTab />}
      {tab === "radar" && <RadarTab />}
      {tab === "reputacion" && <ReputacionTab />}
    </div>
  );
}
