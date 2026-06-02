import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SistemaUsersManager } from "./users-manager";
import type { SistemaCatalogEntry, SistemaUser } from "./types";

const sistema: SistemaCatalogEntry = {
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
};

const maria: SistemaUser = {
  userId: "u2",
  email: "maria@x",
  name: "Maria",
  memberships: [
    { memberId: "m1", organizationId: "o1", orgSlug: "contratos", role: "contratos_auditor" },
  ],
};

/** Roteia por substring; `password`/`account`/`restore` antes do GET genérico. */
function routedFetch(
  overrides: Record<string, { status?: number; body?: unknown }> = {},
) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const key = Object.keys(overrides).find((k) => u.includes(k));
    if (key) {
      const r = overrides[key]!;
      const status = r.status ?? 200;
      return {
        ok: status < 400,
        status,
        json: async () => r.body ?? {},
        text: async () => JSON.stringify(r.body ?? {}),
      };
    }
    // GET da lista
    if (method === "GET" && u.includes("/admin/sistemas/contratos/users")) {
      return {
        ok: true,
        status: 200,
        json: async () => [maria],
        text: async () => JSON.stringify([maria]),
      };
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => "{}" };
  });
}

function render_() {
  return render(
    <SistemaUsersManager apiUrl="http://api" sistema={sistema} accent="#0d9488" />,
  );
}

describe("SistemaUsersManager admin actions", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.restoreAllMocks());

  it("renderiza os botões de ação por usuário", async () => {
    vi.stubGlobal("fetch", routedFetch());
    render_();
    expect(await screen.findByText("Maria")).toBeTruthy();
    expect(screen.getByRole("button", { name: /resetar senha/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /desativar usuário/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /remover do sistema/i })).toBeTruthy();
  });

  it("resetar senha: PATCH em /users/:id/password com { password }", async () => {
    const fetchMock = routedFetch({
      "/users/u2/password": { body: { ok: true } },
    });
    vi.stubGlobal("fetch", fetchMock);
    render_();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByRole("button", { name: /resetar senha/i }));
    fireEvent.change(screen.getByLabelText(/nova senha/i), {
      target: { value: "novaSenha123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u]) =>
        String(u).includes("/users/u2/password"),
      );
      expect(call).toBeTruthy();
    });
    const call = fetchMock.mock.calls.find(([u]) =>
      String(u).includes("/users/u2/password"),
    )!;
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("http://api/admin/sistemas/contratos/users/u2/password");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ password: "novaSenha123" });
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("resetar senha: bloqueia local quando a senha tem menos de 8 chars", async () => {
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    render_();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByRole("button", { name: /resetar senha/i }));
    fireEvent.change(screen.getByLabelText(/nova senha/i), {
      target: { value: "curta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes("/password")),
    ).toBe(false);
  });

  it("resetar senha: 403 vira mensagem amigável de Super Admin", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({ "/users/u2/password": { status: 403, body: { message: "x" } } }),
    );
    render_();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByRole("button", { name: /resetar senha/i }));
    fireEvent.change(screen.getByLabelText(/nova senha/i), {
      target: { value: "novaSenha123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(await screen.findByText(/super admin/i)).toBeTruthy();
  });

  it("resetar senha: 404 vira mensagem amigável de não-membro", async () => {
    vi.stubGlobal(
      "fetch",
      routedFetch({ "/users/u2/password": { status: 404, body: { message: "x" } } }),
    );
    render_();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByRole("button", { name: /resetar senha/i }));
    fireEvent.change(screen.getByLabelText(/nova senha/i), {
      target: { value: "novaSenha123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));

    expect(await screen.findByText(/não é membro/i)).toBeTruthy();
  });

  it("desativar usuário: confirma, faz DELETE em /account e recarrega a lista", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = routedFetch({
      "/users/u2/account": { status: 204 },
    });
    vi.stubGlobal("fetch", fetchMock);
    render_();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByRole("button", { name: /desativar usuário/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([u]) => String(u).includes("/users/u2/account")),
      ).toBe(true);
    });
    const call = fetchMock.mock.calls.find(([u]) =>
      String(u).includes("/users/u2/account"),
    )!;
    const [url, init] = call as [string, RequestInit];
    expect(url).toBe("http://api/admin/sistemas/contratos/users/u2/account");
    expect(init.method).toBe("DELETE");
    // recarregou a lista (>= 1 GET após o DELETE)
    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter(
        ([u, i]) =>
          (i as RequestInit | undefined)?.method == null &&
          String(u).includes("/admin/sistemas/contratos/users") &&
          !String(u).includes("/account"),
      );
      expect(getCalls.length).toBeGreaterThanOrEqual(2);
    });
    expect(confirmSpy).toHaveBeenCalled();
  });

  it("desativar usuário: cancelar no confirm não chama a API", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchMock = routedFetch();
    vi.stubGlobal("fetch", fetchMock);
    render_();
    await screen.findByText("Maria");

    fireEvent.click(screen.getByRole("button", { name: /desativar usuário/i }));

    expect(
      fetchMock.mock.calls.some(([u]) => String(u).includes("/account")),
    ).toBe(false);
  });
});
