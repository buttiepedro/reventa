import { api } from "./api";
import type { Company } from "../types";

export const companyService = {
  list: (): Promise<Company[]> => api.get("/companies"),
  get: (id: string): Promise<Company> => api.get(`/companies/${id}`),
};
