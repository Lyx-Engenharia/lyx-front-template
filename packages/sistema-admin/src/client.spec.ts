import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ApiError,
  resetUserPassword,
  softDeleteUser,
  restoreUser,
} from "./client";

function okJson(body: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }));
}

function err(status: number, body: unknown = {}) {
  return vi.fn(async () => ({
    ok: false,
    status,
    text: async () => JSON.stringify(body),
  }));
}

describe("client admin actions", () => {
  beforeEach(() => vi.unstubAllGlobals());

  describe("resetUserPassword", () => {
    it("faz PATCH em /users/:id/password com { password }", async () => {
      const fetchMock = okJson({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const res = await resetUserPassword(
        "http://api",
        "contratos",
        "u9",
        "novaSenha123",
      );

      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe("http://api/admin/sistemas/contratos/users/u9/password");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(String(init.body))).toEqual({ password: "novaSenha123" });
      expect(res).toEqual({ ok: true });
    });

    it("propaga ApiError 403 (alvo é Super Admin)", async () => {
      vi.stubGlobal("fetch", err(403, { message: "forbidden" }));
      await expect(
        resetUserPassword("http://api", "contratos", "u9", "novaSenha123"),
      ).rejects.toMatchObject({ status: 403 });
    });

    it("propaga ApiError 404 (não é membro)", async () => {
      vi.stubGlobal("fetch", err(404, { message: "not found" }));
      const e = await resetUserPassword(
        "http://api",
        "contratos",
        "u9",
        "novaSenha123",
      ).catch((x: unknown) => x);
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
    });
  });

  describe("softDeleteUser", () => {
    it("faz DELETE em /users/:id/account e resolve em 204", async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 204,
        text: async () => "",
      }));
      vi.stubGlobal("fetch", fetchMock);

      const res = await softDeleteUser("http://api", "credito", "u3");

      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe("http://api/admin/sistemas/credito/users/u3/account");
      expect(init.method).toBe("DELETE");
      expect(res).toBeUndefined();
    });
  });

  describe("restoreUser", () => {
    it("faz POST em /users/:id/restore", async () => {
      const fetchMock = okJson({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const res = await restoreUser("http://api", "credito", "u3");

      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe("http://api/admin/sistemas/credito/users/u3/restore");
      expect(init.method).toBe("POST");
      expect(res).toEqual({ ok: true });
    });
  });
});
