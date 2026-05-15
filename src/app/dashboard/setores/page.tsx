"use client";

import { Building2 } from "lucide-react";
import { useSetores } from "@/lib/queries";

export default function SetoresPage() {
  const { data: items = [], error, isLoading } = useSetores();

  if (error)
    return <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error.message}</p>;

  return (
    <div className="card-grid card-grid-3">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="lyx-card" style={{ height: 96 }} />
          ))
        : items.map((s) => (
            <div
              key={s.id}
              className="lyx-card"
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
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
                <Building2 size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {s.nome}
                  </span>
                  <span
                    className={`lyx-badge ${s.ativo ? "success" : "gray"}`}
                    style={{ marginLeft: "auto" }}
                  >
                    {s.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  {s.slug}
                </div>
                {s.descricao && (
                  <p style={{ marginTop: 6, fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {s.descricao}
                  </p>
                )}
              </div>
            </div>
          ))}
    </div>
  );
}
