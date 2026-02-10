"use client";

import { useState, useEffect, useCallback } from "react";

type User = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  disabled: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt?: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [disabledFilter, setDisabledFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | "reset" | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "user" as "admin" | "user",
    disabled: false,
  });

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (disabledFilter) params.set("disabled", disabledFilter);
    const res = await fetch("/api/admin/users?" + params);
    if (!res.ok) {
      setError("Failed to load users");
      return;
    }
    const data = await res.json();
    setUsers(data);
  }, [search, roleFilter, disabledFilter]);

  useEffect(() => {
    setLoading(true);
    fetchUsers().finally(() => setLoading(false));
  }, [fetchUsers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username,
        displayName: form.displayName,
        password: form.password,
        role: form.role,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to create user");
      return;
    }
    setModal(null);
    setForm({ username: "", displayName: "", password: "", role: "user", disabled: false });
    fetchUsers();
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError("");
    const res = await fetch("/api/admin/users/" + selected.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: form.displayName,
        role: form.role,
        disabled: form.disabled,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to update");
      return;
    }
    setModal(null);
    setSelected(null);
    fetchUsers();
  }

  async function handleResetPassword() {
    if (!selected) return;
    const newPassword = form.password || "TempPass123!";
    const res = await fetch("/api/admin/users/" + selected.id + "/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to reset password");
      return;
    }
    setModal(null);
    setSelected(null);
    setForm({ ...form, password: "" });
  }

  async function handleDelete(u: User) {
    if (!confirm("Delete user " + u.username + "?")) return;
    const res = await fetch("/api/admin/users/" + u.id, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Failed to delete");
      return;
    }
    fetchUsers();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4">
        <input
          type="text"
          placeholder="Search username"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <select
          value={disabledFilter}
          onChange={(e) => setDisabledFilter(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="">All</option>
          <option value="true">Disabled</option>
          <option value="false">Enabled</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setModal("create");
            setForm({ username: "", displayName: "", password: "", role: "user", disabled: false });
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create user
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Username</th>
                <th className="border p-2 text-left">Display name</th>
                <th className="border p-2 text-left">Role</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border">
                  <td className="border p-2">{u.username}</td>
                  <td className="border p-2">{u.displayName}</td>
                  <td className="border p-2">{u.role}</td>
                  <td className="border p-2">
                    {u.disabled ? (
                      <span className="text-red-600">Disabled</span>
                    ) : (
                      <span className="text-green-600">Enabled</span>
                    )}
                    {u.mustChangePassword && " (must change PW)"}
                  </td>
                  <td className="border p-2 flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(u);
                        setForm({
                          username: u.username,
                          displayName: u.displayName,
                          password: "",
                          role: u.role as "admin" | "user",
                          disabled: u.disabled,
                        });
                        setModal("edit");
                      }}
                      className="text-blue-600 hover:underline text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(u);
                        setForm({ ...form, password: "TempPass123!" });
                        setModal("reset");
                      }}
                      className="text-amber-600 hover:underline text-sm"
                    >
                      Reset password
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(u)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "create" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-4">Create user</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full border rounded px-2 py-1"
                required
              />
              <input
                type="text"
                placeholder="Display name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full border rounded px-2 py-1"
                required
              />
              <input
                type="password"
                placeholder="Temporary password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border rounded px-2 py-1"
                required
                minLength={8}
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "user" })}
                className="w-full border rounded px-2 py-1"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "edit" && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-4">Edit {selected.username}</h2>
            <form onSubmit={handleUpdate} className="space-y-3">
              <input
                type="text"
                placeholder="Display name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                className="w-full border rounded px-2 py-1"
                required
              />
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "user" })}
                className="w-full border rounded px-2 py-1"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.disabled}
                  onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
                />
                Disabled (pause login)
              </label>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "reset" && selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-bold mb-4">Reset password for {selected.username}</h2>
            <input
              type="text"
              placeholder="New temporary password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border rounded px-2 py-1 mb-4"
              minLength={8}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border rounded">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetPassword}
                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700"
              >
                Reset password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
