import { useState } from "react";
import { ApiError, apiFetch } from "./client";
import {
  cardStyle,
  inputStyle,
  labelStyle,
  mutedStyle,
  primaryButtonStyle,
  LYX_ACCENT,
} from "./styles";

const MIN_LEN = 8;

type Status =
  | { type: "idle" }
  | { type: "saving" }
  | { type: "ok"; msg: string }
  | { type: "error"; msg: string };

export interface ChangePasswordCardProps {
  /** Base URL do monolito (ex: https://hub.lyxai.com.br/api... sem o /api). */
  apiUrl: string;
  accent?: string;
}

/**
 * Troca de senha self-service (qualquer usuário, em qualquer front de sistema).
 * Exige a senha atual e revoga as OUTRAS sessões (mantém a atual). Chama o
 * endpoint nativo do Better Auth `POST /api/auth/change-password`. Ver
 * lyx-monolith ADR-0006.
 */
export function ChangePasswordCard({
  apiUrl,
  accent = LYX_ACCENT,
}: ChangePasswordCardProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle" });

  const saving = status.type === "saving";
  const canSubmit =
    current.length > 0 && next.length > 0 && confirm.length > 0 && !saving;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < MIN_LEN) {
      setStatus({
        type: "error",
        msg: `A nova senha precisa de ao menos ${MIN_LEN} caracteres.`,
      });
      return;
    }
    if (next !== confirm) {
      setStatus({ type: "error", msg: "A confirmação não bate com a nova senha." });
      return;
    }
    setStatus({ type: "saving" });
    try {
      await apiFetch(apiUrl, "/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        }),
      });
      setStatus({
        type: "ok",
        msg: "Senha alterada. Suas outras sessões foram desconectadas.",
      });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 400
          ? "Senha atual incorreta."
          : err instanceof Error
            ? err.message
            : "Não foi possível trocar a senha.";
      setStatus({ type: "error", msg });
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ ...cardStyle(), maxWidth: 420 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Trocar minha senha</h3>
        <p style={{ ...mutedStyle(), marginTop: 4 }}>
          Pede a senha atual e desconecta seus outros dispositivos.
        </p>
      </div>
      <PwdField label="Senha atual" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PwdField label="Nova senha" value={next} onChange={setNext} autoComplete="new-password" />
      <PwdField label="Confirmar nova senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />

      {status.type === "error" && (
        <p role="alert" style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{status.msg}</p>
      )}
      {status.type === "ok" && (
        <p role="status" style={{ fontSize: 13, color: accent, margin: 0 }}>{status.msg}</p>
      )}

      <button type="submit" disabled={!canSubmit} style={{ ...primaryButtonStyle(canSubmit, accent), alignSelf: "flex-start" }}>
        {saving ? "Salvando..." : "Trocar senha"}
      </button>
    </form>
  );
}

function PwdField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={labelStyle()}>{label}</span>
      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle()}
      />
    </label>
  );
}
