export type FuelType = "gasoline" | "diesel" | "electric" | "hybrid" | "gnc";
export type Transmission = "manual" | "automatic";
export type VehicleCondition = "new" | "used";
export type VehicleStatus = "available" | "reserved" | "sold" | "pre_toma";

export interface VehicleImage {
  id: string;
  s3_key: string;
  url: string;
  display_order: number;
  is_primary: boolean;
}

export interface Vehicle {
  id: string;
  company_id: string;
  company_name: string;
  brand: string;
  model: string;
  year: number;
  version: string | null;
  color: string;
  mileage: number;
  fuel_type: FuelType;
  transmission: Transmission;
  condition: VehicleCondition;
  body_type: string | null;
  plate: string | null;
  price_resale: number;
  price_public: number;
  description: string | null;
  status: VehicleStatus;
  share_token: string;
  images: VehicleImage[];
  is_favorite_company: boolean;
  created_at: string;
  updated_at: string;
}

export interface VehicleListItem {
  id: string;
  company_id: string;
  company_name: string;
  brand: string;
  model: string;
  year: number;
  version: string | null;
  color: string;
  mileage: number;
  fuel_type: FuelType;
  transmission: Transmission;
  condition: VehicleCondition;
  price_resale: number;
  price_public: number;
  status: VehicleStatus;
  is_favorite_company: boolean;
  primary_image_url: string | null;
}

export interface VehiclePublic {
  brand: string;
  model: string;
  year: number;
  version: string | null;
  color: string;
  mileage: number;
  fuel_type: FuelType;
  transmission: Transmission;
  condition: VehicleCondition;
  body_type: string | null;
  description: string | null;
  images: VehicleImage[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface VehicleFilters {
  brand?: string;
  model?: string;
  year_min?: number;
  year_max?: number;
  fuel_type?: FuelType;
  transmission?: Transmission;
  condition?: VehicleCondition;
  status?: VehicleStatus;
  company_id?: string;
  page?: number;
  page_size?: number;
}

export interface VehicleCreate {
  brand: string;
  model: string;
  year: number;
  version?: string;
  color: string;
  mileage: number;
  fuel_type: FuelType;
  transmission: Transmission;
  condition: VehicleCondition;
  body_type?: string;
  plate?: string;
  price_resale: number;
  price_public: number;
  description?: string;
  status?: VehicleStatus;
}

export type VehicleUpdate = Partial<VehicleCreate>;

export interface UploadUrlResponse {
  upload_url: string;
  s3_key: string;
}
