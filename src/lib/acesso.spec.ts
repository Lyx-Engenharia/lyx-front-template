import { describe, it, expect } from "vitest";
import {
  buscarPerfil,
  estadoDoAcesso,
  membershipDoSistema,
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
  perfilCarregando: false,
  perfilComErro: false,
  membership: membershipDe("meu-sistema"),
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

    it("sessão válida com membership no sistema: liberado", () => {
      expect(estadoDoAcesso(liberada)).toBe("liberado");
    });
  });
});
