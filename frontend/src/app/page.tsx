"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

// Dynamically import editors (client only - uses browser APIs)
const CanvaStyleEditor = dynamic(() => import("@/components/CanvaStyleEditor"), { ssr: false });
const PDFCanvasTextEditor = dynamic(() => import("@/components/PDFCanvasTextEditor"), { ssr: false });

const API = "http://localhost:8000/api/pdf";

// ──────────────── UTILS ────────────────
function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ──────────────── FILE DROP ────────────────
function FileDropzone({ onFiles, multiple = false, label = "Drop PDF file here or click to browse" }: {
  onFiles: (files: File[]) => void; multiple?: boolean; label?: string;
}) {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop: onFiles, multiple, accept: { "application/pdf": [".pdf"] }
  });

  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}
      style={{ padding: "2rem", textAlign: "center", borderRadius: 2 }}>
      <input {...getInputProps()} />
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📄</div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {isDragActive ? "Drop here..." : label}
      </p>
      {acceptedFiles.length > 0 && acceptedFiles.map(f => (
        <span key={f.name} style={{
          display: "inline-block", background: "rgba(255,77,28,0.12)", color: "var(--accent)",
          padding: "0.2rem 0.6rem", fontSize: "0.8rem", marginTop: "0.25rem", fontFamily: "monospace"
        }}>{f.name}</span>
      ))}
    </div>
  );
}

// ──────────────── TOOLS ────────────────
function MergeTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (files.length < 2) return toast.error("At least 2 PDFs required!");
    setLoading(true);
    try {
      const fd = new FormData(); files.forEach(f => fd.append("files", f));
      const res = await axios.post(`${API}/merge`, fd, { responseType: "blob" });
      downloadBlob(res.data, "merged.pdf"); toast.success("Merged! 🎉");
    } catch { toast.error("An error occurred"); } finally { setLoading(false); }
  };
  return (
    <div className="fade-in">
      <FileDropzone multiple onFiles={setFiles} label="Drop multiple PDFs here" />
      {files.length > 0 && <div style={{ marginTop: "1rem" }}>
        {files.map((f, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem", background: "var(--surface2)", marginBottom: 4, fontSize: "0.85rem" }}>
            <span style={{ color: "var(--text)" }}>{f.name}</span>
            <span style={{ color: "var(--text-muted)" }}>{(f.size / 1024).toFixed(0)} KB</span>
          </div>
        ))}
      </div>}
      <div style={{ marginTop: "1.25rem" }}>
        <button className="btn-primary" onClick={handleSubmit} disabled={loading || files.length < 2}>
          {loading ? <span className="spinner" /> : "Merge PDFs"}
        </button>
      </div>
    </div>
  );
}

function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"split" | "delete">("split");
  const [pages, setPages] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!file) return toast.error("Select a PDF first");
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("pages", pages);
      const endpoint = mode === "split" ? "split" : "delete-pages";
      const res = await axios.post(`${API}/${endpoint}`, fd, { responseType: "blob" });
      downloadBlob(res.data, mode === "split" ? "split.zip" : "deleted.pdf");
      toast.success("Done! ✂️");
    } catch { toast.error("Error"); } finally { setLoading(false); }
  };
  return (
    <div className="fade-in">
      <FileDropzone onFiles={f => setFile(f[0])} />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        {(["split", "delete"] as const).map(m => (
          <button key={m} className="btn-ghost"
            style={mode === m ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
            onClick={() => setMode(m)}>
            {m === "split" ? "✂️ Extract" : "🗑️ Delete"}
          </button>
        ))}
      </div>
      <div style={{ marginTop: "1rem" }}>
        <label className="label">Pages (e.g., 1,3,5-7)</label>
        <input className="input" value={pages} onChange={e => setPages(e.target.value)} placeholder="1,3,5-7" />
      </div>
      <button className="btn-primary" style={{ marginTop: "1.25rem" }} onClick={handleSubmit} disabled={loading || !file}>
        {loading ? <span className="spinner" /> : "Proceed"}
      </button>
    </div>
  );
}

