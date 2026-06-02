/** Role enriquecida do `/sistemas/catalog` do monolito (fonte única). */
export interface RoleInfo {
  name: string;
  label: string;
  description?: string;
  isAdmin: boolean;
}

export interface SistemaCatalogEntry {
  slug: string;
  label: string;
  descricao: string;
  subdomain: string;
  iconKey: string;
  roles: string[];
  rolesEnriched?: RoleInfo[];
  organizationId?: string | null;
}

export interface Membership {
  organizationId: string;
  role: string;
  slug: string;
  name: string;
}

/** Resposta de `GET /me/profile`. */
export interface Profile {
  user: { id: string; email: string; name: string };
  isSuperAdmin: boolean;
  memberships: Membership[];
}

/** Item de `GET /admin/sistemas/:slug/users` (agregado; 1 membership na org). */
export interface SistemaUser {
  userId: string;
  email: string;
  name: string;
  memberships: Array<{
    memberId: string;
    organizationId: string;
    orgSlug: string;
    role: string;
  }>;
}
