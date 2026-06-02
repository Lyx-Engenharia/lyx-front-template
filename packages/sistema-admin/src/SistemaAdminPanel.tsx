import { useApiData } from "./use-data";
import type { Profile, SistemaCatalogEntry } from "./types";
import { roleInfoInSistema } from "./role-label";
import { SistemaUsersManager } from "./users-manager";
import { LYX_ACCENT, mutedStyle } from "./styles";

export interface SistemaAdminPanelProps {
  /** Base URL do monolito (sem barra final). Ex: https://hub.lyxai.com.br */
  apiUrl: string;
  /** Slug do sistema deste front (ex: "contratos", "credito"). */
  sistemaSlug: string;
  accent?: string;
}

/**
 * Painel de gestão de usuários de UM sistema, pro Admin de Sistema. Renderiza
 * apenas se o usuário logado for admin deste sistema (cruza `/me/profile` com
 * `rolesEnriched.isAdmin` do `/sistemas/catalog`); caso contrário não mostra
 * nada. A autorização real é enforced no backend (`/admin/sistemas/:slug/*`).
 * Ver lyx-monolith ADR-0006.
 */
export function SistemaAdminPanel({
  apiUrl,
  sistemaSlug,
  accent = LYX_ACCENT,
}: SistemaAdminPanelProps) {
  const profile = useApiData<Profile>(apiUrl, "/me/profile");
  const catalog = useApiData<SistemaCatalogEntry[]>(apiUrl, "/sistemas/catalog");

  if (profile.loading || catalog.loading) {
    return <p style={mutedStyle()}>Carregando...</p>;
  }

  const sistema = catalog.data?.find((s) => s.slug === sistemaSlug);
  const myRole = profile.data?.memberships.find(
    (m) => m.slug === sistemaSlug,
  )?.role;
  const isAdmin = Boolean(myRole && roleInfoInSistema(sistema, myRole)?.isAdmin);

  if (!sistema || !isAdmin) return null;

  return (
    <SistemaUsersManager apiUrl={apiUrl} sistema={sistema} accent={accent} />
  );
}
