/** Erro de API com status HTTP + body parseado (quando JSON). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Fetch contra o monolito com cookie cross-subdomain (`credentials: include`).
 * Lança `ApiError` em status não-2xx, preservando `code`/`existingUserId` do
 * payload (ex: fluxo 409 EMAIL_EXISTS). Retorna `undefined` em 204.
 */
export async function apiFetch<T>(
  apiUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const resp = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) {
    let body: unknown;
    let text = "";
    try {
      text = await resp.text();
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = undefined;
    }
    const message =
      (body as { message?: string } | undefined)?.message ||
      text ||
      `HTTP ${resp.status}`;
    throw new ApiError(resp.status, message, body);
  }
  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}

/**
 * Reset de senha de OUTRO usuário pelo Admin de Sistema (sem senha atual).
 * `PATCH /admin/sistemas/:slug/users/:userId/password`. Backend retorna 403 se
 * o alvo for Super Admin e 404 se não for membro do sistema. Ver ADR-0007.
 */
export function resetUserPassword(
  apiUrl: string,
  slug: string,
  userId: string,
  password: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(
    apiUrl,
    `/admin/sistemas/${slug}/users/${userId}/password`,
    { method: "PATCH", body: JSON.stringify({ password }) },
  );
}

/**
 * Soft-delete (desativa) a conta de OUTRO usuário: bloqueia login e some da
 * lista. Distinto da remoção de membership (`DELETE .../users/:userId`).
 * `DELETE /admin/sistemas/:slug/users/:userId/account` → 204. Ver ADR-0007.
 */
export function softDeleteUser(
  apiUrl: string,
  slug: string,
  userId: string,
): Promise<void> {
  return apiFetch<void>(
    apiUrl,
    `/admin/sistemas/${slug}/users/${userId}/account`,
    { method: "DELETE" },
  );
}

/**
 * Restaura uma conta soft-deleted (reverte o `softDeleteUser`).
 * `POST /admin/sistemas/:slug/users/:userId/restore`. A lista só mostra users
 * ativos (backend filtra deletados), então normalmente não há de onde acionar
 * isso pela UI; exposto pra completude da API. Ver ADR-0007.
 */
export function restoreUser(
  apiUrl: string,
  slug: string,
  userId: string,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(
    apiUrl,
    `/admin/sistemas/${slug}/users/${userId}/restore`,
    { method: "POST" },
  );
}
