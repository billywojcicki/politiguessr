"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export default function AuthModal() {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const sendOtp = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep("otp");
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setOpen(false);
    setStep("email");
    setEmail("");
    setOtp("");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const closeModal = () => {
    setOpen(false);
    setStep("email");
    setError(null);
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-white/40 tracking-widest uppercase truncate max-w-[140px]">
          {user.email}
        </span>
        <button
          onClick={signOut}
          className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
      >
        Sign In
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4" onClick={closeModal}>
          <div className="w-full max-w-sm bg-black border border-white/20" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-white/10 px-5 py-3 flex items-center justify-between">
              <span className="font-mono text-xs tracking-widest uppercase text-white/40">
                {step === "email" ? "Sign In" : "Enter Code"}
              </span>
              <button
                onClick={closeModal}
                className="font-mono text-xs text-white/30 hover:text-white border border-white/10 hover:border-white/40 px-2 py-1 tracking-widest uppercase transition-colors duration-150"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {step === "email" ? (
                <>
                  <p className="font-mono text-xs text-white/40 tracking-wider leading-relaxed">
                    Enter your email to receive a sign-in code.
                  </p>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && email && sendOtp()}
                    placeholder="you@example.com"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/60"
                    autoFocus
                  />
                  {error && <p className="font-mono text-xs text-red-400">{error}</p>}
                  <button
                    onClick={sendOtp}
                    disabled={loading || !email}
                    className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? "Sending…" : "Send Code →"}
                  </button>
                </>
              ) : (
                <>
                  <p className="font-mono text-xs text-white/40 tracking-wider leading-relaxed">
                    Check <span className="text-white/60">{email}</span> for a 6-digit code.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
                    placeholder="000000"
                    className="w-full bg-transparent border border-white/20 px-3 py-2 font-mono text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-white/60 tracking-[0.5em] text-center"
                    autoFocus
                  />
                  {error && <p className="font-mono text-xs text-red-400">{error}</p>}
                  <button
                    onClick={verifyOtp}
                    disabled={loading || otp.length < 6}
                    className="w-full border border-white py-3 font-mono text-sm tracking-widest uppercase hover:bg-white hover:text-black transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {loading ? "Verifying…" : "Verify →"}
                  </button>
                  <button
                    onClick={() => { setStep("email"); setOtp(""); setError(null); }}
                    className="w-full font-mono text-xs text-white/30 hover:text-white tracking-widest uppercase transition-colors duration-150"
                  >
                    ← Use different email
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
