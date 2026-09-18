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
 * Chave do perfil no React Query, por usuário. Sem o id, a conta que entra em
 * outra aba herdava do cache as memberships da anterior e passava pelo gate
 * com elas. Sem id não há perfil a buscar: a query fica desligada.
 */
export function chaveDoPerfil(userId: string | undefined) {
  return ["me", "profile", userId] as const;
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

/**
 * O que importa do `error` do `useSession()`. Resposta HTTP de erro chega com
 * `status`; falha de rede, timeout e CORS chegam como o erro cru do fetch, sem
 * `status` (o `.catch` do `useAuthQuery` do Better Auth).
 */
export type ErroDeSessao = { status?: number } | Error;

/**
 * O `get-session` falhou sem provar que a pessoa está deslogada. Só 401 prova
 * isso; 5xx, timeout, CORS e falha de rede não dizem nada sobre o login.
 * Tratar esses casos como "sem sessão" manda quem está logado pro login do Hub,
 * e em loop se a origin do front faltar no `TRUSTED_ORIGINS` do monolito.
 */
export function sessaoFalhou(erro: ErroDeSessao | null | undefined): boolean {
  if (!erro) return false;
  return !("status" in erro) || erro.status !== 401;
}

export interface EntradaDoAcesso {
  sessaoCarregando: boolean;
  temSessao: boolean;
  /** `sessaoFalhou(useSession().error)`. */
  sessaoComErro: boolean;
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
 * Sem sessão por falha do `get-session` (não 401) também é "erro", nunca
 * "sem-sessao": o login do Hub não resolve servidor fora do ar. Com sessão em
 * mãos o erro é de um refetch (o Better Auth mantém o `data` anterior quando
 * não é 401) e o fluxo segue, porque o perfil ainda confere a membership.
 *
 * Com membership, a org ativa da sessão ainda precisa ser a deste sistema: a
 * pessoa chega do Hub com a org ativa de lá (ou a da membership mais antiga).
 * Até o `setActive` terminar o estado é "ativando-org"; se ele falhar, "erro".
 */
export function estadoDoAcesso(entrada: EntradaDoAcesso): EstadoDoAcesso {
  if (entrada.sessaoCarregando) return "carregando";
  if (!entrada.temSessao) return entrada.sessaoComErro ? "erro" : "sem-sessao";
  if (entrada.perfilComErro) return "erro";
  if (entrada.perfilCarregando) return "carregando";
  if (!entrada.membership) return "sem-acesso";
  if (entrada.orgAtivaId === entrada.membership.organizationId) return "liberado";
  return entrada.ativacaoComErro ? "erro" : "ativando-org";
}

/**
 * Conta que já passou pelo gate neste sistema, ou `null`. "liberado" grava a
 * conta; "carregando" e "ativando-org" (outra aba trocou a org ativa) mantêm;
 * bloqueio e falta de sessão apagam.
 */
export function contaLiberada(
  anterior: string | null,
  estado: EstadoDoAcesso,
  userId: string | undefined,
): string | null {
  if (estado === "liberado") return userId ?? null;
  if (estado === "carregando" || estado === "ativando-org") return anterior;
  return null;
}

/**
 * Se o sistema, com a página aberta, fica montado. Só a primeira ativação da
 * org mostra "Carregando". Quando a conta já estava liberada e outra aba troca
 * a org ativa, o refetch no foco cai em "ativando-org" e a org é reativada em
 * segundo plano, sem desmontar a página (e o formulário que estiver nela).
 */
export function mostraSistema(estado: EstadoDoAcesso, jaLiberado: boolean): boolean {
  return estado === "liberado" || (estado === "ativando-org" && jaLiberado);
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
