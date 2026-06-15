import { api } from "./api";
import type {
  PaginatedResponse,
  UploadUrlResponse,
  Vehicle,
  VehicleCreate,
  VehicleFilters,
  VehicleImage,
  VehicleListItem,
  VehiclePublic,
  VehicleStatus,
  VehicleUpdate,
} from "../types/vehicle";
import type { Company } from "../types";

function buildQuery(filters: VehicleFilters): string {
  const params = new URLSearchParams();
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.model) params.set("model", filters.model);
  if (filters.year_min) params.set("year_min", String(filters.year_min));
  if (filters.year_max) params.set("year_max", String(filters.year_max));
  if (filters.fuel_type) params.set("fuel_type", filters.fuel_type);
  if (filters.transmission) params.set("transmission", filters.transmission);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.status) params.set("status", filters.status);
  if (filters.company_id) params.set("company_id", filters.company_id);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.page_size) params.set("page_size", String(filters.page_size));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const vehicleService = {
  listNetwork: (filters: VehicleFilters = {}): Promise<PaginatedResponse<VehicleListItem>> =>
    api.get(`/vehicles${buildQuery(filters)}`),

  listMy: (): Promise<VehicleListItem[]> => api.get("/vehicles/my"),

  get: (id: string): Promise<Vehicle> => api.get(`/vehicles/${id}`),

  create: (data: VehicleCreate): Promise<Vehicle> => api.post("/vehicles", data),

  update: (id: string, data: VehicleUpdate): Promise<Vehicle> => api.put(`/vehicles/${id}`, data),

  updateStatus: (id: string, status: VehicleStatus): Promise<Vehicle> =>
    api.patch(`/vehicles/${id}/status`, { status }),

  delete: (id: string): Promise<void> => api.delete(`/vehicles/${id}`),

  getUploadUrl: (vehicleId: string, filename: string, contentType: string): Promise<UploadUrlResponse> =>
    api.post(`/vehicles/${vehicleId}/images/upload-url?filename=${encodeURIComponent(filename)}&content_type=${encodeURIComponent(contentType)}`, {}),

  registerImage: (vehicleId: string, s3Key: string, displayOrder: number, isPrimary: boolean): Promise<VehicleImage> =>
    api.post(`/vehicles/${vehicleId}/images`, { s3_key: s3Key, display_order: displayOrder, is_primary: isPrimary }),

  deleteImage: (vehicleId: string, imageId: string): Promise<void> =>
    api.delete(`/vehicles/${vehicleId}/images/${imageId}`),

  setPrimaryImage: (vehicleId: string, imageId: string): Promise<VehicleImage> =>
    api.patch(`/vehicles/${vehicleId}/images/${imageId}/primary`, {}),

  getPublic: (shareToken: string): Promise<VehiclePublic> =>
    api.get(`/share/${shareToken}`),

  listFavorites: (): Promise<Company[]> => api.get("/favorites"),

  addFavorite: (companyId: string): Promise<void> => api.post(`/favorites/${companyId}`, {}),

  removeFavorite: (companyId: string): Promise<void> => api.delete(`/favorites/${companyId}`),

  uploadImage: async (vehicleId: string, file: File, displayOrder: number, isPrimary: boolean): Promise<VehicleImage> => {
    const token = localStorage.getItem("access_token");
    const BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
    const form = new FormData();
    form.append("file", file);
    const resp = await fetch(
      `${BASE_URL}/vehicles/${vehicleId}/images/upload?display_order=${displayOrder}&is_primary=${isPrimary}`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }
    );
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: "Upload failed" }));
      throw { detail: err.detail ?? "Upload failed", status: resp.status };
    }
    return resp.json();
  },

  uploadToS3: async (uploadUrl: string, file: File): Promise<void> => {
    const resp = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!resp.ok) throw new Error("S3 upload failed");
  },
};
