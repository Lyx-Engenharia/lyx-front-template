import type { CSSProperties } from "react";

/** Teal Lyx — accent default. Consumidores podem sobrescrever via prop `accent`. */
export const LYX_ACCENT = "#0d9488";

export function cardStyle(): CSSProperties {
  return {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 20,
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    color: "#111827",
  };
}

export function inputStyle(): CSSProperties {
  return {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
    color: "#111827",
  };
}

export function primaryButtonStyle(enabled: boolean, accent: string): CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    cursor: enabled ? "pointer" : "not-allowed",
    background: enabled ? accent : "#e5e7eb",
    color: enabled ? "#ffffff" : "#9ca3af",
  };
}

export function ghostButtonStyle(): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    background: "transparent",
    fontSize: 13,
    cursor: "pointer",
    color: "#374151",
  };
}

export function labelStyle(): CSSProperties {
  return { fontSize: 12, fontWeight: 600, color: "#374151" };
}

export function mutedStyle(): CSSProperties {
  return { fontSize: 12, color: "#6b7280" };
}
