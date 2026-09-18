import { api } from "./api";

/** Membership como `GET /me/profile` devolve (`MembershipDto` em `lyx-monolith/src/modules/me/me.service.ts`). */
export interface Membership {
  organizationId: string;
  role: string;
  slug: string;
  name: string;
}

/** Resposta de `GET /me/profile`, só com o que este front usa. */
export interface Perfil {
  user: { id: string; email: string; name: string };
  isSuperAdmin: boolean;
  memberships: Membership[];
}

type Buscador = <T>(path: string) => Promise<T>;

/**
 * Perfil da pessoa logada, com as memberships ATIVAS.
 *
 * `/me/profile` e nunca `authClient.organization.list()`: o plugin do Better
 * Auth não filtra `member.deletedAt`, então acesso desativado a um sistema
 * continuaria aparecendo. O `/me/profile` filtra (`membershipAtiva()` no
 * monolito).
 */
export function buscarPerfil(buscar: Buscador = api): Promise<Perfil> {
  return buscar<Perfil>("/me/profile");
}

/**
 * Membership da pessoa na org deste sistema, ou `null`. Slug vazio = ninguém
 * entra (fail-closed), em vez de casar com qualquer coisa.
 */
export function membershipDoSistema(
  perfil: Perfil | undefined,
  orgSlug: string,
): Membership | null {
  if (!perfil || !orgSlug) return null;
  return perfil.memberships.find((m) => m.slug === orgSlug) ?? null;
}

export type EstadoDoAcesso =
  | "carregando"
  | "sem-sessao"
  | "sem-acesso"
  | "erro"
  | "ativando-org"
  | "liberado";

export interface EntradaDoAcesso {
  sessaoCarregando: boolean;
  temSessao: boolean;
  perfilCarregando: boolean;
  perfilComErro: boolean;
  membership: Membership | null;
  /** `session.activeOrganizationId` da sessão atual. */
  orgAtivaId: string | null | undefined;
  ativacaoComErro: boolean;
}

/**
 * Decide o que o layout mostra. Sessão só prova que a pessoa existe na Lyx
 * (o monolito é identidade única de todos os sistemas); quem dá acesso a ESTE
 * sistema é a membership. Erro ao buscar o perfil não libera: vira "erro".
 *
 * Com membership, a org ativa da sessão ainda precisa ser a deste sistema: a
 * pessoa chega do Hub com a org ativa de lá (ou a da membership mais antiga).
 * Até o `setActive` terminar o estado é "ativando-org"; se ele falhar, "erro".
 */
export function estadoDoAcesso(entrada: EntradaDoAcesso): EstadoDoAcesso {
  if (entrada.sessaoCarregando) return "carregando";
  if (!entrada.temSessao) return "sem-sessao";
  if (entrada.perfilComErro) return "erro";
  if (entrada.perfilCarregando) return "carregando";
  if (!entrada.membership) return "sem-acesso";
  if (entrada.orgAtivaId === entrada.membership.organizationId) return "liberado";
  return entrada.ativacaoComErro ? "erro" : "ativando-org";
}

/**
 * Login é do Hub: este front não tem tela de login, a sessão vem pelo cookie
 * `.lyxai.com.br` (SSO). Depois do login o Hub devolve a pessoa pra
 * `urlAtual`, desde que a origin dela esteja na allowlist do Hub
 * (`lyx-hub-front/src/lib/login-redirect.ts`).
 */
export function urlDeLoginDoHub(hubUrl: string, urlAtual: string): string {
  const url = new URL("/login", hubUrl);
  url.searchParams.set("redirect", urlAtual);
  return url.toString();
}
