import { api } from "./api";
import type { Company } from "../types";

export interface FavoriteRequest {
  requester_id: string;
  requester_name: string;
  created_at: string;
}

export const favoriteService = {
  getConfirmed: () => api.get<Company[]>("/favorites"),

  getIncomingRequests: () => api.get<FavoriteRequest[]>("/favorites/requests/incoming"),

  getOutgoingRequests: () => api.get<FavoriteRequest[]>("/favorites/requests/outgoing"),

  sendRequest: (companyId: string) => api.post(`/favorites/${companyId}`, {}),

  acceptRequest: (companyId: string) => api.post(`/favorites/${companyId}/accept`, {}),

  remove: (companyId: string) => api.delete(`/favorites/${companyId}`),
};
