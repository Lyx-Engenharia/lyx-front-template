import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChangePasswordCard } from "./ChangePasswordCard";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function submit() {
  fireEvent.click(screen.getByRole("button", { name: /trocar senha/i }));
}

describe("ChangePasswordCard", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("troca chamando /api/auth/change-password com revokeOtherSessions", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "{}",
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ChangePasswordCard apiUrl="http://api" />);
    fill("Senha atual", "atual123");
    fill("Nova senha", "novaSenha123");
    fill("Confirmar nova senha", "novaSenha123");
    submit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/api/auth/change-password");
    expect(JSON.parse(String(init.body))).toEqual({
      currentPassword: "atual123",
      newPassword: "novaSenha123",
      revokeOtherSessions: true,
    });
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("não chama a API quando a confirmação diverge", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ChangePasswordCard apiUrl="http://api" />);
    fill("Senha atual", "atual123");
    fill("Nova senha", "novaSenha123");
    fill("Confirmar nova senha", "diferente9");
    submit();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400 do backend vira 'Senha atual incorreta'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: "Invalid password" }),
      })),
    );
    render(<ChangePasswordCard apiUrl="http://api" />);
    fill("Senha atual", "errada");
    fill("Nova senha", "novaSenha123");
    fill("Confirmar nova senha", "novaSenha123");
    submit();
    expect(await screen.findByText("Senha atual incorreta.")).toBeTruthy();
  });
});
