import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./client";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Hook de fetch GET com estado (sem dependência de react-query, pra adoção em
 * qualquer front). `reload()` refaz a requisição (ex: após uma mutação).
 */
export function useApiData<T>(apiUrl: string, path: string): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch<T>(apiUrl, path)
      .then((d) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Erro ao carregar");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [apiUrl, path, nonce]);

  return { data, loading, error, reload };
}
