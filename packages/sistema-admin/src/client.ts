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
