"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

interface TrialInfo {
  authenticated: boolean;
  expired: boolean;
  daysLeft: number;
}

export default function TrialBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  // Skip on public pages
  const isPublic = ["/signin", "/signup", "/upgrade"].some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (isPublic) return;
    fetch("/api/trial-status")
      .then((r) => r.json())
      .then((data: TrialInfo) => {
        setTrial(data);
        if (data.authenticated && data.expired) {
          router.push("/upgrade");
        }
      });
  }, [pathname]);

  if (!trial || !trial.authenticated || trial.expired || isPublic) return null;

  const isLastDay = trial.daysLeft <= 1;
  const isWarning = trial.daysLeft <= 3;

  return (
    <div style={{
      background: isLastDay
        ? "rgba(255,77,28,0.15)"
        : isWarning
        ? "rgba(255,140,66,0.12)"
        : "rgba(255,255,255,0.05)",
      borderBottom: `1px solid ${isLastDay ? "rgba(255,77,28,0.4)" : "var(--border)"}`,
      padding: "0.6rem 1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      fontSize: "0.8rem",
    }}>
      <span style={{ color: isWarning ? "var(--accent)" : "var(--text-muted)", fontFamily: "var(--font-display)", letterSpacing: "0.05em" }}>
        {isLastDay
          ? "⚠ Your free trial expires today!"
          : `Free trial: ${trial.daysLeft} days remaining`}
      </span>
      <a
        href="/upgrade"
        style={{
          background: "var(--accent)",
          color: "white",
          padding: "0.3rem 0.9rem",
          fontSize: "0.75rem",
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          textDecoration: "none",
          clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)",
          whiteSpace: "nowrap",
        }}
      >
        Upgrade Now
      </a>
    </div>
  );
}
