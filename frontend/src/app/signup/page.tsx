"use client";

import { useState } from "react";
import { signUp } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const { data, error } = await signUp.email({ email, password, name, callbackURL: "/" });
      if (error) setError(error.message || "Sign up failed");
      else router.push("/");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1rem",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "2.5rem",
        width: "100%",
        maxWidth: "420px",
        animation: "fadeIn 0.4s ease forwards",
      }}>
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <div style={{ width: 10, height: 10, background: "var(--accent)" }} />
            <span style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "0.85rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase" as const,
              color: "var(--accent)",
            }}>PDF Editor Pro</span>
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 700, color: "var(--text)", marginBottom: "0.35rem" }}>
            Create account
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Sign up to get started</p>
        </div>

        {error && (
          <div style={{
            background: "rgba(255,77,28,0.1)",
            border: "1px solid rgba(255,77,28,0.3)",
            color: "var(--accent)",
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            marginBottom: "1.25rem",
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
          <div>
            <label className="label">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" className="input" />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="input" />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="input" />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="input" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", padding: "0.85rem", marginTop: "0.5rem" }}>
            {loading
              ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}><span className="spinner" style={{ width: 16, height: 16 }} /> Creating account...</span>
              : "Sign Up"}
          </button>
        </form>

        <div className="divider" />
        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
          Already have an account?{" "}
          <Link href="/signin" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