function WatermarkTool() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL"); const [opacity, setOpacity] = useState(0.3);
  const [color, setColor] = useState("gray"); const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!file) return toast.error("Select a PDF first");
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("text", text);
      fd.append("opacity", String(opacity)); fd.append("color", color);
      const res = await axios.post(`${API}/watermark`, fd, { responseType: "blob" });
      downloadBlob(res.data, "watermarked.pdf"); toast.success("Watermark added! 💧");
    } catch { toast.error("Error"); } finally { setLoading(false); }
  };
  return (
    <div className="fade-in">
      <FileDropzone onFiles={f => setFile(f[0])} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <div><label className="label">Text</label><input className="input" value={text} onChange={e => setText(e.target.value)} /></div>
        <div><label className="label">Color</label>
          <select className="input" value={color} onChange={e => setColor(e.target.value)}>
            {["gray", "red", "blue", "black"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: "1rem" }}>
        <label className="label">Opacity: {(opacity * 100).toFixed(0)}%</label>
        <input type="range" min="0.1" max="0.9" step="0.05" value={opacity}
          onChange={e => setOpacity(+e.target.value)} style={{ width: "100%", accentColor: "var(--accent)" }} />
      </div>
      <button className="btn-primary" style={{ marginTop: "1.25rem" }} onClick={handleSubmit} disabled={loading || !file}>
        {loading ? <span className="spinner" /> : "Watermark Lagaein"}
      </button>
    </div>
  );
}


function ReorderTool() {
  const [file, setFile] = useState<File | null>(null); const [order, setOrder] = useState(""); const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!file || !order) return toast.error("File and order are required");
    setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("order", order);
      const res = await axios.post(`${API}/reorder`, fd, { responseType: "blob" });
      downloadBlob(res.data, "reordered.pdf"); toast.success("Reordered! 🔀");
    } catch { toast.error("Error"); } finally { setLoading(false); }
  };
  return (
    <div className="fade-in">
      <FileDropzone onFiles={f => setFile(f[0])} />
      <div style={{ marginTop: "1rem" }}>
        <label className="label">New Order (e.g., 3,1,2,4)</label>
        <input className="input" value={order} onChange={e => setOrder(e.target.value)} placeholder="3,1,2,4" />
      </div>
      <button className="btn-primary" style={{ marginTop: "1.25rem" }} onClick={handleSubmit} disabled={loading || !file}>
        {loading ? <span className="spinner" /> : "Reorder Pages"}
      </button>
    </div>
  );
}

// ──────────────── CANVAS EDITOR LAUNCHER (Annotations) ────────────────
function CanvasEditorLauncher({ onOpen, label = "Canvas Editor" }: { onOpen: (file: File, pages: number) => void; label?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleFile = async (files: File[]) => {
    const f = files[0]; setFile(f); setLoading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await axios.post(`${API}/get-info`, fd);
      setPageCount(res.data.total_pages);
    } catch { setPageCount(1); } finally { setLoading(false); }
  };

  return (
    <div className="fade-in">
      <div style={{ background: "linear-gradient(135deg, rgba(255,77,28,0.08) 0%, rgba(255,140,66,0.04) 100%)", border: "1px solid rgba(255,77,28,0.2)", padding: "1.5rem", marginBottom: "1.25rem", borderRadius: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "2rem" }}>🎨</span>
          <div>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "1.1rem", fontWeight: 700 }}>Annotation Editor</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Overlay annotations on PDF — original text stays safe</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {["📝 Text overlay", "🖼️ Image place", "◧ Highlight", "✍️ Signature"].map(f => (
            <span key={f} style={{ color: "var(--accent)", fontSize: "0.8rem", fontFamily: "Syne, sans-serif", fontWeight: 600 }}>{f}</span>
          ))}
        </div>
      </div>
      <FileDropzone onFiles={handleFile} label="Drop PDF here" />
      {loading && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>Loading...</p>}
      {file && pageCount > 0 && (
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ background: "var(--surface2)", padding: "0.5rem 1rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>📄 {file.name} — {pageCount} pages</div>
          <button className="btn-primary" onClick={() => onOpen(file, pageCount)}>🎨 Open →</button>
        </div>
      )}
    </div>
  );
}


