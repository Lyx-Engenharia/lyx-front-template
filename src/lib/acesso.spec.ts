import { describe, it, expect } from "vitest";
import {
  buscarPerfil,
  chaveDoPerfil,
  estadoDoAcesso,
  membershipDoSistema,
  sessaoFalhou,
  urlDeLoginDoHub,
  type EntradaDoAcesso,
  type Membership,
  type Perfil,
} from "./acesso";

const membershipDe = (slug: string, organizationId = `org-${slug}`): Membership => ({
  organizationId,
  role: `${slug}_user`,
  slug,
  name: slug,
});

const perfilCom = (...memberships: Membership[]): Perfil => ({
  user: { id: "u1", email: "pessoa@lyx.test", name: "Pessoa" },
  isSuperAdmin: false,
  memberships,
});

const liberada: EntradaDoAcesso = {
  sessaoCarregando: false,
  temSessao: true,
  sessaoComErro: false,
  perfilCarregando: false,
  perfilComErro: false,
  membership: membershipDe("meu-sistema"),
  orgAtivaId: "org-meu-sistema",
  ativacaoComErro: false,
};

describe("acesso", () => {
  describe("buscarPerfil", () => {
    it("pede /me/profile ao monolito e devolve o perfil", async () => {
      const perfil = perfilCom(membershipDe("meu-sistema"));
      const pedidos: string[] = [];
      const buscar = async <T,>(path: string) => {
        pedidos.push(path);
        return perfil as T;
      };

      await expect(buscarPerfil(buscar)).resolves.toBe(perfil);
      expect(pedidos).toEqual(["/me/profile"]);
    });
  });

  describe("chaveDoPerfil", () => {
    it("contas diferentes não dividem o perfil no cache", () => {
      expect(chaveDoPerfil("u1")).not.toEqual(chaveDoPerfil("u2"));
    });

    it("leva o id da conta na chave de /me/profile", () => {
      expect(chaveDoPerfil("u1")).toEqual(["me", "profile", "u1"]);
    });
  });

  describe("membershipDoSistema", () => {
    it("devolve a membership cujo slug casa com o do sistema", () => {
      const doSistema = membershipDe("meu-sistema");
      const perfil = perfilCom(membershipDe("bi"), doSistema);
      expect(membershipDoSistema(perfil, "meu-sistema")).toBe(doSistema);
    });

    it("devolve null quando a pessoa só é membro de outros sistemas", () => {
      const perfil = perfilCom(membershipDe("bi"), membershipDe("credito"));
      expect(membershipDoSistema(perfil, "meu-sistema")).toBeNull();
    });

    it("devolve null quando o perfil ainda não chegou", () => {
      expect(membershipDoSistema(undefined, "meu-sistema")).toBeNull();
    });

    it("devolve null com slug vazio, mesmo que exista membership sem slug", () => {
      const perfil = perfilCom(membershipDe(""));
      expect(membershipDoSistema(perfil, "")).toBeNull();
    });
  });

  describe("sessaoFalhou", () => {
    it("sem erro: não falhou", () => {
      expect(sessaoFalhou(null)).toBe(false);
    });

    it("401 prova que não há sessão: não é falha", () => {
      expect(sessaoFalhou({ status: 401 })).toBe(false);
    });

    it("5xx do get-session é falha", () => {
      expect(sessaoFalhou({ status: 503 })).toBe(true);
    });

    it("falha de rede, timeout ou CORS chega sem status e é falha", () => {
      expect(sessaoFalhou(new TypeError("Failed to fetch"))).toBe(true);
    });
  });

  describe("estadoDoAcesso", () => {
    it("fica carregando enquanto a sessão não resolveu", () => {
      expect(estadoDoAcesso({ ...liberada, sessaoCarregando: true, temSessao: false })).toBe(
        "carregando",
      );
    });

    it("sem sessão resolvida não pede perfil: sem-sessao", () => {
      expect(estadoDoAcesso({ ...liberada, temSessao: false, perfilCarregando: true })).toBe(
        "sem-sessao",
      );
    });

    it("get-session falhou sem ser 401: erro, nunca manda pro login do Hub", () => {
      expect(estadoDoAcesso({ ...liberada, temSessao: false, sessaoComErro: true })).toBe("erro");
    });

    it("refetch da sessão falhou com a sessão anterior em mãos: segue o fluxo", () => {
      expect(estadoDoAcesso({ ...liberada, sessaoComErro: true })).toBe("liberado");
    });

    it("fica carregando enquanto o perfil não chegou", () => {
      expect(estadoDoAcesso({ ...liberada, perfilCarregando: true, membership: null })).toBe(
        "carregando",
      );
    });

    it("erro no perfil não libera: vira erro", () => {
      expect(estadoDoAcesso({ ...liberada, perfilComErro: true })).toBe("erro");
    });

    it("sessão válida sem membership no sistema: sem-acesso", () => {
      expect(estadoDoAcesso({ ...liberada, membership: null })).toBe("sem-acesso");
    });

    it("sessão válida com membership e org ativa deste sistema: liberado", () => {
      expect(estadoDoAcesso(liberada)).toBe("liberado");
    });

    it("chegando do Hub com outra org ativa: ativando-org", () => {
      expect(estadoDoAcesso({ ...liberada, orgAtivaId: "org-hub" })).toBe("ativando-org");
    });

    it("sessão sem org ativa nenhuma: ativando-org", () => {
      expect(estadoDoAcesso({ ...liberada, orgAtivaId: null })).toBe("ativando-org");
    });

    it("setActive falhou: erro, nunca libera com a org errada", () => {
      expect(
        estadoDoAcesso({ ...liberada, orgAtivaId: "org-hub", ativacaoComErro: true }),
      ).toBe("erro");
    });

    it("sem membership não tenta ativar org: sem-acesso", () => {
      expect(estadoDoAcesso({ ...liberada, membership: null, orgAtivaId: "org-hub" })).toBe(
        "sem-acesso",
      );
    });
  });

  describe("urlDeLoginDoHub", () => {
    it("aponta pro /login do Hub com a URL atual em ?redirect=", () => {
      expect(
        urlDeLoginDoHub("https://hub.lyxai.com.br", "https://meu.lyxai.com.br/dashboard?aba=2"),
      ).toBe(
        "https://hub.lyxai.com.br/login?redirect=https%3A%2F%2Fmeu.lyxai.com.br%2Fdashboard%3Faba%3D2",
      );
    });

    it("barra final na URL do Hub não duplica a barra", () => {
      expect(urlDeLoginDoHub("http://localhost:3002/", "http://localhost:3001/dashboard")).toBe(
        "http://localhost:3002/login?redirect=http%3A%2F%2Flocalhost%3A3001%2Fdashboard",
      );
    });
  });
});
