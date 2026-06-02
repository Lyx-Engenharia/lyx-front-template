import { useState } from "react";
import { ApiError, apiFetch, resetUserPassword, softDeleteUser } from "./client";
import { useApiData } from "./use-data";
import type { RoleInfo, SistemaCatalogEntry, SistemaUser } from "./types";
import { assignableRoles, roleLabelOf } from "./role-label";
import {
  cardStyle,
  ghostButtonStyle,
  inputStyle,
  labelStyle,
  mutedStyle,
  primaryButtonStyle,
} from "./styles";

export function SistemaUsersManager({
  apiUrl,
  sistema,
  accent,
}: {
  apiUrl: string;
  sistema: SistemaCatalogEntry;
  accent: string;
}) {
  const slug = sistema.slug;
  const users = useApiData<SistemaUser[]>(
    apiUrl,
    `/admin/sistemas/${slug}/users`,
  );
  const [showCreate, setShowCreate] = useState(false);
  const roles = assignableRoles(sistema);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            {`Usuários do ${sistema.label}`}
          </h2>
          <p style={{ ...mutedStyle(), marginTop: 4 }}>
            Gerencie quem acessa este sistema e o cargo de cada um.
          </p>
        </div>
        <button onClick={() => setShowCreate((v) => !v)} style={primaryButtonStyle(true, accent)}>
          Novo usuário
        </button>
      </div>

      {showCreate && (
        <CreateUserForm
          apiUrl={apiUrl}
          slug={slug}
          roles={roles}
          accent={accent}
          onDone={() => {
            setShowCreate(false);
            users.reload();
          }}
        />
      )}

      <UsersList
        state={users}
        apiUrl={apiUrl}
        slug={slug}
        sistema={sistema}
        roles={roles}
        accent={accent}
      />
    </div>
  );
}

function UsersList({
  state,
  apiUrl,
  slug,
  sistema,
  roles,
  accent,
}: {
  state: ReturnType<typeof useApiData<SistemaUser[]>>;
  apiUrl: string;
  slug: string;
  sistema: SistemaCatalogEntry;
  roles: RoleInfo[];
  accent: string;
}) {
  if (state.loading) return <p style={mutedStyle()}>Carregando...</p>;
  if (state.error)
    return <p style={{ color: "#dc2626", fontSize: 13 }}>{state.error}</p>;
  if (!state.data || state.data.length === 0)
    return <p style={mutedStyle()}>Nenhum usuário neste sistema.</p>;

  return (
    <div style={{ ...cardStyle(), padding: 0, gap: 0 }}>
      {state.data.map((u) => (
        <UserRow
          key={u.userId}
          apiUrl={apiUrl}
          slug={slug}
          user={u}
          sistema={sistema}
          roles={roles}
          accent={accent}
          onChanged={state.reload}
        />
      ))}
    </div>
  );
}

