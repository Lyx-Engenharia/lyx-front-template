import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SistemaAdminPanel } from "./SistemaAdminPanel";

type Route = { status?: number; body: unknown };

function routedFetch(map: Record<string, Route>) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    const hit = Object.entries(map).find(([k]) => u.includes(k));
    const r: Route = hit ? hit[1] : { status: 404, body: {} };
    const status = r.status ?? 200;
    return {
      ok: status < 400,
      status,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body),
    };
  });
}

const catalog = [
  {
    slug: "contratos",
    label: "Contratos",
    descricao: "",
    subdomain: "",
    iconKey: "",
    roles: ["contratos_auditor", "contratos_admin"],
    rolesEnriched: [
      { name: "contratos_auditor", label: "Auditor de Contratos", isAdmin: false },
      { name: "contratos_admin", label: "Admin do Contratos", isAdmin: true },
    ],
  },
];

const adminProfile = {
  user: { id: "u1", email: "admin@x", name: "Admin" },
  isSuperAdmin: false,
  memberships: [
    { organizationId: "o1", role: "contratos_admin", slug: "contratos", name: "Contratos" },
  ],
};

describe("SistemaAdminPanel", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("renderiza o painel + lista de users quando o user é Admin de Sistema", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({
        "/me/profile": { body: adminProfile },
        "/sistemas/catalog": { body: catalog },
        "/admin/sistemas/contratos/users": {
          body: [
            {
              userId: "u2",
              email: "maria@x",
              name: "Maria",
              memberships: [
                { memberId: "m1", organizationId: "o1", orgSlug: "contratos", role: "contratos_auditor" },
              ],
            },
          ],
        },
      }),
    );
    render(<SistemaAdminPanel apiUrl="http://api" sistemaSlug="contratos" />);
    expect(await screen.findByText("Usuários do Contratos")).toBeTruthy();
    expect(await screen.findByText("Maria")).toBeTruthy();
  });

  it("não renderiza nada quando o user NÃO é admin do sistema", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({
        "/me/profile": {
          body: {
            ...adminProfile,
            memberships: [
              { organizationId: "o1", role: "contratos_auditor", slug: "contratos", name: "Contratos" },
            ],
          },
        },
        "/sistemas/catalog": { body: catalog },
      }),
    );
    const { container } = render(
      <SistemaAdminPanel apiUrl="http://api" sistemaSlug="contratos" />,
    );
    await waitFor(() =>
      expect(container.textContent).not.toContain("Carregando"),
    );
    expect(screen.queryByText("Usuários do Contratos")).toBeNull();
  });
});
