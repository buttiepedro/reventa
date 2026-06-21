import { useEffect, useState } from "react";
import { toast } from "sonner";
import { favoriteService, type FavoriteRequest } from "@/services/favoriteService";
import { companyService } from "@/services/companyService";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import type { Company } from "@/types";

export function Favorites() {
  const [confirmed, setConfirmed] = useState<Company[]>([]);
  const [incoming, setIncoming] = useState<FavoriteRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FavoriteRequest[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [conf, inc, out, all] = await Promise.all([
        favoriteService.getConfirmed(),
        favoriteService.getIncomingRequests(),
        favoriteService.getOutgoingRequests(),
        companyService.list(),
      ]);
      setConfirmed(conf);
      setIncoming(inc);
      setOutgoing(out);
      setAllCompanies(all);
    } catch {
      toast.error("Error al cargar las concesionarias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const confirmedIds = new Set(confirmed.map((c) => c.id));
  const pendingIds = new Set([
    ...incoming.map((r) => r.requester_id),
    ...outgoing.map((r) => r.requester_id),
  ]);
  const available = allCompanies.filter((c) => !confirmedIds.has(c.id) && !pendingIds.has(c.id));

  const handleSendRequest = async (id: string) => {
    try {
      await favoriteService.sendRequest(id);
      toast.success("Solicitud enviada.");
      load();
    } catch (err: unknown) {
      toast.error((err as { detail?: string })?.detail ?? "No se pudo enviar la solicitud.");
    }
  };

  const handleAccept = async (id: string) => {
    try {
      await favoriteService.acceptRequest(id);
      toast.success("Solicitud aceptada. ¡Ahora son concesionarias conectadas!");
      load();
    } catch {
      toast.error("No se pudo aceptar la solicitud.");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await favoriteService.remove(id);
      toast.success("Solicitud rechazada.");
      load();
    } catch {
      toast.error("Error al rechazar la solicitud.");
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("¿Eliminar esta conexión?")) return;
    try {
      await favoriteService.remove(id);
      setConfirmed((cs) => cs.filter((c) => c.id !== id));
      toast.success("Conexión eliminada.");
    } catch {
      toast.error("No se pudo eliminar la conexión.");
    }
  };

  return (
    <div className="pb-10 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Concesionarias</h1>
        <p className="text-sm text-gray-500 mt-1">
          Conectate con otras concesionarias para ver sus Pre Tomas y priorizarlas en la red.
        </p>
      </div>

      {loading && <div className="flex justify-center py-24"><Spinner /></div>}

      {!loading && (
        <div className="space-y-6">
          {/* Incoming requests */}
          {incoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                Solicitudes recibidas
                <Badge tone="blue">{incoming.length}</Badge>
              </h2>
              <div className="bg-white rounded-xl border border-blue-100 shadow-sm divide-y divide-gray-50">
                {incoming.map((r) => (
                  <div key={r.requester_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{r.requester_name}</p>
                      <p className="text-xs text-gray-400">Te envió una solicitud de conexión</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAccept(r.requester_id)}>Aceptar</Button>
                      <Button variant="danger" size="sm" onClick={() => handleReject(r.requester_id)}>Rechazar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Confirmed connections */}
          {confirmed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Conectadas</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {confirmed.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                        <span className="text-green-500 text-xs">●</span> {c.name}
                      </p>
                      <p className="text-xs text-gray-400">{c.slug}</p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleRemove(c.id)}>Desconectar</Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Outgoing pending */}
          {outgoing.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Solicitudes enviadas</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {outgoing.map((r) => (
                  <div key={r.requester_id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{r.requester_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="yellow">Pendiente</Badge>
                      <Button variant="danger" size="sm" onClick={() => handleReject(r.requester_id)}>Cancelar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Other companies to connect with */}
          {available.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Otras concesionarias en la red</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {available.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.slug}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleSendRequest(c.id)}>
                      Conectar
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {allCompanies.length === 0 && (
            <p className="text-gray-400 text-sm">No hay otras concesionarias en la red todavía.</p>
          )}
        </div>
      )}
    </div>
  );
}
