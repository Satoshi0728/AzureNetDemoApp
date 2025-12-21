import { useEffect, useMemo, useState } from "react";

const ENDPOINTS_URL = "/api/v1/endpoints";

const normalize = (entries) =>
  Array.isArray(entries)
    ? entries.map((entry) => ({
        name: entry.name ?? "Unnamed endpoint",
        path: entry.path ?? "/",
        method: entry.method ?? "GET",
        category: entry.category ?? "page",
        description: entry.description ?? "",
        statusCode: entry.statusCode ?? 200,
      }))
    : [];

export const useEndpointCatalog = () => {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(ENDPOINTS_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch endpoint catalog: ${response.status}`);
        }
        const payload = await response.json();
        if (isMounted) {
          setEndpoints(normalize(payload));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load endpoints");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const catalog = useMemo(() => endpoints, [endpoints]);

  return { endpoints: catalog, loading, error };
};

export { normalize as normalizeEndpointCatalog };
