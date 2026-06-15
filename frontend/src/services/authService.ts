import { api } from "./api";
import type { TokenResponse, User } from "@/types";

export const authService = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }),

  me: () => api.get<User>("/auth/me"),

  changePassword: (current_password: string, new_password: string) =>
    api.put<void>("/auth/password", { current_password, new_password }),
};
