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

export interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  cuit: string | null;
  verification_status: string;
  logo_url: string | null;
  description: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  address_text: string | null;
  avg_rating: number | null;
  total_ratings: number;
  created_at: string;
}

export interface RadarEntry {
  id: string;
  brand: string;
  model: string | null;
  category: string | null;
  max_km: number | null;
  min_year: number | null;
  max_price: number | null;
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
