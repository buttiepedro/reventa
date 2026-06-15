import { api } from "./api";

export interface CatalogMake {
  id: string;
  name: string;
  is_custom: boolean;
}

export interface CatalogModel {
  id: string;
  make_id: string;
  name: string;
  is_custom: boolean;
}

export interface CatalogTrim {
  id: string;
  model_id: string;
  name: string;
  is_custom: boolean;
}

export interface SyncStatus {
  makes: number;
  models: number;
  trims: number;
  errors: string[];
  last_run_at: string | null;
  running: boolean;
}

export const catalogService = {
  getMakes: () => api.get<CatalogMake[]>("/catalog/makes"),
  getModels: (make_id: string) => api.get<CatalogModel[]>(`/catalog/models?make_id=${make_id}`),
  getTrims: (model_id: string) => api.get<CatalogTrim[]>(`/catalog/trims?model_id=${model_id}`),

  createMake: (name: string) => api.post<CatalogMake>("/catalog/makes", { name }),
  updateMake: (id: string, name: string) => api.put<CatalogMake>(`/catalog/makes/${id}`, { name }),
  deleteMake: (id: string) => api.delete(`/catalog/makes/${id}`),

  createModel: (make_id: string, name: string) => api.post<CatalogModel>("/catalog/models", { make_id, name }),
  updateModel: (id: string, make_id: string, name: string) => api.put<CatalogModel>(`/catalog/models/${id}`, { make_id, name }),
  deleteModel: (id: string) => api.delete(`/catalog/models/${id}`),

  createTrim: (model_id: string, name: string) => api.post<CatalogTrim>("/catalog/trims", { model_id, name }),
  updateTrim: (id: string, model_id: string, name: string) => api.put<CatalogTrim>(`/catalog/trims/${id}`, { model_id, name }),
  deleteTrim: (id: string) => api.delete(`/catalog/trims/${id}`),

  triggerSync: () => api.post<{ detail: string }>("/catalog/sync", {}),
  getSyncStatus: () => api.get<SyncStatus>("/catalog/sync/status"),
};
