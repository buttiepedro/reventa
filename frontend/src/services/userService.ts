import { api } from "./api";
import type { User } from "../types";

export interface UserCreate {
  email: string;
  password: string;
  full_name: string;
  role: "company_user" | "company_admin";
}

export const userService = {
  listByCompany: (companyId: string) => api.get<User[]>(`/companies/${companyId}/users`),

  createInCompany: (companyId: string, data: UserCreate) =>
    api.post<User>(`/companies/${companyId}/users`, data),

  setActive: (userId: string, is_active: boolean) =>
    api.put<User>(`/users/${userId}`, { is_active }),

  setRole: (userId: string, role: UserCreate["role"]) =>
    api.put<User>(`/users/${userId}`, { role }),

  remove: (userId: string) => api.delete(`/users/${userId}`),
};
