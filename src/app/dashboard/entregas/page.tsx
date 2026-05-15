"use client";

import Link from "next/link";
import { Package, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useEntregas } from "@/lib/queries";

type EntregaStatus =
  | "rascunho"
  | "em_homologacao"
  | "aprovado"
  | "aprovado_ressalvas"
  | "reprovado"
  | "aceito"
  | "arquivado";

const STATUS_BADGE: Record<EntregaStatus, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "gray" },
  em_homologacao: { label: "Em homologação", cls: "warning" },
  aprovado: { label: "Aprovado", cls: "success" },
  aprovado_ressalvas: { label: "Aprovado c/ ressalvas", cls: "warning" },
  reprovado: { label: "Reprovado", cls: "danger" },
  aceito: { label: "Aceito", cls: "accent" },
  arquivado: { label: "Arquivado", cls: "gray" },
};

export default function EntregasPage() {
  const { data: items = [], error, isLoading } = useEntregas();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  const filtrados = items.filter((e) => {
    if (filtroStatus !== "todos" && e.status !== filtroStatus) return false;
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      e.codigo.toLowerCase().includes(q) ||
      e.titulo.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 12, maxWidth: 720 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              size={16}
              style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
            />
            <input
              type="text"
              className="form-input"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código ou título..."
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            className="form-select"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            style={{ width: "auto", minWidth: 180 }}
          >
            <option value="todos">Todos os status</option>
            {(Object.keys(STATUS_BADGE) as EntregaStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_BADGE[s].label}</option>
            ))}
          </select>
        </div>
        <Link href="/dashboard/entregas/nova" className="btn btn-primary">
          <Plus size={16} />
          Nova entrega
        </Link>
      </div>

      {error && <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error.message}</p>}

      {/* Mini stats */}
      <div className="card-grid card-grid-4">
        <MiniStat label="Total" value={items.length} color="var(--accent)" />
        <MiniStat
          label="Em homologação"
          value={items.filter((e) => e.status === "em_homologacao").length}
          color="var(--warning)"
        />
        <MiniStat
          label="Aceitos"
          value={items.filter((e) => e.status === "aceito").length}
          color="var(--success)"
        />
        <MiniStat
          label="Reprovados"
          value={items.filter((e) => e.status === "reprovado").length}
          color="var(--danger)"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="lyx-card" style={{ height: 72 }} />
          <div className="lyx-card" style={{ height: 72 }} />
          <div className="lyx-card" style={{ height: 72 }} />
        </div>
      ) : filtrados.length === 0 ? (
        <div
          className="lyx-card"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 48, textAlign: "center" }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--bg-card-hover)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Package size={20} />
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            {items.length === 0
              ? "Nenhuma entrega cadastrada ainda."
              : "Nenhuma entrega encontrada com esses filtros."}
          </p>
          {items.length === 0 && (
            <Link href="/dashboard/entregas/nova" className="btn btn-primary btn-sm">
              <Plus size={14} />
              Criar primeira entrega
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtrados.map((e) => {
            const badge = STATUS_BADGE[e.status as EntregaStatus] ?? { label: e.status, cls: "gray" };
            return (
              <Link
                key={e.id}
                href={`/dashboard/entregas/${e.id}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  className="lyx-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 20px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "var(--radius)",
                        background: "var(--bg-card-hover)",
                        color: "var(--text-muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Package size={16} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: "var(--text-muted)",
                          }}
                        >
                          {e.codigo}
                        </span>
                        <span style={{ color: "var(--text-muted)" }}>·</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-secondary)" }}>
                          v{e.versao}
                        </span>
                      </div>
                      <div style={{ marginTop: 2, fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {e.titulo}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        Criada em {new Date(e.criadoEm).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                  </div>
                  <span className={`lyx-badge ${badge.cls}`}>{badge.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
