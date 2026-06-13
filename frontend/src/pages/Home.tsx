import { useCallback, useEffect } from "react";
import { api } from "@/services/api";
import { useApi } from "@/hooks/useApi";

export function Home() {
  const fetcher = useCallback(() => api.get<{ status: string; database: string }>("/health"), []);
  const { data, loading, error, execute } = useApi(fetcher);

  useEffect(() => {
    execute();
  }, [execute]);

  return (
    <div>
      <h1>Reventa</h1>
      {loading && <p>Connecting to API…</p>}
      {error && <p style={{ color: "red" }}>Error: {error.detail}</p>}
      {data && (
        <p style={{ color: "green" }}>
          API {data.status} — DB {data.database}
        </p>
      )}
    </div>
  );
}
