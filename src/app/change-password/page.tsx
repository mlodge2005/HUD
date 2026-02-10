"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ChangePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/hud";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) router.replace("/login?from=" + encodeURIComponent("/change-password"));
        return r.json();
      })
      .then((user) => {
        if (user && !user.mustChangePassword) {
          router.replace(from);
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => setChecking(false));
  }, [from, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to change password");
        setLoading(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center text-gray-900">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-100 text-gray-900">
      <div className="w-full max-w-sm bg-white text-gray-900 rounded-lg shadow p-6">
        <h1 className="text-xl font-bold mb-4">Change password</h1>
        <p className="text-sm text-gray-700 mb-4">
          You must change your password before continuing.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current password
            </label>
            <div className="flex gap-2">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm whitespace-nowrap"
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New password
            </label>
            <div className="flex gap-2">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-500"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm whitespace-nowrap"
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm new password
            </label>
            <div className="flex gap-2">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder:text-gray-500"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-700 hover:bg-gray-100 text-sm whitespace-nowrap"
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center text-gray-900"><p>Loading…</p></main>}>
      <ChangePasswordForm />
    </Suspense>
  );
}
