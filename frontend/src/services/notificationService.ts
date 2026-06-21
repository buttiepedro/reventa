import { api } from "./api";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const notificationService = {
  list: () => api.get<AppNotification[]>("/notifications"),

  count: () => api.get<{ unread: number }>("/notifications/count"),

  readAll: () => api.post<void>("/notifications/read-all", {}),

  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`, {}),
};
