export type UserRole = "super_admin" | "company_admin" | "company_user";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
  status: number;
}
