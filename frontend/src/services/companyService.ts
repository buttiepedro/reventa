import { api } from "./api";
import type { Company, CompanyProfile, RadarEntry } from "../types";

export interface CompanyProfileUpdate {
  name?: string;
  phone?: string;
  description?: string;
  address_text?: string;
  lat?: number;
  lng?: number;
}

export interface RadarEntryCreate {
  brand: string;
  model?: string;
  category?: string;
  max_km?: number;
  min_year?: number;
  max_price?: number;
}

export const companyService = {
  list: (): Promise<Company[]> => api.get("/companies"),
  get: (id: string): Promise<Company> => api.get(`/companies/${id}`),

  getMyProfile: (): Promise<CompanyProfile> => api.get("/companies/me/profile"),
  updateMyProfile: (data: CompanyProfileUpdate): Promise<CompanyProfile> =>
    api.patch("/companies/me/profile", data),

  submitCuit: (cuit: string): Promise<void> =>
    api.post("/companies/me/cuit", { cuit }),

  uploadLogo: (file: File): Promise<{ logo_url: string }> => {
    const form = new FormData();
    form.append("file", file);
    return api.postForm("/companies/me/logo", form);
  },

  deleteLogo: (): Promise<void> => api.delete("/companies/me/logo"),

  listRadar: (): Promise<RadarEntry[]> => api.get("/companies/me/radar"),
  createRadarEntry: (data: RadarEntryCreate): Promise<RadarEntry> =>
    api.post("/companies/me/radar", data),
  deleteRadarEntry: (id: string): Promise<void> =>
    api.delete(`/companies/me/radar/${id}`),
};
