"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";

const API = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/pdf`;

interface PageResult {
  page: number;
  text: string;
}

// ─── Small dropzone ────────────────────────────────────────────────────────────
function OCRDropzone({ onFile }: { onFile: (f: File) => void }) {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop: (files) => files[0] && onFile(files[0]),
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "active" : ""}`}
      style={{ padding: "2rem", textAlign: "center", borderRadius: 2 }}
    >
      <input {...getInputProps()} />
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔍</div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {isDragActive ? "Drop here..." : "Drop scanned PDF here or click to browse"}
      </p>
      {acceptedFiles[0] && (
        <span style={{
          display: "inline-block", background: "rgba(255,77,28,0.12)", color: "var(--accent)",
          padding: "0.2rem 0.6rem", fontSize: "0.8rem", marginTop: "0.25rem", fontFamily: "monospace",
        }}>
          {acceptedFiles[0].name}
        </span>
      )}
    </div>
  );
}

// ─── Single page text card ─────────────────────────────────────────────────────
function PageCard({
  page,
  text,
  onChange,
}: {
  page: number;
  text: string;
  onChange: (t: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 2,
        marginBottom: "1rem",
        overflow: "hidden",
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.5rem 1rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>
          Page {page}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            padding: "0.2rem 0.6rem",
            fontSize: "0.75rem",
            cursor: "pointer",
            borderRadius: 2,
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* editable text */}
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="No text found on this page..."
        style={{
          width: "100%",
          minHeight: 140,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "var(--text)",
          fontSize: "0.875rem",
          lineHeight: 1.7,
          padding: "0.85rem 1rem",
          resize: "vertical",
          fontFamily: "monospace",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ─── Main OCR Editor ───────────────────────────────────────────────────────────
export default function OCREditor() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<PageResult[]>([]);
  const [done, setDone] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPages([]);
    setDone(false);
  }, []);

  const handleExtract = async () => {
    if (!file) return toast.error("Please select a PDF first");
    setLoading(true);
    setDone(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/ocr-extract`, fd);
      setPages(res.data.pages);
      setDone(true);
      toast.success(`Text extracted from ${res.data.total_pages} pages! 🔍`);
    } catch (e: any) {
      const detail = e.response?.data?.detail || "OCR failed";
      toast.error(detail);
    } finally {
      setLoading(false);
    }
  };

  const updatePage = (pageNum: number, text: string) => {
    setPages((prev) =>
      prev.map((p) => (p.page === pageNum ? { ...p, text } : p))
    );
  };

  const downloadTxt = () => {
    if (!pages.length) return;
    const content = pages
      .map((p) => `=== Page ${p.page} ===\n${p.text}`)
      .join("\n\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name.replace(".pdf", "") || "ocr") + "_text.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Text file downloaded! 📄");
  };

  const copyAll = () => {
    if (!pages.length) return;
    const content = pages
      .map((p) => `=== Page ${p.page} ===\n${p.text}`)
      .join("\n\n");
    navigator.clipboard.writeText(content).then(() =>
      toast.success("All text copied! ✓")
    );
  };

  return (
    <div className="fade-in">
      {/* Feature Info */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(100,200,120,0.08) 0%, rgba(255,77,28,0.04) 100%)",
          border: "1px solid rgba(100,200,120,0.25)",
          padding: "1.5rem",
          marginBottom: "1.25rem",
          borderRadius: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "2rem" }}>🔍</span>
          <div>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "1.1rem", fontWeight: 700 }}>
              OCR Text Extractor
              <span style={{
                background: "rgba(100,200,120,0.8)", color: "#000",
                fontSize: "0.6rem", padding: "1px 5px", borderRadius: 2, marginLeft: 6,
              }}>
                NEW
              </span>
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Extract text from scanned or image-based PDFs — then edit it too
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {[
            "📄 Scanned PDF support",
            "✏️ Editable text areas",
            "📋 Copy all text",
            "💾 .txt download",
          ].map((f) => (
            <span
              key={f}
              style={{
                color: "rgb(100,200,120)",
                fontSize: "0.8rem",
                fontFamily: "Syne, sans-serif",
                fontWeight: 600,
              }}
            >
              {f}
            </span>
          ))}
        </div>
        <p style={{
          color: "#666", fontSize: "0.72rem",
          borderTop: "1px solid #1a1a1a", paddingTop: "0.75rem",
        }}>
          ⚠️ Required: Tesseract OCR must be installed —{" "}
          <span style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>
            winget install UB-Mannheim.TesseractOCR
          </span>
        </p>
      </div>

      {/* Dropzone */}
      <OCRDropzone onFile={handleFile} />

      {/* Extract button */}
      {file && !loading && (
        <div style={{ marginTop: "1rem" }}>
          <button
            className="btn-primary"
            onClick={handleExtract}
            style={{ background: "rgb(60,160,80)", border: "none" }}
          >
            🔍 Extract Text
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          marginTop: "1.5rem", display: "flex", alignItems: "center",
          gap: "0.75rem", color: "var(--text-muted)", fontSize: "0.9rem",
        }}>
          <span className="spinner" />
          Running OCR — this may take a moment...
        </div>
      )}

      {/* Results */}
      {done && pages.length > 0 && (
        <>
          {/* Actions toolbar */}
          <div style={{
            display: "flex", gap: "0.75rem", alignItems: "center",
            margin: "1.5rem 0 1rem", flexWrap: "wrap",
          }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {pages.length} page{pages.length !== 1 ? "s" : ""} — edit or download text
            </span>
            <button className="btn-ghost" onClick={copyAll} style={{ fontSize: "0.8rem" }}>
              📋 Copy All
            </button>
            <button className="btn-ghost" onClick={downloadTxt} style={{ fontSize: "0.8rem" }}>
              💾 .txt Download
            </button>
          </div>

          {/* Page cards */}
          {pages.map((p) => (
            <PageCard
              key={p.page}
              page={p.page}
              text={p.text}
              onChange={(t) => updatePage(p.page, t)}
            />
          ))}

          {/* Bottom download */}
          <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.75rem" }}>
            <button
              className="btn-primary"
              onClick={downloadTxt}
              style={{ background: "rgb(60,160,80)", border: "none" }}
            >
              💾 Download Edited Text
            </button>
            <button className="btn-ghost" onClick={copyAll}>
              📋 Copy All
            </button>
          </div>
        </>
      )}

      {done && pages.length === 0 && (
        <p style={{ color: "var(--text-muted)", marginTop: "1.5rem", fontSize: "0.9rem" }}>
          No text found. PDF is image-based or blank.
        </p>
      )}
    </div>
  );
}
