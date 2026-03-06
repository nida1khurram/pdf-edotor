"use client";

/**
 * PDFTextEditor
 *
 * Flow:
 *  1. PDF upload → /extract-text-blocks → har page ka text dikhao
 *  2. User text edit karta hai → changes automatically track hote hain
 *  3. "Apply Changes" → /replace-text → modified PDF download
 *
 * Approach: Page ka original text store karo, edited text ke saath compare karo,
 * line-level diffs se find/replace pairs banao, backend pe apply karo.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:8000/api/pdf";

interface PageData {
  page: number;
  text: string;       // original
  edited: string;     // user ka edited version
  has_text: boolean;
}

// ─── Backend Status ───────────────────────────────────────────────────────────
function BackendStatus() {
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    axios.get(`${API.replace("/api/pdf", "")}/health`, { timeout: 3000 })
      .then(() => setStatus("ok"))
      .catch((e) => {
        setStatus("error");
        setDetail(e.message || "Connection failed");
      });
  }, []);

  if (status === "ok") return null;

  return (
    <div style={{
      padding: "0.6rem 1rem", marginBottom: "0.75rem", borderRadius: 2,
      background: status === "checking" ? "rgba(100,100,100,0.1)" : "rgba(220,50,50,0.12)",
      border: `1px solid ${status === "checking" ? "#333" : "rgba(220,50,50,0.4)"}`,
      fontSize: "0.8rem", color: "var(--text-muted)",
    }}>
      {status === "checking" && "⟳ Connecting to backend..."}
      {status === "error" && (
        <>
          <span style={{ color: "#e06c75", fontWeight: 700 }}>Backend not connected!</span>
          {" "}{detail}<br />
          <code style={{ fontSize: "0.72rem" }}>backend terminal mein: uv run python main.py</code>
        </>
      )}
    </div>
  );
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function Dropzone({ onFile }: { onFile: (f: File) => void }) {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop: (fs) => fs[0] && onFile(fs[0]),
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
  });

  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}
      style={{ padding: "2rem", textAlign: "center", borderRadius: 2 }}>
      <input {...getInputProps()} />
      <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>✏️</div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {isDragActive ? "Drop here..." : "Drop PDF here or click to browse"}
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

// ─── Diff: do texts compare karke replacements nikalo ─────────────────────────
function buildReplacements(pages: PageData[]) {
  const pairs: { find: string; replace: string }[] = [];

  for (const page of pages) {
    if (page.text === page.edited) continue; // koi change nahi

    const origLines = page.text.split("\n");
    const editLines = page.edited.split("\n");
    const maxLen = Math.max(origLines.length, editLines.length);

    for (let i = 0; i < maxLen; i++) {
      const orig = (origLines[i] ?? "").trim();
      const edit = (editLines[i] ?? "").trim();
      if (orig && orig !== edit) {
        // Duplicate check
        if (!pairs.some((p) => p.find === orig)) {
          pairs.push({ find: orig, replace: edit });
        }
      }
    }
  }

  return pairs;
}

// ─── Single page card ─────────────────────────────────────────────────────────
function PageCard({
  data,
  onChange,
}: {
  data: PageData;
  onChange: (edited: string) => void;
}) {
  const isChanged = data.text !== data.edited;
  const lineCount = data.edited.split("\n").length;

  return (
    <div style={{
      background: "var(--surface2)",
      border: `1px solid ${isChanged ? "rgba(255,77,28,0.4)" : "var(--border)"}`,
      borderRadius: 2,
      marginBottom: "1rem",
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "0.5rem 1rem", borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.85rem" }}>
            Page {data.page}
          </span>
          {!data.has_text && (
            <span style={{ color: "#888", fontSize: "0.72rem", fontStyle: "italic" }}>
              (image/scanned — no text found)
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {isChanged && (
            <span style={{
              background: "rgba(255,77,28,0.15)", color: "var(--accent)",
              fontSize: "0.7rem", padding: "1px 6px", borderRadius: 2,
              fontFamily: "Syne, sans-serif", fontWeight: 700,
            }}>
              EDITED
            </span>
          )}
          <button
            onClick={() => onChange(data.text)}
            disabled={!isChanged}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              color: isChanged ? "var(--text-muted)" : "#444",
              padding: "0.15rem 0.5rem", fontSize: "0.72rem", cursor: isChanged ? "pointer" : "default",
              borderRadius: 2,
            }}
          >
            ↩ Reset
          </button>
        </div>
      </div>

      {/* Editable textarea */}
      <textarea
        value={data.edited}
        onChange={(e) => onChange(e.target.value)}
        placeholder={data.has_text ? "Edit text here..." : "This page has no selectable text..."}
        style={{
          width: "100%",
          minHeight: Math.max(120, lineCount * 22),
          background: "transparent",
          border: "none",
          outline: "none",
          color: isChanged ? "var(--text)" : "var(--text-muted)",
          fontSize: "0.85rem",
          lineHeight: 1.75,
          padding: "0.85rem 1rem",
          resize: "vertical",
          fontFamily: "monospace",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

// ─── Changes summary sidebar ───────────────────────────────────────────────────
function ChangesSummary({ replacements }: { replacements: { find: string; replace: string }[] }) {
  if (!replacements.length) return null;

  return (
    <div style={{
      background: "rgba(255,77,28,0.06)", border: "1px solid rgba(255,77,28,0.2)",
      borderRadius: 2, padding: "1rem", marginBottom: "1rem",
    }}>
      <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.85rem", marginBottom: "0.5rem" }}>
        {replacements.length} change{replacements.length !== 1 ? "s" : ""} detected:
      </p>
      <div style={{ maxHeight: 160, overflowY: "auto" }}>
        {replacements.map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.3rem",
            fontFamily: "monospace",
          }}>
            <span style={{ color: "#e06c75", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              "{r.find}"
            </span>
            <span style={{ color: "#666" }}>→</span>
            <span style={{ color: "#98c379", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              "{r.replace || "(delete)"}"
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Error box ────────────────────────────────────────────────────────────────
function ErrorBox({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <div style={{
      background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.4)",
      borderRadius: 2, padding: "1rem", marginTop: "1rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#e06c75", marginBottom: "0.4rem" }}>
          Error Detail:
        </p>
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1rem" }}>✕</button>
      </div>
      <pre style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
        {error}
      </pre>
      <p style={{ fontSize: "0.72rem", color: "#888", marginTop: "0.75rem", borderTop: "1px solid #333", paddingTop: "0.5rem" }}>
        Also check the backend terminal for errors. Backend health: <code style={{ color: "var(--accent)" }}>http://localhost:8000/health</code>
      </p>
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function PreviewModal({
  url,
  fileName,
  onClose,
  onDownload,
}: {
  url: string;
  fileName: string;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)",
      zIndex: 9999, display: "flex", flexDirection: "column",
    }}>
      {/* Topbar */}
      <div style={{
        height: 52, background: "#111", borderBottom: "1px solid #222",
        display: "flex", alignItems: "center", padding: "0 1.25rem",
        gap: "0.75rem", flexShrink: 0,
      }}>
        <span style={{ fontSize: "1rem" }}>👁</span>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontFamily: "Syne, sans-serif", fontWeight: 600 }}>
          Preview — {fileName}
        </span>
        <span style={{
          background: "rgba(255,180,50,0.15)", color: "rgb(255,180,50)",
          fontSize: "0.65rem", padding: "1px 6px", borderRadius: 2,
          fontFamily: "Syne, sans-serif", fontWeight: 700,
        }}>
          PREVIEW
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button
            className="btn-primary"
            onClick={onDownload}
            style={{ fontSize: "0.82rem", padding: "0.35rem 0.9rem" }}
          >
            💾 Download
          </button>
          <button
            className="btn-ghost"
            onClick={onClose}
            style={{ fontSize: "0.82rem", padding: "0.35rem 0.9rem" }}
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* PDF iframe */}
      <iframe
        src={url}
        title="PDF Preview"
        style={{ flex: 1, border: "none", background: "#f0f0f0" }}
      />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PDFTextEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [extracted, setExtracted] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setPages([]);
    setExtracted(false);
    setErrorDetail(null);
  }, []);

  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setErrorDetail(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await axios.post(`${API}/extract-text-blocks`, fd);
      const loaded: PageData[] = res.data.pages.map((p: any) => ({
        page: p.page,
        text: p.text,
        edited: p.text,
        has_text: p.has_text,
      }));
      setPages(loaded);
      setExtracted(true);

      const noText = loaded.filter((p) => !p.has_text).length;
      if (noText === loaded.length) {
        toast.error("This PDF is scanned/image-based — text cannot be edited");
      } else if (noText > 0) {
        toast.success(`Text loaded! (${noText} page${noText > 1 ? "s" : ""} are image-based)`);
      } else {
        toast.success(`Text loaded from ${loaded.length} pages! ✓`);
      }
    } catch (e: any) {
      console.error("PDFTextEditor extract error:", e);

      // Har possible jagah se error message nikalo
      let detail = "";
      if (e.response) {
        const d = e.response.data;
        if (typeof d === "string") detail = d;
        else if (d?.detail) detail = d.detail;
        else if (d?.message) detail = d.message;
        else detail = JSON.stringify(d);
        detail = `HTTP ${e.response.status}: ${detail}`;
      } else if (e.request) {
        detail = "No response from backend.\nCheck: http://localhost:8000/health\nAlso see backend terminal for errors.";
      } else {
        detail = e.message || "Unknown error";
      }

      setErrorDetail(detail);
      toast.error("Error — see detail box below", { duration: 4000 });
    } finally {
      setExtracting(false);
    }
  };

  const updatePage = (pageNum: number, edited: string) => {
    setPages((prev) =>
      prev.map((p) => (p.page === pageNum ? { ...p, edited } : p))
    );
  };

  const handleApply = async () => {
    if (!file || !pages.length) return;

    const replacements = buildReplacements(pages);
    if (!replacements.length) {
      return toast.error("No changes made — edit some text first");
    }

    setApplying(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replacements_json", JSON.stringify(replacements));
      const res = await axios.post(`${API}/replace-text`, fd, { responseType: "blob" });

      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = (file.name.replace(".pdf", "") || "edited") + "_edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${replacements.length} replacement${replacements.length > 1 ? "s" : ""} applied! 🎉`);
    } catch (e: any) {
      let msg = "Error applying changes";
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || json.message || msg;
        } catch {}
      } else if (e.response?.data?.detail) {
        msg = e.response.data.detail;
      } else if (e.message) {
        msg = e.message;
      }
      setErrorDetail(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setApplying(false);
    }
  };

  const handlePreview = async () => {
    if (!file || !pages.length) return;
    const replacements = buildReplacements(pages);
    if (!replacements.length) {
      return toast.error("No changes made — edit some text first");
    }
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replacements_json", JSON.stringify(replacements));
      const res = await axios.post(`${API}/replace-text`, fd, { responseType: "blob" });
      // Revoke old URL if any
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (e: any) {
      let msg = "Preview generation failed";
      if (e.response?.data instanceof Blob) {
        try { const t = await e.response.data.text(); msg = JSON.parse(t).detail || msg; } catch {}
      } else {
        msg = e.response?.data?.detail || e.message || msg;
      }
      setErrorDetail(msg);
      toast.error(msg, { duration: 5000 });
    } finally {
      setPreviewing(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const downloadFromPreview = () => {
    if (!previewUrl || !file) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = (file.name.replace(".pdf", "") || "edited") + "_edited.pdf";
    a.click();
    toast.success("Downloaded! 🎉");
  };

  const changedPages = pages.filter((p) => p.text !== p.edited).length;
  const replacements = extracted ? buildReplacements(pages) : [];

  return (
    <div className="fade-in">
      {/* Feature Info */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255,180,50,0.08) 0%, rgba(255,77,28,0.04) 100%)",
        border: "1px solid rgba(255,180,50,0.25)",
        padding: "1.5rem", marginBottom: "1.25rem", borderRadius: 2,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "2rem" }}>✏️</span>
          <div>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "1.1rem", fontWeight: 700 }}>
              PDF Text Editor
              <span style={{
                background: "rgb(255,180,50)", color: "#000",
                fontSize: "0.6rem", padding: "1px 5px", borderRadius: 2, marginLeft: 6,
              }}>
                NEW
              </span>
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
              Directly edit existing text in PDF — layout is preserved
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
          {["📄 Text extract", "✏️ Direct editing", "🔄 Find & replace", "💾 PDF download"].map((f) => (
            <span key={f} style={{
              color: "rgb(255,180,50)", fontSize: "0.8rem",
              fontFamily: "Syne, sans-serif", fontWeight: 600,
            }}>
              {f}
            </span>
          ))}
        </div>
        <p style={{ color: "#666", fontSize: "0.72rem", borderTop: "1px solid #1a1a1a", paddingTop: "0.75rem" }}>
          ⚠️ Note: Only for PDFs with selectable text — scanned PDFs have no editable text. Font/layout is approximately preserved.
        </p>
      </div>

      {/* Backend connection checker */}
      <BackendStatus />

      {/* Dropzone */}
      <Dropzone onFile={handleFile} />

      {/* Error detail box */}
      {errorDetail && <ErrorBox error={errorDetail} onDismiss={() => setErrorDetail(null)} />}

      {/* Extract button */}
      {file && !extracted && (
        <div style={{ marginTop: "1rem" }}>
          <button
            className="btn-primary"
            onClick={handleExtract}
            disabled={extracting}
            style={{ background: "rgb(200,140,30)", border: "none" }}
          >
            {extracting ? <><span className="spinner" /> &nbsp;Loading Text...</> : "📄 Load Text"}
          </button>
        </div>
      )}

      {/* Re-upload button when extracted */}
      {extracted && (
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
            {pages.length} pages loaded
            {changedPages > 0 && (
              <span style={{ color: "var(--accent)", marginLeft: "0.5rem" }}>
                — {changedPages} page{changedPages > 1 ? "s" : ""} modified
              </span>
            )}
          </span>
          <button
            className="btn-ghost"
            onClick={() => { setExtracted(false); setPages([]); setFile(null); }}
            style={{ fontSize: "0.8rem" }}
          >
            ↩ New PDF
          </button>
        </div>
      )}

      {/* Changes summary */}
      {replacements.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <ChangesSummary replacements={replacements} />
        </div>
      )}

      {/* Preview + Apply buttons */}
      {extracted && (
        <div style={{ margin: "1rem 0", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn-ghost"
            onClick={handlePreview}
            disabled={previewing || applying || replacements.length === 0}
            style={{
              borderColor: replacements.length > 0 ? "rgba(255,180,50,0.5)" : undefined,
              color: replacements.length > 0 ? "rgb(255,180,50)" : undefined,
            }}
          >
            {previewing
              ? <><span className="spinner" /> &nbsp;Generating Preview...</>
              : "👁 Preview Changes"
            }
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={applying || previewing || replacements.length === 0}
          >
            {applying
              ? <><span className="spinner" /> &nbsp;Applying...</>
              : replacements.length > 0
                ? `💾 ${replacements.length} Change${replacements.length > 1 ? "s" : ""} Apply & Download`
                : "💾 Apply & Download"
            }
          </button>
        </div>
      )}

      {/* Page cards */}
      {pages.map((p) => (
        <PageCard
          key={p.page}
          data={p}
          onChange={(edited) => updatePage(p.page, edited)}
        />
      ))}

      {/* Bottom apply if many pages */}
      {pages.length > 3 && replacements.length > 0 && (
        <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            className="btn-ghost"
            onClick={handlePreview}
            disabled={previewing || applying}
            style={{ borderColor: "rgba(255,180,50,0.5)", color: "rgb(255,180,50)" }}
          >
            {previewing ? <><span className="spinner" /> &nbsp;Generating Preview...</> : "👁 Preview Changes"}
          </button>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={applying || previewing}
          >
            {applying ? <><span className="spinner" /> &nbsp;Applying...</> : `💾 ${replacements.length} Changes Apply & Download`}
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewUrl && file && (
        <PreviewModal
          url={previewUrl}
          fileName={(file.name.replace(".pdf", "") || "edited") + "_edited.pdf"}
          onClose={closePreview}
          onDownload={downloadFromPreview}
        />
      )}
    </div>
  );
}
