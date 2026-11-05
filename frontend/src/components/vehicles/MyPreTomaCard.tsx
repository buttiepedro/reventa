import { useState } from "react";
import { toast } from "sonner";

import { vehicleService, type PreTomaInterest } from "@/services/vehicleService";
import { Spinner } from "@/components/ui/Spinner";
import type { VehicleListItem } from "@/types/vehicle";

function horasRestantes(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "vencida";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Una pre-toma propia: lo que importa es quién la quiere antes de que se venza. */
export function MyPreTomaCard({ vehicle, onPublish }: {
  vehicle: VehicleListItem;
  onPublish: (id: string) => Promise<void>;
}) {
  const [interests, setInterests] = useState<PreTomaInterest[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const toggleInterests = async () => {
    if (interests !== null) return setInterests(null);
    setLoading(true);
    try {
      setInterests(await vehicleService.listInterests(vehicle.id));
    } catch {
      toast.error("No se pudieron cargar los interesados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-canvas">
          {vehicle.primary_image_url
            ? <img src={vehicle.primary_image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
            : <div className="flex h-full items-center justify-center text-xs text-faint">Sin img</div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">
            {vehicle.brand} {vehicle.model} {vehicle.year}
          </p>
          <p className="text-sm text-muted">
            {vehicle.mileage.toLocaleString("es-AR")} km
            <span className="mx-1.5 text-line" aria-hidden="true">·</span>
            <span className="whitespace-nowrap">${Number(vehicle.price_resale).toLocaleString("es-AR")}</span>
          </p>
          {vehicle.pre_toma_expires_at && (
            <p className="mt-0.5 text-[11px] font-semibold text-warn">
              Vence en {horasRestantes(vehicle.pre_toma_expires_at)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={toggleInterests}
          className="rounded-[10px] border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-canvas"
        >
          {interests !== null ? "Ocultar interesados" : "Ver interesados"}
        </button>
        <button
          onClick={async () => { setPublishing(true); try { await onPublish(vehicle.id); } finally { setPublishing(false); } }}
          disabled={publishing}
          className="rounded-[10px] bg-brand px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-50"
        >
          {publishing ? "Publicando..." : "Quedármelo y publicar"}
        </button>
      </div>

      {loading && <div className="flex justify-center py-3"><Spinner /></div>}

      {interests !== null && !loading && (
        interests.length === 0 ? (
          <p className="mt-3 text-[13px] text-faint">Todavía no la marcó nadie.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft border-t border-line-soft">
            {interests.map((i) => (
              <li key={i.company_id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-sm font-medium text-ink">{i.company_name}</span>
                <span className="shrink-0 text-xs text-faint">
                  {new Date(i.created_at).toLocaleDateString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
