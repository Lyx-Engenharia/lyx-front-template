"use client";

import Link from "next/link";
import { useState } from "react";
import { Package2 } from "lucide-react";
import { useEntregas, useSetores, useSistemas } from "@/lib/queries";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  rascunho: "var(--text-muted)",
  em_homologacao: "var(--warning)",
  aprovado: "var(--success)",
  aprovado_ressalvas: "var(--warning)",
  reprovado: "var(--danger)",
  aceito: "var(--accent)",
  arquivado: "var(--text-secondary)",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  em_homologacao: "Em homologação",
  aprovado: "Aprovado",
  aprovado_ressalvas: "Aprovado c/ ressalvas",
  reprovado: "Reprovado",
  aceito: "Aceito",
  arquivado: "Arquivado",
};

const tooltipStyle = {
  background: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-primary)",
  fontSize: "0.8rem",
};

const PERIODOS = [
  { value: "semana", label: "Esta Semana" },
  { value: "mes", label: "Este Mês" },
  { value: "ano", label: "Este Ano" },
  { value: "tudo", label: "Todo o Período" },
];

function filtraPorPeriodo<T extends { criadoEm: string }>(items: T[], periodo: string): T[] {
  if (periodo === "tudo") return items;
  const agora = new Date();
  const limite = new Date();
  if (periodo === "semana") limite.setDate(agora.getDate() - 7);
  else if (periodo === "mes") limite.setMonth(agora.getMonth() - 1);
  else if (periodo === "ano") limite.setFullYear(agora.getFullYear() - 1);
  return items.filter((i) => new Date(i.criadoEm) >= limite);
}

export default function DashboardHome() {
  const [periodo, setPeriodo] = useState("semana");
  const setores = useSetores();
  const sistemas = useSistemas();
  const entregas = useEntregas();

  const all = entregas.data ?? [];
  const items = filtraPorPeriodo(all, periodo);

  const total = items.length;
  const aceitos = items.filter((e) => e.status === "aceito").length;
  const emHomolog = items.filter((e) => e.status === "em_homologacao").length;
  const consistencia = total > 0 ? Math.round((aceitos / total) * 100) : 0;

  const byStatus = items.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(byStatus).map(([status, value]) => ({
    name: STATUS_LABEL[status] ?? status,
    value,
    fill: STATUS_COLORS[status] ?? "var(--accent)",
  }));

  const byMonth = items.reduce<Record<string, number>>((acc, e) => {
    const m = e.criadoEm.slice(0, 7);
    acc[m] = (acc[m] ?? 0) + 1;
    return acc;
  }, {});

  const timeline = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, total]) => ({ mes, total }));

  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label ?? "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filtro */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
          Visualizar:
        </span>
        <select
          className="form-select"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={{ width: "auto", minWidth: 180 }}
        >
          {PERIODOS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setPeriodo("tudo")}>
          ✕ Limpar Filtros
        </button>
      </div>

      {/* Stats row */}
      <div className="card-grid card-grid-4">
        {/* Card destaque */}
        <div
          className="stat-card"
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -32,
              bottom: -32,
              width: 160,
              height: 160,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: -16,
              top: -16,
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }}
          />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1 }}>{consistencia}%</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Consistência no Período</div>
            <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>{periodoLabel}</div>
          </div>
        </div>

        <MiniStat label="Entregas Aceitas" value={aceitos} total={total} color="var(--success)" />
        <MiniStat label="Em Homologação" value={emHomolog} color="var(--warning)" />
        <MiniStat label="Total Entregas" value={total} color="var(--accent)" />
      </div>

      {/* Charts row */}
      <div className="card-grid card-grid-2">
        <ChartCard title="Distribuição por status" subtitle={periodoLabel}>
          {pieData.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Evolução de entregas"
          subtitle={`Volume mensal · ${periodoLabel}`}
          action={
            <Link href="/dashboard/entregas" style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>
              Ver todas →
            </Link>
          }
        >
          {timeline.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--accent)"
                    fill="var(--accent)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Footer info */}
      <div className="card-grid card-grid-2">
        <FooterStat
          label="Sistemas cadastrados"
          value={sistemas.data?.length ?? 0}
          href="/dashboard/sistemas"
        />
        <FooterStat
          label="Setores atendidos"
          value={setores.data?.length ?? 0}
          href="/dashboard/setores"
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div className="stat-card">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
        <span className="stat-label">{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {pct !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 999, background: "var(--bg-card-hover)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>{title}</h2>
          {subtitle && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function FooterStat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <div className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value" style={{ fontSize: "1.75rem", marginTop: 4 }}>
          {value}
        </div>
      </div>
      <Link href={href} style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>
        Gerenciar →
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, height: 280 }}>
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
        <Package2 size={20} />
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
        Nenhum dado registrado para o período selecionado.
      </p>
    </div>
  );
}