function UserRow({
  apiUrl,
  slug,
  user,
  sistema,
  roles,
  accent,
  onChanged,
}: {
  apiUrl: string;
  slug: string;
  user: SistemaUser;
  sistema: SistemaCatalogEntry;
  roles: RoleInfo[];
  accent: string;
  onChanged: () => void;
}) {
  const role = user.memberships[0]?.role ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
      setBusy(false);
    }
  }

  const changeRole = (newRole: string) =>
    newRole !== role &&
    run(() =>
      apiFetch(apiUrl, `/admin/sistemas/${slug}/users/${user.userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      }),
    );

  const remove = () =>
    run(() =>
      apiFetch(apiUrl, `/admin/sistemas/${slug}/users/${user.userId}`, {
        method: "DELETE",
      }),
    );

  const deactivate = () => {
    const ok = window.confirm(
      `Desativar a conta de ${user.name}? A pessoa perde o acesso ao login e some desta lista. Pode ser revertido depois.`,
    );
    if (ok) run(() => softDeleteUser(apiUrl, slug, user.userId));
  };

  const roleInAssignable = roles.some((r) => r.name === role);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14, borderTop: "1px solid #f1f5f9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</div>
          <div style={mutedStyle()}>{user.email}</div>
          {error && <div style={{ fontSize: 12, color: "#dc2626" }}>{error}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            aria-label={`Cargo de ${user.name}`}
            value={role}
            disabled={busy}
            onChange={(e) => changeRole(e.target.value)}
            style={{ ...inputStyle(), width: "auto" }}
          >
            {!roleInAssignable && (
              <option value={role}>{roleLabelOf(sistema, role)} (admin)</option>
            )}
            {roles.map((r) => (
              <option key={r.name} value={r.name}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setResetting(true)}
            disabled={busy}
            style={ghostButtonStyle()}
          >
            Resetar senha
          </button>
          <button
            onClick={deactivate}
            disabled={busy}
            style={{ ...ghostButtonStyle(), color: "#dc2626", borderColor: "#fca5a5" }}
          >
            Desativar usuário
          </button>
          <button
            onClick={remove}
            disabled={busy}
            style={ghostButtonStyle()}
            title="Tira o usuário deste sistema sem desativar a conta"
          >
            Remover do sistema
          </button>
        </div>
      </div>
      {resetting && (
        <ResetPasswordModal
          apiUrl={apiUrl}
          slug={slug}
          user={user}
          accent={accent}
          onClose={() => setResetting(false)}
        />
      )}
    </div>
  );
}

function ResetPasswordModal({
  apiUrl,
  slug,
  user,
  accent,
  onClose,
}: {
  apiUrl: string;
  slug: string;
  user: SistemaUser;
  accent: string;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("A nova senha precisa de ao menos 8 caracteres.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetUserPassword(apiUrl, slug, user.userId, password);
      setDone(true);
      setPassword("");
    } catch (err) {
      setError(resetErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div style={{ ...cardStyle(), gap: 10 }}>
        <p role="status" style={{ fontSize: 13, color: accent, margin: 0 }}>
          Senha de {user.name} redefinida.
        </p>
        <button onClick={onClose} style={ghostButtonStyle()}>
          Fechar
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ ...cardStyle(), gap: 10 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
        Resetar senha de {user.name}
      </h4>
      <p style={{ ...mutedStyle(), margin: 0 }}>
        Define uma nova senha sem pedir a atual. Repasse para a pessoa por um
        canal seguro.
      </p>
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle()}>Nova senha (min 8)</span>
        <input
          type="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle()}
        />
      </label>
      {error && <p role="alert" style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={busy} style={primaryButtonStyle(!busy, accent)}>
          {busy ? "Salvando..." : "Redefinir senha"}
        </button>
        <button type="button" onClick={onClose} style={ghostButtonStyle()}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function resetErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) {
    return "Não é possível resetar a senha de um Super Admin por aqui.";
  }
  if (err instanceof ApiError && err.status === 404) {
    return "Este usuário não é membro do sistema.";
  }
  return err instanceof Error ? err.message : "Erro ao resetar a senha.";
}

function CreateUserForm({
  apiUrl,
  slug,
  roles,
  accent,
  onDone,
}: {
  apiUrl: string;
  slug: string;
  roles: RoleInfo[];
  accent: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(roles[0]?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<{ userId: string; name: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(apiUrl, `/admin/sistemas/${slug}/users`, {
        method: "POST",
        body: JSON.stringify({ name, email, password, role }),
      });
      onDone();
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as Record<string, unknown>) : undefined;
      if (err instanceof ApiError && err.status === 409 && body?.code === "EMAIL_EXISTS") {
        setExisting({
          userId: String(body.existingUserId),
          name: String(body.existingUserName ?? email),
        });
      } else {
        setError(err instanceof Error ? err.message : "Erro ao criar usuário.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function attach() {
    if (!existing) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(apiUrl, `/admin/sistemas/${slug}/users/attach`, {
        method: "POST",
        body: JSON.stringify({ userId: existing.userId, role }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao anexar usuário.");
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    return (
      <div style={cardStyle()}>
        <p style={{ fontSize: 14, margin: 0 }}>
          Já existe um usuário com o e-mail <strong>{email}</strong> ({existing.name}).
          Anexar a este sistema com o cargo selecionado?
        </p>
        {error && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={attach} disabled={busy} style={primaryButtonStyle(!busy, accent)}>
            {busy ? "Anexando..." : "Anexar usuário"}
          </button>
          <button onClick={() => setExisting(null)} style={ghostButtonStyle()}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={create} style={cardStyle()}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Criar usuário</h3>
      <TextField label="Nome" value={name} onChange={setName} />
      <TextField label="E-mail" value={email} onChange={setEmail} type="email" />
      <TextField label="Senha (min 8)" value={password} onChange={setPassword} type="password" />
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={labelStyle()}>Cargo</span>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle()}>
          {roles.map((r) => (
            <option key={r.name} value={r.name}>
              {r.label}
            </option>
          ))}
        </select>
        {roleInfoDesc(roles, role) && (
          <span style={mutedStyle()}>{roleInfoDesc(roles, role)}</span>
        )}
      </label>
      {error && <p style={{ fontSize: 13, color: "#dc2626", margin: 0 }}>{error}</p>}
      <button type="submit" disabled={busy} style={primaryButtonStyle(!busy, accent)}>
        {busy ? "Criando..." : "Criar"}
      </button>
    </form>
  );
}

function roleInfoDesc(roles: RoleInfo[], name: string): string | undefined {
  return roles.find((r) => r.name === name)?.description;
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={labelStyle()}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle()}
        autoComplete={type === "password" ? "new-password" : "off"}
      />
    </label>
  );
}
