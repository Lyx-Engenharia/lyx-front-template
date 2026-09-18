import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Perfil } from "@/lib/acesso";
import { useSession } from "@/lib/auth-client";
import { ORG_SLUG } from "@/lib/env";
import DashboardLayout from "./layout";

// Borda com o monolito (Better Auth via HTTP): o resto do gate roda de verdade.
vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
  ativarOrgDoSistema: vi.fn(),
  authClient: { signOut: vi.fn() },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

type RetornoDoUseSession = ReturnType<typeof useSession>;

const ORG_DO_SISTEMA = "org-do-sistema";

function sessaoDe(userId: string, orgAtiva: string | null = ORG_DO_SISTEMA) {
  return {
    user: { id: userId, name: "Pessoa Teste", email: `${userId}@lyx.test` },
    session: { id: `s-${userId}`, userId, activeOrganizationId: orgAtiva },
  };
}

function useSessionDevolve(parcial: Partial<RetornoDoUseSession>) {
  vi.mocked(useSession).mockReturnValue({
    data: null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
    ...parcial,
  } as RetornoDoUseSession);
}

function perfilCom(userId: string, slugs: string[]): Perfil {
  return {
    user: { id: userId, email: `${userId}@lyx.test`, name: "Pessoa Teste" },
    isSuperAdmin: false,
    memberships: slugs.map((slug) => ({
      organizationId: slug === ORG_SLUG ? ORG_DO_SISTEMA : `org-${slug}`,
      role: `${slug}_user`,
      slug,
      name: slug,
    })),
  };
}

function renderizar(prepararCache?: (cliente: QueryClient) => void) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  prepararCache?.(cliente);
  return renderToStaticMarkup(
    <QueryClientProvider client={cliente}>
      <DashboardLayout>
        <p>conteudo-da-pagina</p>
      </DashboardLayout>
    </QueryClientProvider>,
  );
}

describe("dashboard/layout", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReset();
  });

  describe("DashboardLayout", () => {
    describe("sessão", () => {
      it("get-session com 5xx mostra erro com tentar de novo, não o carregando do redirect", () => {
        useSessionDevolve({ error: { status: 503 } as RetornoDoUseSession["error"] });

        const html = renderizar();

        expect(html).toContain("Não foi possível verificar seu acesso");
        expect(html).toContain("Tentar de novo");
        expect(html).not.toContain("Carregando...");
        expect(html).not.toContain("conteudo-da-pagina");
      });

      it("falha de rede no get-session (sem status) também vira erro", () => {
        useSessionDevolve({
          error: new TypeError("Failed to fetch") as unknown as RetornoDoUseSession["error"],
        });

        expect(renderizar()).toContain("Não foi possível verificar seu acesso");
      });

      it("401 é sem sessão: segue pro login do Hub, sem tela de erro", () => {
        useSessionDevolve({ error: { status: 401 } as RetornoDoUseSession["error"] });

        const html = renderizar();

        expect(html).toContain("Carregando...");
        expect(html).not.toContain("Não foi possível verificar seu acesso");
      });

      it("refetch da sessão falhou com a sessão anterior em mãos: a página continua", () => {
        useSessionDevolve({
          data: sessaoDe("u1") as RetornoDoUseSession["data"],
          error: { status: 503 } as RetornoDoUseSession["error"],
        });

        const html = renderizar((cliente) =>
          cliente.setQueryData(["me", "profile"], perfilCom("u1", [ORG_SLUG])),
        );

        expect(html).toContain("conteudo-da-pagina");
      });
    });
  });
});
