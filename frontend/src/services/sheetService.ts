import { api } from "./api";

export interface SheetConfig {
  sheet_url: string;
  column_mapping: Record<string, string>;
  has_header_row: boolean;
  last_synced_at: string | null;
}

export interface SheetPreviewResponse {
  columns: string[];
  headers: string[];
  sample_rows: string[][];
}

export interface SyncResult {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export const sheetService = {
  getConfig: () => api.get<SheetConfig | null>("/sheet/config"),
  saveConfig: (data: Omit<SheetConfig, "last_synced_at">) =>
    api.put<SheetConfig>("/sheet/config", data),
  preview: (url: string, has_header_row: boolean) =>
    api.post<SheetPreviewResponse>("/sheet/preview", { url, has_header_row }),
  sync: () => api.post<SyncResult>("/sheet/sync", {}),
};
