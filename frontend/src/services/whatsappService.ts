import { api } from "./api";

export interface LinkCode {
  code: string;
  expires_at: string;
  whatsapp_number: string | null;
}

export interface LinkStatus {
  linked: boolean;
  phone_masked: string | null;
  verified_at: string | null;
  notifications_enabled: boolean;
}

export const whatsappService = {
  getStatus: () => api.get<LinkStatus>("/whatsapp/link"),

  requestCode: () => api.post<LinkCode>("/whatsapp/link", {}),

  revoke: () => api.delete("/whatsapp/link"),

  setNotifications: (enabled: boolean) =>
    api.patch<{ notifications_enabled: boolean }>("/whatsapp/link/notifications", { enabled }),
};
