import { describe, it, expect } from "vitest";
import { roleLabelOf, assignableRoles, roleInfoInSistema } from "./role-label";
import type { SistemaCatalogEntry } from "./types";

const sistema = {
  slug: "contratos",
  label: "Contratos",
  descricao: "",
  subdomain: "",
  iconKey: "",
  roles: ["contratos_auditor", "contratos_admin"],
  rolesEnriched: [
    { name: "contratos_auditor", label: "Auditor de Contratos", description: "x", isAdmin: false },
    { name: "contratos_admin", label: "Admin do Contratos", description: "y", isAdmin: true },
  ],
} as SistemaCatalogEntry;

describe("role-label", () => {
  it("roleLabelOf retorna o label humano", () => {
    expect(roleLabelOf(sistema, "contratos_auditor")).toBe("Auditor de Contratos");
  });

  it("roleLabelOf cai no slug quando não encontra", () => {
    expect(roleLabelOf(sistema, "inexistente")).toBe("inexistente");
  });

  it("assignableRoles exclui as roles admin", () => {
    expect(assignableRoles(sistema).map((r) => r.name)).toEqual([
      "contratos_auditor",
    ]);
  });

  it("roleInfoInSistema acha a role pelo nome", () => {
    expect(roleInfoInSistema(sistema, "contratos_admin")?.isAdmin).toBe(true);
  });
});
