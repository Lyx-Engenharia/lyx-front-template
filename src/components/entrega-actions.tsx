"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { LyxModal } from "@/components/lyx-modal";
import {
  useAceitar,
  useAddAnexo,
  useAddForaEscopo,
  useAddFuncionalidade,
  useAddPendencia,
  useAddVersao,
  useArquivar,
  useHomologar,
  useLiberarHomologacao,
  useResolverPendencia,
} from "@/lib/queries";

const errStyle = { fontSize: "0.72rem", color: "var(--danger)" };

export function LiberarBtn({ id, disabled }: { id: string; disabled?: boolean }) {
  const m = useLiberarHomologacao(id);
  return (
    <button
      className="btn btn-primary"
      onClick={() => m.mutate()}
      disabled={disabled || m.isPending}
    >
      {m.isPending && <Loader2 size={14} className="animate-spin" />}
      Liberar para homologação
    </button>
  );
}

export function ArquivarBtn({ id, disabled }: { id: string; disabled?: boolean }) {
  const m = useArquivar(id);
  return (
    <button
      className="btn btn-secondary"
      onClick={() => m.mutate()}
      disabled={disabled || m.isPending}
    >
      {m.isPending && <Loader2 size={14} className="animate-spin" />}
      Arquivar
    </button>
  );
}

export function HomologarDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [resultado, setResultado] = useState("aprovado");
  const [observacoes, setObservacoes] = useState("");
  const m = useHomologar(id);

  async function submit() {
    await m.mutateAsync({ resultado, observacoes: observacoes || undefined });
    setOpen(false);
    setObservacoes("");
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Homologar
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar homologação"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Validação do setor sobre a entrega.
          </p>
          <div className="form-group">
            <label className="form-label">Resultado</label>
            <select
              className="form-select"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
            >
              <option value="aprovado">Aprovado</option>
              <option value="aprovado_ressalvas">Aprovado com ressalvas</option>
              <option value="reprovado">Reprovado</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Observações</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>
      </LyxModal>
    </>
  );
}

export function AceitarDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const m = useAceitar(id);

  async function submit() {
    await m.mutateAsync({ observacoes: observacoes || undefined });
    setOpen(false);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Aceitar entrega
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Aceite final"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={m.isPending}>
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Confirmar aceite
            </button>
          </>
        }
      >
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>
          Não deve haver pendências abertas.
        </p>
        <div className="form-group">
          <label className="form-label">Observações</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </LyxModal>
    </>
  );
}

export function AddFuncionalidadeDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const m = useAddFuncionalidade(id);

  async function submit() {
    await m.mutateAsync({ titulo, descricao: descricao || undefined });
    setOpen(false);
    setTitulo("");
    setDescricao("");
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Funcionalidade
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova funcionalidade"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!titulo || m.isPending}
            >
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Adicionar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Título</label>
            <input
              className="form-input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>
      </LyxModal>
    </>
  );
}

export function AddForaEscopoDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const m = useAddForaEscopo(id);

  async function submit() {
    await m.mutateAsync({ descricao, justificativa: justificativa || undefined });
    setOpen(false);
    setDescricao("");
    setJustificativa("");
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Fora escopo
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Item fora do escopo"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!descricao || m.isPending}
            >
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Adicionar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Justificativa</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </div>
        </div>
      </LyxModal>
    </>
  );
}

export function AddPendenciaDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const m = useAddPendencia(id);

  async function submit() {
    await m.mutateAsync({ descricao });
    setOpen(false);
    setDescricao("");
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Pendência
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova pendência"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!descricao || m.isPending}
            >
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Criar
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea
            className="form-textarea"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>
      </LyxModal>
    </>
  );
}

export function ResolverPendenciaDialog({
  entregaId,
  pendenciaId,
}: {
  entregaId: string;
  pendenciaId: string;
}) {
  const [open, setOpen] = useState(false);
  const [resolucao, setResolucao] = useState("");
  const [status, setStatus] = useState<"resolvida" | "descartada">("resolvida");
  const m = useResolverPendencia(entregaId, pendenciaId);

  async function submit() {
    await m.mutateAsync({ resolucao, status });
    setOpen(false);
  }

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Resolver
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Resolver pendência"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!resolucao || m.isPending}
            >
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select
              className="form-select"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "resolvida" | "descartada")
              }
            >
              <option value="resolvida">Resolvida</option>
              <option value="descartada">Descartada</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Resolução</label>
            <textarea
              className="form-textarea"
              rows={3}
              value={resolucao}
              onChange={(e) => setResolucao(e.target.value)}
            />
          </div>
        </div>
      </LyxModal>
    </>
  );
}

export function AddAnexoDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("link");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [descricao, setDescricao] = useState("");
  const m = useAddAnexo(id);

  async function submit() {
    await m.mutateAsync({ tipo, titulo, url, descricao: descricao || undefined });
    setOpen(false);
    setTitulo("");
    setUrl("");
    setDescricao("");
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Anexo
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo anexo"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!titulo || !url || m.isPending}
            >
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Adicionar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Tipo</label>
            <select
              className="form-select"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
            >
              <option value="link">Link</option>
              <option value="imagem">Imagem</option>
              <option value="video">Vídeo</option>
              <option value="documento">Documento</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Título</label>
            <input
              className="form-input"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">URL</label>
            <input
              className="form-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        </div>
      </LyxModal>
    </>
  );
}

export function AddVersaoDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [versao, setVersao] = useState("");
  const [alteracoes, setAlteracoes] = useState("");
  const m = useAddVersao(id);

  async function submit() {
    await m.mutateAsync({ versao, alteracoes });
    setOpen(false);
    setVersao("");
    setAlteracoes("");
  }

  return (
    <>
      <button className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        + Versão
      </button>
      <LyxModal
        open={open}
        onClose={() => setOpen(false)}
        title="Nova versão"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={!versao || !alteracoes || m.isPending}
            >
              {m.isPending && <Loader2 size={14} className="animate-spin" />}
              Registrar
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Versão</label>
            <input
              className="form-input"
              value={versao}
              onChange={(e) => setVersao(e.target.value)}
              placeholder="1.1.0"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Alterações</label>
            <textarea
              className="form-textarea"
              rows={4}
              value={alteracoes}
              onChange={(e) => setAlteracoes(e.target.value)}
              placeholder="Changelog dessa versão"
            />
          </div>
        </div>
      </LyxModal>
    </>
  );
}

void errStyle;
