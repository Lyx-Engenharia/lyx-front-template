import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";

// ---------- Types ----------
export type Setor = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ativo: boolean;
};

export type Sistema = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  repositorio: string | null;
  ativo: boolean;
};

export type EntregaStatus =
  | "rascunho"
  | "em_homologacao"
  | "aprovado"
  | "aprovado_ressalvas"
  | "reprovado"
  | "aceito"
  | "arquivado";

export type Entrega = {
  id: string;
  codigo: string;
  titulo: string;
  objetivo: string;
  versao: string;
  status: EntregaStatus;
  sistemaId: string;
  setorId: string;
  responsavelTecnicoUserId: string;
  responsavelSetorUserId: string;
  liberadoHomologacaoEm: string | null;
  aceitoEm: string | null;
  criadoEm: string;
};

// ---------- Queries ----------
export const useSetores = () =>
  useQuery({ queryKey: ["setores"], queryFn: () => api<Setor[]>("/setores") });

export const useSistemas = () =>
  useQuery({ queryKey: ["sistemas"], queryFn: () => api<Sistema[]>("/sistemas") });

export const useEntregas = () =>
  useQuery({ queryKey: ["entregas"], queryFn: () => api<Entrega[]>("/entregas") });

export const useEntrega = (id: string) =>
  useQuery({
    queryKey: ["entregas", id],
    queryFn: () => api<unknown>(`/entregas/${id}`),
    enabled: !!id,
  });

// ---------- Mutations helpers ----------
function handleError(e: unknown) {
  const msg =
    e instanceof ApiError ? `${e.status}: ${e.message}` : e instanceof Error ? e.message : "Erro";
  toast.error(msg);
}

// ---------- Entregas ----------
export function useCriarEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) =>
      api<Entrega>("/entregas", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      toast.success(`Entrega ${data.codigo} criada`);
      qc.invalidateQueries({ queryKey: ["entregas"] });
    },
    onError: handleError,
  });
}

export function useLiberarHomologacao(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(`/entregas/${entregaId}/liberar-homologacao`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Liberada para homologação");
      qc.invalidateQueries({ queryKey: ["entregas"] });
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}

export function useHomologar(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { resultado: string; observacoes?: string }) =>
      api(`/entregas/${entregaId}/homologacao`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Homologação registrada");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
      qc.invalidateQueries({ queryKey: ["entregas"] });
    },
    onError: handleError,
  });
}

export function useAceitar(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { observacoes?: string }) =>
      api(`/entregas/${entregaId}/aceite`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Aceite registrado");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
      qc.invalidateQueries({ queryKey: ["entregas"] });
    },
    onError: handleError,
  });
}

export function useArquivar(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(`/entregas/${entregaId}/arquivar`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Entrega arquivada");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
      qc.invalidateQueries({ queryKey: ["entregas"] });
    },
    onError: handleError,
  });
}

// ---------- Itens da entrega ----------
export function useAddFuncionalidade(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { titulo: string; descricao?: string }) =>
      api(`/entregas/${entregaId}/funcionalidades`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Funcionalidade adicionada");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}

export function useAddForaEscopo(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { descricao: string; justificativa?: string }) =>
      api(`/entregas/${entregaId}/fora-escopo`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Item fora do escopo adicionado");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}

export function useAddPendencia(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { descricao: string }) =>
      api(`/entregas/${entregaId}/pendencias`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Pendência criada");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}

export function useResolverPendencia(entregaId: string, pendenciaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { resolucao: string; status?: "resolvida" | "descartada" }) =>
      api(`/entregas/${entregaId}/pendencias/${pendenciaId}/resolver`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Pendência atualizada");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}

export function useAddAnexo(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { tipo: string; titulo: string; url: string; descricao?: string }) =>
      api(`/entregas/${entregaId}/anexos`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Anexo adicionado");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}

export function useAddVersao(entregaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { versao: string; alteracoes: string }) =>
      api(`/entregas/${entregaId}/versoes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast.success("Versão registrada");
      qc.invalidateQueries({ queryKey: ["entregas", entregaId] });
    },
    onError: handleError,
  });
}
