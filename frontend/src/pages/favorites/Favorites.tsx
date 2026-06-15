import { useEffect, useState } from "react";
import { toast } from "sonner";
import { vehicleService } from "@/services/vehicleService";
import { companyService } from "@/services/companyService";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { Company } from "@/types";

export function Favorites() {
  const [favorites, setFavorites] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [favs, all] = await Promise.all([
        vehicleService.listFavorites(),
        companyService.list(),
      ]);
      setFavorites(favs);
      setAllCompanies(all);
    } catch {
      toast.error("Error al cargar las concesionarias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const favIds = new Set(favorites.map((f) => f.id));
  const nonFavorites = allCompanies.filter((c) => !favIds.has(c.id));

  const handleAdd = async (id: string) => {
    try {
      await vehicleService.addFavorite(id);
      await load();
      toast.success("Concesionaria agregada a favoritas.");
    } catch {
      toast.error("No se pudo agregar como favorita.");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await vehicleService.removeFavorite(id);
      setFavorites((fs) => fs.filter((f) => f.id !== id));
      toast.success("Concesionaria quitada de favoritas.");
    } catch {
      toast.error("No se pudo quitar de favoritas.");
    }
  };

  return (
    <div className="pb-10 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Concesionarias favoritas</h1>
        <p className="text-sm text-gray-500 mt-1">Los vehículos de tus favoritas aparecen primero en la red.</p>
      </div>

      {loading && <div className="flex justify-center py-24"><Spinner /></div>}

      {!loading && (
        <div className="space-y-6">
          {favorites.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Tus favoritas</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {favorites.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">★ {c.name}</p>
                      <p className="text-xs text-gray-400">{c.slug}</p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => handleRemove(c.id)}>Quitar</Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {nonFavorites.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Otras concesionarias</h2>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {nonFavorites.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.slug}</p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleAdd(c.id)}>+ Favorita</Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {allCompanies.length === 0 && (
            <p className="text-gray-400 text-sm">No hay otras concesionarias en la red.</p>
          )}
        </div>
      )}
    </div>
  );
}
