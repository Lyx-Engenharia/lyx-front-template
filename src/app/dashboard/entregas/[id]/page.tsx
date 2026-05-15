"use client";

import { use } from "react";
import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { useEntrega } from "@/lib/queries";
import {
  AceitarDialog,
  AddAnexoDialog,
  AddForaEscopoDialog,
  AddFuncionalidadeDialog,
  AddPendenciaDialog,
  AddVersaoDialog,
  ArquivarBtn,
  HomologarDialog,
  LiberarBtn,
  ResolverPendenciaDialog,
} from "@/components/entrega-actions";

type EntregaCompleta = {
  id: string;
  codigo: string;
  titulo: string;
  objetivo: string;
  versao: string;
  status: string;
  liberadoHomologacaoEm: string | null;
  aceitoEm: string | null;
  criadoEm: string;
  funcionalidades: { id: string; titulo: string; descricao: string | null }[];
  foraEscopo: { id: string; descricao: string; justificativa: string | null }[];
  pendencias: {
    id: string;
    descricao: string;
    status: string;
    resolucao: string | null;
    criadoEm: string;
  }[];
  anexos: { id: string; tipo: string; titulo: string; url: string }[];
  homologacoes: {
    id: string;
    resultado: string;
    observacoes: string | null;
    homologadoEm: string;
  }[];
  aceite: { aceitoEm: string; observacoes: string | null } | null;
  versoes: {
    id: string;
    versao: string;
    alteracoes: string;
    criadoEm: string;
  }[];
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "gray" },
  em_homologacao: { label: "Em homologação", cls: "warning" },
  aprovado: { label: "Aprovado", cls: "success" },
  aprovado_ressalvas: { label: "Aprovado c/ ressalvas", cls: "warning" },
  reprovado: { label: "Reprovado", cls: "danger" },
  aceito: { label: "Aceito", cls: "accent" },
  arquivado: { label: "Arquivado", cls: "gray" },
};

function fmtDate(d: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lyx-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{children}</p>
  );
}

export default function EntregaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error } = useEntrega(id);
  const entrega = data as EntregaCompleta | undefined;

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link
          href="/dashboard/entregas"
          style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
        >
          ← Voltar
        </Link>
        <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error.message}</p>
      </div>
    );
  }

  if (!entrega) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="lyx-card" style={{ height: 72 }} />
        <div className="lyx-card" style={{ height: 200 }} />
      </div>
    );
  }

  const badge = STATUS_BADGE[entrega.status] ?? { label: entrega.status, cls: "gray" };
  const podeEditar = entrega.status === "rascunho";
  const podeLiberar = entrega.status === "rascunho";
  const podeHomologar = entrega.status === "em_homologacao";
  const podeAceitar =
    entrega.status === "aprovado" || entrega.status === "aprovado_ressalvas";
  const podeArquivar = entrega.status === "aceito";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/dashboard/entregas" className="btn btn-ghost btn-sm">
          <ArrowLeft size={14} />
          Entregas
        </Link>
        <a
          href={`${API_URL}/entregas/${entrega.id}/termo`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          <FileText size={14} />
          Ver Termo
        </a>
      </div>

      {/* Header card */}
      <div className="lyx-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                marginBottom: 6,
              }}
            >
              <span>{entrega.codigo}</span>
              <span>·</span>
              <span>v{entrega.versao}</span>
            </div>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)" }}>
              {entrega.titulo}
            </h2>
            <p
              style={{
                marginTop: 8,
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              {entrega.objetivo}
            </p>
          </div>
          <span className={`lyx-badge ${badge.cls}`}>{badge.label}</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            padding: "16px 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--text-muted)" }}>
              Criado em
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", marginTop: 4 }}>
              {fmtDate(entrega.criadoEm)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--text-muted)" }}>
              Liberado homologação
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", marginTop: 4 }}>
              {fmtDate(entrega.liberadoHomologacaoEm)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "var(--text-muted)" }}>
              Aceito em
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", marginTop: 4 }}>
              {fmtDate(entrega.aceitoEm)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {podeLiberar && <LiberarBtn id={entrega.id} />}
          {podeHomologar && <HomologarDialog id={entrega.id} />}
          {podeAceitar && <AceitarDialog id={entrega.id} />}
          {podeArquivar && <ArquivarBtn id={entrega.id} />}
        </div>
      </div>

      {/* Funcionalidades */}
      <SectionCard
        title="Funcionalidades entregues"
        action={podeEditar && <AddFuncionalidadeDialog id={entrega.id} />}
      >
        {entrega.funcionalidades.length === 0 ? (
          <EmptyText>Nenhuma funcionalidade cadastrada.</EmptyText>
        ) : (
          <table className="lyx-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {entrega.funcionalidades.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.titulo}</td>
                  <td style={{ color: "var(--text-muted)" }}>{f.descricao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Fora escopo */}
      <SectionCard
        title="Itens fora do escopo"
        action={podeEditar && <AddForaEscopoDialog id={entrega.id} />}
      >
        {entrega.foraEscopo.length === 0 ? (
          <EmptyText>Nenhum item registrado.</EmptyText>
        ) : (
          <table className="lyx-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Justificativa</th>
              </tr>
            </thead>
            <tbody>
              {entrega.foraEscopo.map((f) => (
                <tr key={f.id}>
                  <td>{f.descricao}</td>
                  <td style={{ color: "var(--text-muted)" }}>
                    {f.justificativa ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Pendências */}
      <SectionCard
        title="Pendências"
        action={<AddPendenciaDialog id={entrega.id} />}
      >
        {entrega.pendencias.length === 0 ? (
          <EmptyText>Sem pendências.</EmptyText>
        ) : (
          <table className="lyx-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Descrição</th>
                <th>Resolução</th>
                <th style={{ width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {entrega.pendencias.map((p) => {
                const cls =
                  p.status === "resolvida"
                    ? "success"
                    : p.status === "aberta"
                      ? "danger"
                      : "gray";
                return (
                  <tr key={p.id}>
                    <td>
                      <span className={`lyx-badge ${cls}`}>{p.status}</span>
                    </td>
                    <td>{p.descricao}</td>
                    <td style={{ color: "var(--text-muted)" }}>
                      {p.resolucao ?? "—"}
                    </td>
                    <td>
                      {p.status === "aberta" && (
                        <ResolverPendenciaDialog
                          entregaId={entrega.id}
                          pendenciaId={p.id}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Anexos */}
      <SectionCard title="Anexos" action={<AddAnexoDialog id={entrega.id} />}>
        {entrega.anexos.length === 0 ? (
          <EmptyText>Sem anexos.</EmptyText>
        ) : (
          <table className="lyx-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Título</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {entrega.anexos.map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="lyx-badge gray">{a.tipo}</span>
                  </td>
                  <td>{a.titulo}</td>
                  <td>
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}
                    >
                      Abrir ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      {/* Versões */}
      <SectionCard
        title="Histórico de versões"
        action={<AddVersaoDialog id={entrega.id} />}
      >
        {entrega.versoes.length === 0 ? (
          <EmptyText>Sem versões registradas.</EmptyText>
        ) : (
          <table className="lyx-table">
            <thead>
              <tr>
                <th>Versão</th>
                <th>Data</th>
                <th>Alterações</th>
              </tr>
            </thead>
            <tbody>
              {entrega.versoes.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    v{v.versao}
                  </td>
                  <td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {fmtDate(v.criadoEm)}
                  </td>
                  <td>{v.alteracoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>

      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
        ID: {entrega.id}
      </div>
    </div>
  );
}
