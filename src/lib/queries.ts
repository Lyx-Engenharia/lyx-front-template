import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";

// ──────────────────────────────────────────────────────────────
// Exemplos genéricos. Substitua por hooks do seu domínio.
// ──────────────────────────────────────────────────────────────

export type Item = {
  id: string;
  nome: string;
  status: string;
  criadoEm: string;
};

export const useItems = () =>
  useQuery({ queryKey: ["items"], queryFn: () => api<Item[]>("/items") });

export const useItem = (id: string) =>
  useQuery({
    queryKey: ["items", id],
    queryFn: () => api<Item>(`/items/${id}`),
    enabled: !!id,
  });

function handleError(e: unknown) {
  const msg =
    e instanceof ApiError
      ? `${e.status}: ${e.message}`
      : e instanceof Error
        ? e.message
        : "Erro";
  toast.error(msg);
}

export function useCriarItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Item>) =>
      api<Item>("/items", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Item criado");
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: handleError,
  });
}

export function useAtualizarItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Item>) =>
      api<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Item atualizado");
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["items", id] });
    },
    onError: handleError,
  });
}

export function useExcluirItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Item excluído");
      qc.invalidateQueries({ queryKey: ["items"] });
    },
    onError: handleError,
  });
}
