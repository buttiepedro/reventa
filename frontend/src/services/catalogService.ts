import { api } from "./api";

export interface CatalogMake {
  id: string;
  name: string;
  is_custom: boolean;
}

export interface SyncStatus {
  makes: number;
  // El sync sólo trae marcas; estos quedan en cero y existen porque el backend
  // los devuelve. Vuelven a tener sentido con el catálogo de modelos por uso.
  models: number;
  trims: number;
  errors: string[];
  last_run_at: string | null;
  running: boolean;
}

export const catalogService = {
  getMakes: () => api.get<CatalogMake[]>("/catalog/makes"),

  createMake: (name: string) => api.post<CatalogMake>("/catalog/makes", { name }),
  updateMake: (id: string, name: string) => api.put<CatalogMake>(`/catalog/makes/${id}`, { name }),
  deleteMake: (id: string) => api.delete(`/catalog/makes/${id}`),

  triggerSync: () => api.post<{ detail: string }>("/catalog/sync", {}),
  getSyncStatus: () => api.get<SyncStatus>("/catalog/sync/status"),
};
