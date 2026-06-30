import { api } from "./api";

export interface ClientRequest {
  id: string;
  company_id: string;
  company_name: string;
  budget_min: number | null;
  budget_max: number;
  payment_method: string;
  category: string | null;
  reference_models: string[] | null;
  status: string;
  expires_at: string;
  created_at: string;
  offer_count: number;
}

export interface ClientRequestCreate {
  budget_max: number;
  budget_min?: number;
  payment_method?: string;
  category?: string;
  reference_models?: string[];
  notes?: string;
}

export interface StockOffer {
  id: string;
  client_request_id: string;
  offering_company_id: string;
  offering_company_name: string;
  vehicle_id: string;
  vehicle_label: string;
  vehicle_price: number;
  message: string | null;
  status: string;
  rank_score: number | null;
  created_at: string;
}

export const lonjaService = {
  listRequests: () => api.get<ClientRequest[]>("/lonja/requests"),
  listMyRequests: () => api.get<ClientRequest[]>("/lonja/my-requests"),
  createRequest: (data: ClientRequestCreate) => api.post<ClientRequest>("/lonja/requests", data),
  cancelRequest: (id: string) => api.delete(`/lonja/requests/${id}`),
  listOffers: (requestId: string) => api.get<StockOffer[]>(`/lonja/requests/${requestId}/offers`),
  submitOffer: (requestId: string, vehicleId: string, message?: string) =>
    api.post<StockOffer>(`/lonja/requests/${requestId}/offers`, { vehicle_id: vehicleId, message }),
  updateOffer: (offerId: string, newStatus: string) =>
    api.patch<StockOffer>(`/lonja/offers/${offerId}?new_status=${newStatus}`, {}),
};
