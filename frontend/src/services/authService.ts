import { api } from "./api";
import type { TokenResponse, User } from "@/types";

export const authService = {
  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }),

  me: () => api.get<User>("/auth/me"),
};
