"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Building2,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  Search,
  Server,
  Settings,
  Sun,
} from "lucide-react";
import { authClient, useSession } from "@/lib/auth-client";

const navOperacional = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/entregas", label: "Entregas", icon: Package },
  { href: "/dashboard/sistemas", label: "Sistemas", icon: Server },
  { href: "/dashboard/setores", label: "Setores", icon: Building2 },
];

const navAdmin = [
  { href: "/dashboard/config", label: "Configurações", icon: Settings },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
  }, [isPending, session, router]);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as "light" | "dark" | null) ?? null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial: "light" | "dark" = stored ?? (prefersDark ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  if (isPending || !session) {
    return (
      <div className="app-shell" style={{ alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Carregando...</span>
      </div>
    );
  }

  const initials =
    session.user.name
      ?.split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  const firstName = session.user.name?.split(" ")[0] ?? "Admin";

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "22px 18px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius)",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(2, 88, 100, 0.25)",
            }}
          >
            <svg width="26" height="18" viewBox="0 0 20 14" fill="none">
              <rect x="0" y="8" width="4" height="6" rx="1.5" fill="white" opacity="0.7" />
              <rect x="8" y="4" width="4" height="10" rx="1.5" fill="white" opacity="0.85" />
              <rect x="16" y="0" width="4" height="14" rx="1.5" fill="white" />
            </svg>
          </div>
          {!collapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                Lyx<span style={{ color: "var(--accent)" }}>Hub</span>
              </span>
              <span
                style={{
                  fontSize: "0.62rem",
                  color: "var(--text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Entregas de Sistemas
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav
          className="sidebar-nav"
          style={{ padding: "8px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}
        >
          <div className="nav-section-label">{!collapsed ? "Operacional" : "·"}</div>
          {navOperacional.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
                title={collapsed ? item.label : ""}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span className="nav-icon">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          <div className="nav-section-label">{!collapsed ? "Administração" : "·"}</div>
          {navAdmin.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
                title={collapsed ? item.label : ""}
                style={{ display: "flex", alignItems: "center", gap: 12 }}
              >
                <span className="nav-icon">
                  <Icon size={16} strokeWidth={1.75} />
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer" style={{ borderTop: "1px solid var(--border)", padding: 10 }}>
          {!collapsed ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 8px",
                borderRadius: "var(--radius)",
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1, overflow: "hidden", lineHeight: 1.25 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {session.user.name?.split(" ")[0] ?? "Usuário"}
                </div>
                <div
                  style={{
                    fontSize: "0.62rem",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  Admin
                </div>
              </div>
              <button
                onClick={toggleTheme}
                title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  color: "var(--text-muted)",
                  display: "flex",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-primary)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
              >
                {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              </button>
              <button
                onClick={handleSignOut}
                title="Sair"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  color: "var(--text-muted)",
                  display: "flex",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--danger)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                }}
              >
                {initials}
              </div>
              <button
                onClick={handleSignOut}
                title="Sair"
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 6, display: "flex" }}
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Collapse trigger */}
        <button
          className="collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir" : "Recolher"}
          aria-label="Recolher menu"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </aside>

      <main className={`main-content${collapsed ? " collapsed" : ""}`}>
        {/* Topbar */}
        <header className="page-header">
          <div>
            <h1 className="page-title">
              {greeting()}, {firstName}!
            </h1>
            <p className="page-subtitle">Visão geral de Entregas — Hoje</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button className="btn-icon btn-ghost" title="Buscar">
              <Search size={16} />
            </button>
            <button className="btn-icon btn-ghost" title="Notificações" style={{ position: "relative" }}>
              <Bell size={16} />
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: "var(--danger)",
                  color: "#fff",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 4px",
                }}
              >
                0
              </span>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                }}
              >
                {initials}
              </div>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>
                {session.user.name}
              </span>
            </div>
          </div>
        </header>

        <div className="page-body">{children}</div>
      </main>
    </div>
  );
}
