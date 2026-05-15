"use client";

import { Package2 } from "lucide-react";

// ─── Placeholder dashboard ─────────────────────────────────────
// Substitua pelos KPIs / cards / charts do seu domínio.
// Os números abaixo são fictícios apenas para demonstrar o layout.
// ───────────────────────────────────────────────────────────────

export default function DashboardHome() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
          <div style={{ position: "absolute", right: -32, bottom: -32, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", right: -16, top: -16, width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: "2.5rem", fontWeight: 800, lineHeight: 1 }}>0%</div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>KPI Principal</div>
            <div style={{ fontSize: "0.7rem", opacity: 0.7 }}>Esta semana</div>
          </div>
        </div>

        <MiniStat label="Métrica A" value={0} color="var(--success)" />
        <MiniStat label="Métrica B" value={0} color="var(--warning)" />
        <MiniStat label="Métrica C" value={0} color="var(--accent)" />
      </div>

      <div className="lyx-card">
        <div style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700 }}>Conteúdo do sistema</h3>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
            Substitua este card por gráficos, listagens e widgets do seu domínio.
          </p>
        </div>
        <EmptyState />
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
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

function EmptyState() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "48px 20px" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-card-hover)", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Package2 size={20} />
      </div>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
        Nenhum dado registrado.
      </p>
    </div>
  );
}
