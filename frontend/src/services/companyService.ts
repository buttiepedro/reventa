import { api } from "./api";
import type { Company, CompanyProfile, RadarEntry } from "../types";

export interface CompanyProfileUpdate {
  name?: string;
  cuit?: string;
  phone?: string;
  description?: string;
  address_text?: string;
  lat?: number;
  lng?: number;
  logo_url?: string;
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

  listRadar: (): Promise<RadarEntry[]> => api.get("/companies/me/radar"),
  createRadarEntry: (data: RadarEntryCreate): Promise<RadarEntry> =>
    api.post("/companies/me/radar", data),
  deleteRadarEntry: (id: string): Promise<void> =>
    api.delete(`/companies/me/radar/${id}`),
};
