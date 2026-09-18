import { describe, it, expect } from "vitest";
import {
  buscarPerfil,
  chaveDoPerfil,
  contaLiberada,
  estadoDoAcesso,
  membershipDoSistema,
  mostraSistema,
  sessaoDoSistema,
  sessaoFalhou,
  urlDeLoginDoHub,
  type EntradaDoAcesso,
  type EstadoDoAcesso,
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

  describe("contaLiberada", () => {
    it("liberado grava a conta", () => {
      expect(contaLiberada(null, "liberado", "u1")).toBe("u1");
    });

    it("ativando-org e carregando mantêm a conta já liberada", () => {
      expect(contaLiberada("u1", "ativando-org", "u1")).toBe("u1");
      expect(contaLiberada("u1", "carregando", "u1")).toBe("u1");
    });

    it("bloqueio ou falta de sessão apagam a conta liberada", () => {
      expect(contaLiberada("u1", "erro", "u1")).toBeNull();
      expect(contaLiberada("u1", "sem-acesso", "u1")).toBeNull();
      expect(contaLiberada("u1", "sem-sessao", undefined)).toBeNull();
    });

    it("sessão sumida num refresh (em voo ou falha que não é 401) mantém a conta", () => {
      expect(contaLiberada("u1", "carregando", undefined)).toBe("u1");
      expect(contaLiberada("u1", "erro", undefined)).toBe("u1");
    });

    it("outra conta na sessão apaga a conta liberada", () => {
      expect(contaLiberada("u1", "carregando", "u2")).toBeNull();
      expect(contaLiberada("u1", "ativando-org", "u2")).toBeNull();
    });
  });

  describe("sessaoDoSistema", () => {
    const sessaoDe = (id: string) => ({ user: { id } });

    it("com a sessão em mãos, é ela", () => {
      const atual = sessaoDe("u1");
      expect(sessaoDoSistema(atual, sessaoDe("u1"), "u1")).toBe(atual);
    });

    it("sessão sumida num refresh: a última vista, da conta liberada", () => {
      const ultima = sessaoDe("u1");
      expect(sessaoDoSistema(null, ultima, "u1")).toBe(ultima);
    });

    it("última sessão vista de outra conta: nenhuma", () => {
      expect(sessaoDoSistema(null, sessaoDe("u2"), "u1")).toBeNull();
    });

    it("sem conta liberada: nenhuma", () => {
      expect(sessaoDoSistema(null, sessaoDe("u1"), null)).toBeNull();
    });
  });

  describe("mostraSistema", () => {
    it("liberado monta o sistema", () => {
      expect(mostraSistema("liberado", null, "u1")).toBe(true);
    });

    it("primeira ativação da org não monta: mostra carregando", () => {
      expect(mostraSistema("ativando-org", null, "u1")).toBe(false);
    });

    it("reativação com a conta já liberada mantém o sistema montado", () => {
      expect(mostraSistema("ativando-org", "u1", "u1")).toBe(true);
    });

    it("sessão sumida num refresh (em voo ou falha que não é 401) mantém a conta liberada montada", () => {
      expect(mostraSistema("carregando", "u1", undefined)).toBe(true);
      expect(mostraSistema("erro", "u1", undefined)).toBe(true);
    });

    it("erro do perfil ou da ativação, sem-acesso e 401 não montam, mesmo já liberado", () => {
      expect(mostraSistema("erro", "u1", "u1")).toBe(false);
      expect(mostraSistema("sem-acesso", "u1", "u1")).toBe(false);
      expect(mostraSistema("sem-sessao", "u1", undefined)).toBe(false);
    });

    it("outra conta na sessão não monta com a liberação da anterior", () => {
      expect(mostraSistema("carregando", "u1", "u2")).toBe(false);
      expect(mostraSistema("ativando-org", "u1", "u2")).toBe(false);
    });

    it("sessão sumida sem conta liberada não monta", () => {
      expect(mostraSistema("carregando", null, undefined)).toBe(false);
      expect(mostraSistema("erro", null, undefined)).toBe(false);
    });

    // O que o gate do layout faz a cada render: guarda a conta liberada e decide.
    // `userId` undefined é a sessão sumida (refresh em voo, falha ou 401).
    function montadoARender(passos: [EstadoDoAcesso, string | undefined][]): boolean[] {
      let liberada: string | null = null;
      return passos.map(([estado, userId]) => {
        liberada = contaLiberada(liberada, estado, userId);
        return mostraSistema(estado, liberada, userId);
      });
    }

    it("outra aba troca a org: a página não desmonta enquanto a org é reativada", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["ativando-org", "u1"],
          ["liberado", "u1"],
        ]),
      ).toEqual([true, true, true]);
    });

    it("chegando do Hub: carregando até a primeira ativação terminar", () => {
      expect(
        montadoARender([
          ["carregando", "u1"],
          ["ativando-org", "u1"],
          ["liberado", "u1"],
        ]),
      ).toEqual([false, false, true]);
    });

    it("outra conta entra em outra aba: não herda a liberação da anterior", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["carregando", "u2"],
          ["ativando-org", "u2"],
        ]),
      ).toEqual([true, false, false]);
    });

    it("refresh da sessão com 5xx ou 403 no foco: a página não desmonta até a sessão voltar", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["erro", undefined], // fetchSessionWithRefresh gravou data null
          ["carregando", undefined], // refetch em voo, sem data
          ["liberado", "u1"],
        ]),
      ).toEqual([true, true, true, true]);
    });

    it("refresh que segue falhando: a página continua montada", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["erro", undefined],
          ["carregando", undefined],
          ["erro", undefined],
        ]),
      ).toEqual([true, true, true, true]);
    });

    it("sessão volta da mesma conta com o perfil recarregando: a página continua", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["erro", undefined],
          ["carregando", "u1"],
          ["liberado", "u1"],
        ]),
      ).toEqual([true, true, true, true]);
    });

    it("refresh que vira 401: desmonta e segue pro login do Hub", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["erro", undefined],
          ["carregando", undefined],
          ["sem-sessao", undefined],
        ]),
      ).toEqual([true, true, true, false]);
    });

    it("sessão volta sem membership: desmonta", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["erro", undefined],
          ["sem-acesso", "u1"],
        ]),
      ).toEqual([true, true, false]);
    });

    it("sessão volta com outra conta: não herda a liberação da anterior", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["erro", undefined],
          ["carregando", "u2"],
          ["ativando-org", "u2"],
        ]),
      ).toEqual([true, true, false, false]);
    });

    it("outra conta apareceu e a sessão sumiu: a anterior não volta a montar", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["carregando", "u2"],
          ["erro", undefined],
        ]),
      ).toEqual([true, false, false]);
    });

    it("get-session falhando na primeira entrada: nada monta, fica a tela de erro", () => {
      expect(
        montadoARender([
          ["carregando", undefined],
          ["erro", undefined],
        ]),
      ).toEqual([false, false]);
    });

    it("reativação que falhou e tentar de novo: volta a ser primeira ativação", () => {
      expect(
        montadoARender([
          ["liberado", "u1"],
          ["ativando-org", "u1"],
          ["erro", "u1"],
          ["ativando-org", "u1"],
        ]),
      ).toEqual([true, true, false, false]);
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
