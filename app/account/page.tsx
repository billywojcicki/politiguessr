"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user === null) router.replace("/");
  }, [user, router]);

  if (user === undefined) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <span className="font-mono text-xs tracking-widest text-white/30 uppercase animate-pulse">Loading…</span>
      </div>
    );
  }

  if (user === null) return null;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <div className="border-b border-white/20 px-6 py-4 flex items-center justify-between">
        <a
          href="/"
          className="font-mono text-xs text-white/30 hover:text-white tracking-widest uppercase transition-colors duration-150"
        >
          ← PolitiGuessr
        </a>
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase">Account</span>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <UsernameSection userId={user.id} />
          <div className="border-t border-white/10" />
          <EmailSection user={user} />
          <div className="border-t border-white/10" />
          <PasswordSection />
          <div className="border-t border-white/10" />
          <DangerZone userId={user.id} />
        </div>
      </div>
    </main>
  );
}

function UsernameSection({ userId }: { userId: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        const u = data?.username ?? "";
        setCurrent(u);
        setValue(u);
      });
  }, [userId]);

  const save = async () => {
    if (!USERNAME_REGEX.test(value)) {
      setError("3–20 characters: letters, numbers, _ or -");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    const { error: err } = await supabase
      .from("profiles")
      .update({ username: value })
      .eq("id", userId);
    setSaving(false);
    if (err) {
      if (err.code === "23505") setError("That username is already taken.");
      else setError(err.message);
      return;
    }
    setCurrent(value);
    setSuccess(true);
  };

  return (
    <section className="space-y-3">
      <p className="font-mono text-xs text-white/40 tracking-widest uppercase">Username</p>
      {current !== null && (
        <p className="font-mono text-xs text-white/20 tracking-wider">
          Current: <span className="text-white/50">{current || "(none)"}</span>
        </p>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSuccess(false); setError(null); }}
        placeholder="New username"
        className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
      />
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {success && <p className="font-mono text-xs text-white/40">Username updated.</p>}
      <button
        onClick={save}
        disabled={saving || !value || value === current}
        className="w-full border border-white py-2.5 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Username →"}
      </button>
    </section>
  );
}

function EmailSection({ user }: { user: User }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const { error: err } = await supabase.auth.updateUser({ email: value });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setValue("");
  };

  return (
    <section className="space-y-3">
      <p className="font-mono text-xs text-white/40 tracking-widest uppercase">Email</p>
      <p className="font-mono text-xs text-white/20 tracking-wider">
        Current: <span className="text-white/50">{user.email}</span>
      </p>
      <input
        type="email"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSuccess(false); setError(null); }}
        placeholder="New email"
        className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
      />
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {success && <p className="font-mono text-xs text-white/40">Confirmation sent to new email address.</p>}
      <button
        onClick={save}
        disabled={saving || !value || value === user.email}
        className="w-full border border-white py-2.5 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Email →"}
      </button>
    </section>
  );
}

function PasswordSection() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const save = async () => {
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    setError(null);
    setSuccess(false);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setPassword("");
    setConfirm("");
  };

  return (
    <section className="space-y-3">
      <p className="font-mono text-xs text-white/40 tracking-widest uppercase">Password</p>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setSuccess(false); setError(null); }}
        placeholder="New password"
        className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
      />
      <input
        type="password"
        value={confirm}
        onChange={(e) => { setConfirm(e.target.value); setSuccess(false); setError(null); }}
        placeholder="Confirm new password"
        className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
      />
      {error && <p className="font-mono text-xs text-red-400">{error}</p>}
      {success && <p className="font-mono text-xs text-white/40">Password updated.</p>}
      <button
        onClick={save}
        disabled={saving || !password || !confirm}
        className="w-full border border-white py-2.5 font-mono text-xs tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {saving ? "Saving…" : "Save Password →"}
      </button>
    </section>
  );
}

function DangerZone({ userId: _userId }: { userId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleting(false);
      setError(body.error ?? "Deletion failed. Please try again.");
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <section className="space-y-3">
      <p className="font-mono text-xs text-red-400/60 tracking-widest uppercase">Danger Zone</p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full border border-red-500/30 py-2.5 font-mono text-xs tracking-widest uppercase text-red-400/60 hover:border-red-500/60 hover:text-red-400 transition-colors duration-150"
        >
          Delete Account
        </button>
      ) : (
        <div className="border border-red-500/30 p-4 space-y-3">
          <p className="font-mono text-xs text-white/60 tracking-wider leading-relaxed">
            This permanently deletes your account, game history, and all data. This cannot be undone.
          </p>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirming(false); setError(null); }}
              disabled={deleting}
              className="flex-1 border border-white/20 py-2.5 font-mono text-xs tracking-widest uppercase text-white/30 hover:border-white/40 hover:text-white/60 transition-colors duration-150 disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              onClick={deleteAccount}
              disabled={deleting}
              className="flex-1 border border-red-500 py-2.5 font-mono text-xs tracking-widest uppercase text-red-400 hover:bg-red-500 hover:text-white transition-colors duration-150 disabled:opacity-30"
            >
              {deleting ? "Deleting…" : "Confirm Delete"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
