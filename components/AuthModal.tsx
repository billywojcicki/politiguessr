"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type Mode = "signin" | "signup" | "forgot" | "forgot-sent";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export default function AuthModal({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [displayUsername, setDisplayUsername] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) fetchUsername(u.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchUsername(u.id);
      else setDisplayUsername(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchUsername(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    setDisplayUsername(data?.username ?? null);
  }

  const closeModal = () => {
    setOpen(false);
    setMode("signin");
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirm("");
    setError(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setUsername("");
    setPassword("");
    setConfirm("");
  };

  const signIn = async () => {
    setLoading(true);
    setError(null);
    let loginEmail = email;
    if (!email.includes("@")) {
      const { data: lookedUp, error: rpcError } = await supabase.rpc("get_email_by_username", { p_username: email });
      if (rpcError || !lookedUp) {
        setLoading(false);
        setError("Invalid username or password.");
        return;
      }
      loginEmail = lookedUp;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) { setError("Invalid username or password."); return; }
    closeModal();
  };

  const signUp = async () => {
    if (!USERNAME_REGEX.test(username)) {
      setError("Username must be 3–20 characters: letters, numbers, _ or -");
      return;
    }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) { setLoading(false); setError(signUpError.message); return; }
    if (data.user) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username })
        .eq("id", data.user.id);
      if (updateError) {
        setLoading(false);
        if (updateError.code === "23505") {
          setError("That username is already taken. Please choose another.");
        } else {
          setError("Account created but username could not be saved. Set it in Account settings.");
        }
        return;
      }
    }
    setLoading(false);
    closeModal();
  };

  const sendReset = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    if (error) { setError(error.message); return; }
    setMode("forgot-sent");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase truncate max-w-[140px]">
          {displayUsername ?? user.email}
        </span>
        {!compact && (
          <>
            <a
              href="/account"
              className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
            >
              Account
            </a>
            <button
              onClick={signOut}
              className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
            >
              Sign Out
            </button>
          </>
        )}
      </div>
    );
  }

  const titles: Record<Mode, string> = {
    signin: "Sign In",
    signup: "Create Account",
    forgot: "Reset Password",
    "forgot-sent": "Check Your Email",
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
      >
        Sign In
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="w-full max-w-sm bg-black border border-white/20">

            {/* Header */}
            <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between">
              <span className="font-mono text-xs tracking-widest uppercase text-white/40">
                {titles[mode]}
              </span>
              <button
                onClick={closeModal}
                className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Sign In */}
              {mode === "signin" && (
                <>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email or username"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                    autoFocus
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email && password && signIn()}
                    placeholder="Password"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                  />
                  {error && <p className="font-mono text-xs text-red-400">{error}</p>}
                  <button
                    onClick={signIn}
                    disabled={loading || !email || !password}
                    className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? "Signing in…" : "Sign In →"}
                  </button>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => switchMode("signup")}
                      className="font-mono text-xs text-white/30 hover:text-white tracking-widest uppercase transition-colors duration-150"
                    >
                      Create account
                    </button>
                    <button
                      onClick={() => switchMode("forgot")}
                      className="font-mono text-xs text-white/30 hover:text-white tracking-widest uppercase transition-colors duration-150"
                    >
                      Forgot password
                    </button>
                  </div>
                </>
              )}

              {/* Sign Up */}
              {mode === "signup" && (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username (letters, numbers, _ or -)"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                  />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email && username && password && confirm && signUp()}
                    placeholder="Confirm password"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                  />
                  {error && <p className="font-mono text-xs text-red-400">{error}</p>}
                  <button
                    onClick={signUp}
                    disabled={loading || !email || !username || !password || !confirm}
                    className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? "Creating account…" : "Create Account →"}
                  </button>
                  <button
                    onClick={() => switchMode("signin")}
                    className="w-full font-mono text-xs text-white/30 hover:text-white tracking-widest uppercase transition-colors duration-150"
                  >
                    ← Back to sign in
                  </button>
                </>
              )}

              {/* Forgot Password */}
              {mode === "forgot" && (
                <>
                  <p className="font-mono text-xs text-white/40 tracking-wider leading-relaxed">
                    Enter your email and we&apos;ll send a reset link.
                  </p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email && sendReset()}
                    placeholder="Email"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                    autoFocus
                  />
                  {error && <p className="font-mono text-xs text-red-400">{error}</p>}
                  <button
                    onClick={sendReset}
                    disabled={loading || !email}
                    className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? "Sending…" : "Send Reset Link →"}
                  </button>
                  <button
                    onClick={() => switchMode("signin")}
                    className="w-full font-mono text-xs text-white/30 hover:text-white tracking-widest uppercase transition-colors duration-150"
                  >
                    ← Back to sign in
                  </button>
                </>
              )}

              {/* Reset sent confirmation */}
              {mode === "forgot-sent" && (
                <>
                  <p className="font-mono text-xs text-white/40 tracking-wider leading-relaxed">
                    Reset link sent to <span className="text-white/60">{email}</span>. Check your inbox.
                  </p>
                  <button
                    onClick={() => switchMode("signin")}
                    className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150"
                  >
                    ← Back to sign in
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
