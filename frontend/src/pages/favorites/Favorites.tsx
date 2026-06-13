import { useEffect, useState } from "react";
import { vehicleService } from "../../services/vehicleService";
import type { Company } from "../../types";

export function Favorites() {
  const [favorites, setFavorites] = useState<Company[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [favs, all] = await Promise.all([
        vehicleService.listFavorites(),
        import("../../services/companyService").then((m) => m.companyService.list()),
      ]);
      setFavorites(favs);
      setAllCompanies(all);
    } catch {
      setError("Error al cargar las concesionarias.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const favIds = new Set(favorites.map((f) => f.id));

  const handleAdd = async (id: string) => {
    try {
      await vehicleService.addFavorite(id);
      load();
    } catch {
      alert("No se pudo agregar como favorita.");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await vehicleService.removeFavorite(id);
      setFavorites((fs) => fs.filter((f) => f.id !== id));
    } catch {
      alert("No se pudo quitar de favoritas.");
    }
  };

  const nonFavorites = allCompanies.filter((c) => !favIds.has(c.id));

  return (
    <div style={{ padding: "0 0 40px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Concesionarias favoritas</h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Los vehículos de tus favoritas aparecen primero en la red.
      </p>

      {loading && <div style={{ color: "#6b7280" }}>Cargando...</div>}
      {error && <div style={{ color: "#dc2626" }}>{error}</div>}

      {!loading && (
        <>
          {favorites.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Tus favoritas</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {favorites.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>★ {c.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{c.slug}</div>
                    </div>
                    <button onClick={() => handleRemove(c.id)} style={{ padding: "6px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {nonFavorites.length > 0 && (
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 10, color: "#374151" }}>Otras concesionarias</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {nonFavorites.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{c.slug}</div>
                    </div>
                    <button onClick={() => handleAdd(c.id)} style={{ padding: "6px 12px", background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                      + Favorita
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {allCompanies.length === 0 && <div style={{ color: "#9ca3af" }}>No hay otras concesionarias en la red.</div>}
        </>
      )}
    </div>
  );
}
