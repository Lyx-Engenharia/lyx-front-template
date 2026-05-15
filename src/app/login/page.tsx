"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

// ─── Personalizar aqui ─────────────────────────────────────────
const BRAND = { prefix: "Meu", suffix: "Sistema", tagline: "Sub-título do sistema" };
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID;
// ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await authClient.signIn.email({ email, password });
    if (signInError) {
      setError(signInError.message ?? "Falha no login");
      setLoading(false);
      return;
    }

    if (ORG_ID) {
      const { error: orgError } = await authClient.organization.setActive({
        organizationId: ORG_ID,
      });
      if (orgError) {
        setError(`Login OK mas erro ao ativar org: ${orgError.message}`);
        setLoading(false);
        return;
      }
    }

    router.push("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "var(--bg-primary)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 32,
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius)",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 16px rgba(2,88,100,0.3)",
            }}
          >
            <svg width="32" height="22" viewBox="0 0 20 14" fill="none">
              <rect x="0" y="8" width="4" height="6" rx="1.5" fill="white" opacity="0.7" />
              <rect x="8" y="4" width="4" height="10" rx="1.5" fill="white" opacity="0.85" />
              <rect x="16" y="0" width="4" height="14" rx="1.5" fill="white" />
            </svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>
              {BRAND.prefix}
              <span style={{ color: "var(--accent)" }}>{BRAND.suffix}</span>
            </h1>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
              {BRAND.tagline}
            </p>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", textAlign: "center" }}>
            Entre com seu usuário corporativo
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="voce@empresa.com"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p style={{ fontSize: "0.8rem", color: "var(--danger)" }}>{error}</p>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%", padding: "12px 18px" }}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
