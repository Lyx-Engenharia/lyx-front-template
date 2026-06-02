import type { RoleInfo, SistemaCatalogEntry } from "./types";

/**
 * Lookup de role enriquecida (label + description + isAdmin) a partir do
 * catálogo do monolito. Fonte única: o pacote nunca mantém dicionário próprio
 * de label/admin (evita drift). Ver lyx-monolith ADR-0006.
 */
export function roleInfoInSistema(
  sistema: SistemaCatalogEntry | undefined,
  roleName: string,
): RoleInfo | undefined {
  return sistema?.rolesEnriched?.find((r) => r.name === roleName);
}

/** Label humano da role, com fallback pro slug técnico. */
export function roleLabelOf(
  sistema: SistemaCatalogEntry | undefined,
  roleName: string,
): string {
  return roleInfoInSistema(sistema, roleName)?.label ?? roleName;
}

/** Roles que o Admin de Sistema pode atribuir: todas menos as admin. */
export function assignableRoles(
  sistema: SistemaCatalogEntry | undefined,
): RoleInfo[] {
  return (sistema?.rolesEnriched ?? []).filter((r) => !r.isAdmin);
}
