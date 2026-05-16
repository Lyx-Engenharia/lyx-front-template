"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";

// ─── Personalizar aqui ─────────────────────────────────────────
const BRAND = {
  prefix: "Meu",
  suffix: "Sistema",
  tagline: "Sub-título do sistema",
  hero: "Hub de sistemas inteligentes",
};
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID;
// ───────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="relative flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Left - Branding */}
      <div
        className="relative hidden w-[55%] flex-col justify-between overflow-hidden p-14 lg:flex"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full blur-[120px]"
            style={{ background: "var(--accent-glow)" }}
          />
          <div
            className="absolute -bottom-40 -right-20 h-[400px] w-[400px] rounded-full blur-[100px]"
            style={{ background: "var(--accent-light)" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
            style={{ background: "var(--accent-light)" }}
          />

          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />

          <div
            className="absolute -right-20 top-1/4 h-px w-[600px] rotate-[30deg]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, var(--accent-glow), transparent)",
            }}
          />
          <div
            className="absolute -left-10 bottom-1/3 h-px w-[500px] rotate-[30deg]"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, var(--accent-light), transparent)",
            }}
          />
        </div>

        <div className="relative">
          <Image src="/lyx-logo.png" alt="LYX" width={120} height={120} priority />
        </div>

        <div className="relative">
          <h2
            className="text-5xl font-bold leading-[1.15] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {BRAND.prefix}
            <span style={{ color: "var(--accent)" }}>{BRAND.suffix}</span>
            <br />
            <span style={{ color: "var(--accent)" }}>{BRAND.hero}</span>
          </h2>

          <div className="mt-12 flex gap-8">
            <Stat value="Sistemas" label="Integrados" />
            <Divider />
            <Stat value="Times" label="Produtivos" />
            <Divider />
            <Stat value="Real" suffix="time" label="Atualizações ao vivo" />
          </div>
        </div>

        <p className="relative text-xs" style={{ color: "var(--text-muted)" }}>
          &copy; {new Date().getFullYear()} LYX. Todos os direitos reservados.
        </p>
      </div>

      {/* Right - Form */}
      <div className="flex w-full items-center justify-center px-6 lg:w-[45%]">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden">
            <Image src="/lyx-logo.png" alt="LYX" width={80} height={80} priority />
          </div>

          <div
            className="rounded-2xl p-8 sm:p-10"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div className="mb-8">
              <h1
                className="text-2xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Bem-vindo de volta
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
                {BRAND.tagline} — acesse sua conta
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  E-mail
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                    <Mail className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="voce@empresa.com"
                    className="w-full rounded-xl py-3 pl-11 pr-4 text-sm transition-all duration-200 focus:outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Senha
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2">
                    <Lock className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-xl py-3 pl-11 pr-11 text-sm transition-all duration-200 focus:outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
                  style={{
                    background: "color-mix(in oklch, var(--danger) 10%, transparent)",
                    border: "1px solid color-mix(in oklch, var(--danger) 30%, transparent)",
                    color: "var(--danger)",
                  }}
                >
                  <div
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: "var(--danger)" }}
                  />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative mt-2 w-full overflow-hidden rounded-xl px-4 py-3.5 text-sm font-semibold transition-all duration-300 hover:brightness-110 disabled:opacity-50"
                style={{
                  background: "var(--accent)",
                  color: "#ffffff",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                {loading ? (
                  <span className="relative inline-flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Entrando...
                  </span>
                ) : (
                  <span className="relative inline-flex items-center justify-center gap-2">
                    Entrar
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                )}
              </button>
            </form>
          </div>

          <p
            className="mt-8 text-center text-xs lg:hidden"
            style={{ color: "var(--text-muted)" }}
          >
            &copy; {new Date().getFullYear()} LYX. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, suffix, label }: { value: string; suffix?: string; label: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        {suffix && (
          <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            {suffix}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-12 w-px" style={{ background: "var(--border)" }} />;
}