// ──────────────── MAIN APP ────────────────
const TABS = [
  { id: "canvastext", label: "🖼 Canvas Text Edit" },
  { id: "canvas", label: "🎨 Canvas Editor" },
  { id: "merge", label: "⊕ Merge" },
  { id: "split", label: "✂ Split" },
  { id: "watermark", label: "◈ Watermark" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("canvastext");
  const [canvasFile, setCanvasFile] = useState<File | null>(null);
  const [canvasPages, setCanvasPages] = useState(1);
  const [inEditor, setInEditor] = useState<"canvas" | "canva" | null>(null);

  const openEditor = (file: File, pages: number) => {
    setCanvasFile(file); setCanvasPages(pages); setInEditor("canvas");
  };

  // Full screen editor
  if (inEditor === "canvas" && canvasFile) {
    return <CanvaStyleEditor pdfFile={canvasFile} pageCount={canvasPages} onBack={() => setInEditor(null)} />;
  }

  const renderTool = () => {
    switch (activeTab) {
      case "canvastext": return <PDFCanvasTextEditor />;
      case "canvas": return <CanvasEditorLauncher onOpen={openEditor} label="Canvas Editor (annotations)" />;
      case "merge": return <MergeTool />;
      case "split": return <SplitTool />;
      case "watermark": return <WatermarkTool />;
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "1.5rem 2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <div style={{
          width: 36, height: 36, background: "var(--accent)", display: "flex", alignItems: "center",
          justifyContent: "center", fontWeight: 800, fontSize: "1.1rem",
          clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)"
        }}>P</div>
        <div>
          <h1 style={{ fontSize: "1.2rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            PDF Editor<span style={{ color: "var(--accent)" }}>Pro</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            v2.0 — Canvas Editor Update
          </p>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <span style={{
            background: "rgba(255,77,28,0.1)", border: "1px solid rgba(255,77,28,0.3)",
            color: "var(--accent)", padding: "0.2rem 0.6rem", fontSize: "0.7rem",
            fontFamily: "Syne, sans-serif", fontWeight: 700, letterSpacing: "0.08em"
          }}>NEW: Visual Canvas Editor</span>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem" }}>
        {/* Hero */}
        <div style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.04em" }}>
            Edit your PDF{" "}
            <span style={{ color: "transparent", WebkitTextStroke: "1px var(--accent)" }}>your way</span>
          </h2>
          <p style={{ color: "var(--text-muted)", marginTop: "0.75rem", maxWidth: 520 }}>
            Direct drag & drop editing on canvas, or batch tools — all in one place.
          </p>
        </div>

        {/* Tool Card */}
        <div className="card" style={{ borderRadius: 2 }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem", overflowX: "auto" }}>
            {TABS.map(tab => (
              <button key={tab.id} className={`tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}>
                {tab.label}
                {tab.id === "canvastext" && (
                  <span style={{ marginLeft: 6, background: "rgb(255,140,66)", color: "#000", fontSize: "0.55rem", padding: "0 4px", borderRadius: 2 }}>NEW</span>
                )}
              </button>
            ))}
          </div>
          <div key={activeTab}>{renderTool()}</div>
        </div>

        <div style={{ marginTop: "3rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "0.75rem" }}>
          <span>PDF Editor Pro v2.0 — Next.js + FastAPI</span>
          <span>Your files stay in your browser only</span>
        </div>
      </div>
    </main>
  );
}
