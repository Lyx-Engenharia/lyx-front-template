import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { ORG_SLUG } from "./env";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  plugins: [organizationClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/**
 * Ativa na sessão a org deste sistema, pelo slug (o Better Auth resolve o id).
 * Enquanto o monolito decidir permissão pela org ativa, rota protegida só
 * responde depois disto; sem isso a org ativa fica na membership mais antiga
 * da pessoa e ela toma 403 aqui.
 */
export function ativarOrgDoSistema() {
  return authClient.organization.setActive({ organizationSlug: ORG_SLUG });
}
