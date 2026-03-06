"use client";

import Link from "next/link";
import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function UpgradePage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        padding: "3rem 2.5rem",
        maxWidth: "500px",
        width: "100%",
        textAlign: "center",
        animation: "fadeIn 0.4s ease forwards",
      }}>
        {/* Icon */}
        <div style={{
          width: 56,
          height: 56,
          background: "rgba(255,77,28,0.1)",
          border: "1px solid rgba(255,77,28,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
          fontSize: "1.75rem",
        }}>
          🔒
        </div>

        <h1 style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.75rem",
          fontWeight: 700,
          color: "var(--text)",
          marginBottom: "0.75rem",
        }}>
          Your Free Trial Has Ended
        </h1>

        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: "2rem" }}>
          You&apos;ve been using <strong style={{ color: "var(--text)" }}>PDF Editor Pro</strong> for 7 days.
          Upgrade now to keep access to all 10 PDF tools — no limits, forever.
        </p>

        {/* Features */}
        <div style={{
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          padding: "1.25rem",
          marginBottom: "2rem",
          textAlign: "left",
        }}>
          {[
            "PDF Text & Canvas Editor",
            "Canva-Style Drag & Drop",
            "OCR Text Extraction",
            "Merge, Split, Reorder",
            "Watermark & Password",
          ].map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem", color: "var(--text)", fontSize: "0.875rem" }}>
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span> {f}
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <a
          href="https://knai-developer.gumroad.com/l/pdf-editor"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "block",
            background: "var(--accent)",
            color: "white",
            padding: "1rem",
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1rem",
            letterSpacing: "0.05em",
            textDecoration: "none",
            clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)",
            marginBottom: "1rem",
            transition: "background 0.2s",
          }}
        >
          Get Full Access — Gumroad
        </a>

        <button
          onClick={async () => { await signOut(); router.push("/signin"); }}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            padding: "0.6rem 1.25rem",
            cursor: "pointer",
            fontSize: "0.85rem",
            fontFamily: "var(--font-body)",
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
