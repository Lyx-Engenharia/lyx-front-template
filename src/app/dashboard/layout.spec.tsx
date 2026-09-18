import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { chaveDoPerfil, type Perfil } from "@/lib/acesso";
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

function retornoDoUseSession(parcial: Partial<RetornoDoUseSession>): RetornoDoUseSession {
  return {
    data: null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
    ...parcial,
  } as RetornoDoUseSession;
}

function useSessionDevolve(parcial: Partial<RetornoDoUseSession>) {
  vi.mocked(useSession).mockReturnValue(retornoDoUseSession(parcial));
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

/**
 * Página já liberada pra u1 e, nos renders seguintes, a sessão como o refresh
 * a deixou. O gate grava a conta liberada durante o render e o React renderiza
 * de novo na hora, relendo o `useSession`: o primeiro render vê u1 liberada, os
 * seguintes veem `depois`.
 */
function renderizarLiberadaEDepois(depois: Partial<RetornoDoUseSession>) {
  vi.mocked(useSession)
    .mockReturnValue(retornoDoUseSession(depois))
    .mockReturnValueOnce(
      retornoDoUseSession({ data: sessaoDe("u1") as RetornoDoUseSession["data"] }),
    );
  return renderizar((cliente) =>
    cliente.setQueryData(chaveDoPerfil("u1"), perfilCom("u1", [ORG_SLUG])),
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
          cliente.setQueryData(chaveDoPerfil("u1"), perfilCom("u1", [ORG_SLUG])),
        );

        expect(html).toContain("conteudo-da-pagina");
      });
    });

    describe("refresh da sessão com a página liberada", () => {
      it("get-session do refresh com 5xx apaga a sessão: a página segue montada", () => {
        const html = renderizarLiberadaEDepois({
          error: { status: 503 } as RetornoDoUseSession["error"],
        });

        expect(html).toContain("conteudo-da-pagina");
        expect(html).not.toContain("Não foi possível verificar seu acesso");
      });

      it("403 do get-session (origin fora do TRUSTED_ORIGINS): a página segue montada", () => {
        const html = renderizarLiberadaEDepois({
          error: { status: 403 } as RetornoDoUseSession["error"],
        });

        expect(html).toContain("conteudo-da-pagina");
      });

      it("refetch em voo sem a sessão: a página segue montada, sem tela de carregando", () => {
        const html = renderizarLiberadaEDepois({ isPending: true });

        expect(html).toContain("conteudo-da-pagina");
        expect(html).not.toContain("Carregando...");
      });

      it("refresh com 401: a página desmonta e segue pro login do Hub", () => {
        const html = renderizarLiberadaEDepois({
          error: { status: 401 } as RetornoDoUseSession["error"],
        });

        expect(html).toContain("Carregando...");
        expect(html).not.toContain("conteudo-da-pagina");
      });

      it("sessão volta com outra conta: a página da anterior desmonta", () => {
        const html = renderizarLiberadaEDepois({
          data: sessaoDe("u2") as RetornoDoUseSession["data"],
        });

        expect(html).toContain("Carregando...");
        expect(html).not.toContain("conteudo-da-pagina");
      });
    });

    describe("perfil", () => {
      it("perfil da própria conta com membership libera a página", () => {
        useSessionDevolve({ data: sessaoDe("u-novo") as RetornoDoUseSession["data"] });

        const html = renderizar((cliente) =>
          cliente.setQueryData(chaveDoPerfil("u-novo"), perfilCom("u-novo", [ORG_SLUG])),
        );

        expect(html).toContain("conteudo-da-pagina");
      });

      it("conta trocada em outra aba não herda do cache as memberships da anterior", () => {
        useSessionDevolve({ data: sessaoDe("u-novo") as RetornoDoUseSession["data"] });

        const html = renderizar((cliente) =>
          cliente.setQueryData(chaveDoPerfil("u-antigo"), perfilCom("u-antigo", [ORG_SLUG])),
        );

        expect(html).toContain("Carregando...");
        expect(html).not.toContain("conteudo-da-pagina");
      });
    });

    describe("org ativa", () => {
      it("chegando do Hub com a org de lá: carregando até a primeira ativação", () => {
        useSessionDevolve({ data: sessaoDe("u1", "org-hub") as RetornoDoUseSession["data"] });

        const html = renderizar((cliente) =>
          cliente.setQueryData(chaveDoPerfil("u1"), perfilCom("u1", [ORG_SLUG])),
        );

        expect(html).toContain("Carregando...");
        expect(html).not.toContain("conteudo-da-pagina");
      });
    });
  });
});
