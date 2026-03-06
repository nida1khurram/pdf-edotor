"use client";

/**
 * PDFCanvasTextEditor
 *
 * Flow:
 *  1. PDF upload → /extract-blocks-with-positions → all pages info fetched once
 *  2. PDF.js renders current page as background image
 *  3. Text block overlays shown as clickable divs positioned via % coordinates
 *  4. Click block → floating popup for editing
 *  5. Edited blocks shown with orange highlight
 *  6. Preview / Download → /replace-text with all accumulated edits
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";

const API = "http://localhost:8000/api/pdf";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Block {
  id: string;
  text: string;
  x0: number; y0: number; x1: number; y1: number;
}

interface PageInfo {
  page: number;
  width: number;
  height: number;
  blocks: Block[];
}

// ─── PDF.js loader ────────────────────────────────────────────────────────────
declare global {
  interface Window { pdfjsLib?: any; }
}

function loadPdfJs(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function renderPageToImage(pdfUrl: string, pageNum: number): Promise<string> {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument(pdfUrl).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function Dropzone({ onFile }: { onFile: (f: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (fs) => fs[0] && onFile(fs[0]),
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
  });
  return (
    <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}
      style={{ padding: "2.5rem", textAlign: "center", borderRadius: 2 }}>
      <input {...getInputProps()} />
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🖼️</div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
        {isDragActive ? "Drop here..." : "Drop PDF here — Canvas Text Editor"}
      </p>
      <p style={{ color: "#555", fontSize: "0.75rem", marginTop: "0.4rem" }}>
        PDF ka visual canvas dikhega, existing text blocks click karke edit karo
      </p>
    </div>
  );
}

// ─── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ url, fileName, onClose, onDownload }: {
  url: string; fileName: string; onClose: () => void; onDownload: () => void;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
      zIndex: 9999, display: "flex", flexDirection: "column",
    }}>
      <div style={{
        height: 52, background: "#111", borderBottom: "1px solid #222",
        display: "flex", alignItems: "center", padding: "0 1.25rem", gap: "0.75rem", flexShrink: 0,
      }}>
        <span style={{ fontSize: "1rem" }}>👁</span>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", fontFamily: "Syne, sans-serif", fontWeight: 600 }}>
          Preview — {fileName}
        </span>
        <span style={{
          background: "rgba(255,140,66,0.18)", color: "rgb(255,140,66)",
          fontSize: "0.65rem", padding: "1px 6px", borderRadius: 2,
          fontFamily: "Syne, sans-serif", fontWeight: 700,
        }}>PREVIEW</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button className="btn-primary" onClick={onDownload}
            style={{ fontSize: "0.82rem", padding: "0.35rem 0.9rem" }}>
            💾 Download
          </button>
          <button className="btn-ghost" onClick={onClose}
            style={{ fontSize: "0.82rem", padding: "0.35rem 0.9rem" }}>
            ✕ Close
          </button>
        </div>
      </div>
      <iframe src={url} title="PDF Preview" style={{ flex: 1, border: "none", background: "#f0f0f0" }} />
    </div>
  );
}

// ─── Block Edit Popup ──────────────────────────────────────────────────────────
function BlockPopup({ block, currentValue, onSave, onReset, onCancel }: {
  block: Block;
  currentValue: string;
  onSave: (val: string) => void;
  onReset: () => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(currentValue);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    taRef.current?.focus();
    taRef.current?.select();
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 8888,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.65)",
    }} onClick={onCancel}>
      <div style={{
        background: "var(--surface)", border: "1px solid rgba(255,140,66,0.35)",
        borderRadius: 4, padding: "1.25rem", width: 480, maxWidth: "90vw",
        boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>
            ✏️ Edit Text Block
          </span>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
        </div>

        {/* Original label */}
        <div style={{
          background: "rgba(0,0,0,0.3)", borderRadius: 2, padding: "0.5rem 0.75rem",
          marginBottom: "0.75rem", fontSize: "0.75rem",
        }}>
          <span style={{ color: "#666", fontSize: "0.68rem", display: "block", marginBottom: "0.25rem" }}>Original:</span>
          <span style={{ color: "#999", fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {block.text}
          </span>
        </div>

        {/* Edit textarea */}
        <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
          New text:
        </label>
        <textarea
          ref={taRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box",
            background: "var(--surface2)", border: "1px solid rgba(255,140,66,0.3)",
            borderRadius: 2, color: "var(--text)", fontSize: "0.85rem",
            lineHeight: 1.6, padding: "0.6rem 0.75rem", resize: "vertical",
            fontFamily: "monospace", outline: "none",
          }}
        />

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button
            className="btn-primary"
            onClick={() => onSave(val)}
            style={{ flex: 1, fontSize: "0.85rem" }}
          >
            ✓ Save
          </button>
          <button
            className="btn-ghost"
            onClick={onReset}
            style={{ fontSize: "0.85rem", borderColor: "rgba(220,80,80,0.4)", color: "#e06c75" }}
          >
            ↩ Reset
          </button>
          <button className="btn-ghost" onClick={onCancel} style={{ fontSize: "0.85rem" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PDFCanvasTextEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [allPages, setAllPages] = useState<PageInfo[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load file → extract blocks + create blob URL for PDF.js
  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setAllPages([]);
    setEdits({});
    setCurrentPage(1);
    setBgImage(null);
    setPageInfo(null);
    setErrorMsg(null);
    setExtracting(true);

    try {
      // Create blob URL for PDF.js rendering (same approach as CanvaStyleEditor)
      const objUrl = URL.createObjectURL(f);
      setPdfObjectUrl(objUrl);

      // Extract all blocks from backend
      const fd = new FormData();
      fd.append("file", f);
      const res = await axios.post(`${API}/extract-blocks-with-positions`, fd);
      const pages: PageInfo[] = res.data.pages;
      setAllPages(pages);
      setTotalPages(res.data.total_pages);
      setPageInfo(pages[0] ?? null);

      toast.success(`${res.data.total_pages} pages loaded!`);
    } catch (e: any) {
      let msg = "Error loading PDF";
      if (e.response) {
        const d = e.response.data;
        msg = (typeof d === "string" ? d : d?.detail || d?.message || JSON.stringify(d));
        msg = `HTTP ${e.response.status}: ${msg}`;
      } else if (e.request) {
        msg = "Backend se response nahi mila. Backend chal raha hai? (http://localhost:8000/health)";
      } else {
        msg = e.message || msg;
      }
      setErrorMsg(msg);
      setFile(null);
      setPdfObjectUrl(null);
    } finally {
      setExtracting(false);
    }
  }, []);

  // Render current page image whenever page or url changes
  useEffect(() => {
    if (!pdfObjectUrl || !totalPages) return;
    setLoading(true);
    setBgImage(null);
    renderPageToImage(pdfObjectUrl, currentPage)
      .then(img => {
        setBgImage(img);
        setPageInfo(allPages[currentPage - 1] ?? null);
      })
      .catch((err) => {
        const msg = err?.message || "PDF render failed";
        setErrorMsg(`PDF.js render error: ${msg}`);
        toast.error("Page render failed");
      })
      .finally(() => setLoading(false));
  }, [pdfObjectUrl, currentPage, totalPages, allPages]);

  const editedBlockIds = new Set(Object.keys(edits));
  const totalEdits = editedBlockIds.size;

  // Page navigation
  const goPage = (n: number) => {
    if (n < 1 || n > totalPages) return;
    setCurrentPage(n);
  };

  // Block click
  const handleBlockClick = (block: Block) => {
    setSelectedBlock(block);
    setEditValue(edits[block.id] ?? block.text);
  };

  // Save edit
  const handleSave = (val: string) => {
    if (!selectedBlock) return;
    if (val === selectedBlock.text) {
      // Same as original → remove edit
      const next = { ...edits };
      delete next[selectedBlock.id];
      setEdits(next);
    } else {
      setEdits(prev => ({ ...prev, [selectedBlock.id]: val }));
    }
    setSelectedBlock(null);
  };

  // Reset block to original
  const handleReset = () => {
    if (!selectedBlock) return;
    const next = { ...edits };
    delete next[selectedBlock.id];
    setEdits(next);
    setSelectedBlock(null);
  };

  // Build replacements from edits
  const buildReplacements = () => {
    const pairs: { find: string; replace: string }[] = [];
    for (const [blockId, newText] of Object.entries(edits)) {
      // Find original text from allPages
      for (const pg of allPages) {
        const blk = pg.blocks.find(b => b.id === blockId);
        if (blk && blk.text !== newText) {
          pairs.push({ find: blk.text, replace: newText });
          break;
        }
      }
    }
    return pairs;
  };

  // Preview
  const handlePreview = async () => {
    if (!file) return;
    const replacements = buildReplacements();
    if (!replacements.length) return toast.error("No changes to preview");
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("replacements_json", JSON.stringify(replacements));
      const res = await axios.post(`${API}/replace-text`, fd, { responseType: "blob" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(res.data));
    } catch (e: any) {
      let msg = "Preview failed";
      if (e.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).detail || msg; } catch {}
      } else { msg = e.response?.data?.detail || e.message || msg; }
      toast.error(msg);
    } finally { setPreviewing(false); }
  };

  // Download
  const handleDownload = async () => {
    if (!file) return;
    const replacements = buildReplacements();
    if (!replacements.length) return toast.error("No changes to download");
    setSaving(true);
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
      toast.success(`${replacements.length} changes applied! 🎉`);
    } catch (e: any) {
      let msg = "Download failed";
      if (e.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).detail || msg; } catch {}
      } else { msg = e.response?.data?.detail || e.message || msg; }
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  // ── Upload screen ──
  if (!file || !allPages.length) {
    return (
      <div className="fade-in">
        {/* Feature info */}
        <div style={{
          background: "linear-gradient(135deg, rgba(255,140,66,0.08) 0%, rgba(255,77,28,0.04) 100%)",
          border: "1px solid rgba(255,140,66,0.25)",
          padding: "1.5rem", marginBottom: "1.25rem", borderRadius: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "2rem" }}>🖼️</span>
            <div>
              <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "1.1rem", fontWeight: 700 }}>
                Canvas Text Editor
                <span style={{
                  background: "rgb(255,140,66)", color: "#000",
                  fontSize: "0.6rem", padding: "1px 5px", borderRadius: 2, marginLeft: 6,
                }}>NEW</span>
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                PDF visual canvas pe text blocks directly click karke edit karo
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {["🖱️ Click-to-edit", "📄 Visual canvas", "🟠 Change tracking", "👁 Preview", "💾 Download"].map(f => (
              <span key={f} style={{
                color: "rgb(255,140,66)", fontSize: "0.8rem",
                fontFamily: "Syne, sans-serif", fontWeight: 600,
              }}>{f}</span>
            ))}
          </div>
        </div>

        <Dropzone onFile={handleFile} />

        {extracting && (
          <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
            <span className="spinner" /> Extracting text blocks...
          </div>
        )}

        {errorMsg && (
          <div style={{
            marginTop: "1rem", padding: "0.75rem 1rem", borderRadius: 2,
            background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.4)",
          }}>
            <p style={{ color: "#e06c75", fontWeight: 700, fontSize: "0.82rem", marginBottom: "0.35rem" }}>Error:</p>
            <pre style={{ color: "var(--text-muted)", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0 }}>
              {errorMsg}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ── Canvas editor screen ──
  return (
    <div className="fade-in" style={{ position: "relative" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem",
        flexWrap: "wrap",
      }}>
        <button
          className="btn-ghost"
          onClick={() => {
            if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
            setFile(null); setAllPages([]); setEdits({}); setBgImage(null); setPdfObjectUrl(null);
          }}
          style={{ fontSize: "0.8rem" }}
        >
          ← Back
        </button>

        <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", fontFamily: "Syne, sans-serif" }}>
          Page <strong style={{ color: "var(--text)" }}>{currentPage}</strong> / {totalPages}
        </span>

        <button
          className="btn-ghost"
          onClick={() => goPage(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.9rem" }}
        >‹</button>
        <button
          className="btn-ghost"
          onClick={() => goPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.9rem" }}
        >›</button>

        {totalEdits > 0 && (
          <span style={{
            background: "rgba(255,140,66,0.15)", border: "1px solid rgba(255,140,66,0.4)",
            color: "rgb(255,140,66)", fontSize: "0.72rem", padding: "1px 8px",
            borderRadius: 2, fontFamily: "Syne, sans-serif", fontWeight: 700,
          }}>
            {totalEdits} change{totalEdits !== 1 ? "s" : ""}
          </span>
        )}

        <span style={{ color: "#555", fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
          {file.name}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          <button
            className="btn-ghost"
            onClick={handlePreview}
            disabled={previewing || saving || totalEdits === 0}
            style={{
              fontSize: "0.82rem",
              borderColor: totalEdits > 0 ? "rgba(255,140,66,0.5)" : undefined,
              color: totalEdits > 0 ? "rgb(255,140,66)" : undefined,
            }}
          >
            {previewing ? <><span className="spinner" />&nbsp;Generating...</> : "👁 Preview"}
          </button>
          <button
            className="btn-primary"
            onClick={handleDownload}
            disabled={saving || previewing || totalEdits === 0}
            style={{ fontSize: "0.82rem" }}
          >
            {saving ? <><span className="spinner" />&nbsp;Saving...</> : "💾 Download"}
          </button>
        </div>
      </div>

      {/* Hint */}
      <p style={{ color: "#555", fontSize: "0.75rem", marginBottom: "0.75rem" }}>
        💡 Hover over text blocks to see them highlighted — click to edit
      </p>

      {/* Canvas area */}
      <div style={{
        position: "relative",
        background: "#1a1a1a",
        border: "1px solid var(--border)",
        borderRadius: 2,
        overflow: "hidden",
        minHeight: 400,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}>
        {loading && (
          <div style={{
            position: "absolute", inset: 0, display: "flex",
            alignItems: "center", justifyContent: "center",
            background: "#111", zIndex: 2,
          }}>
            <div style={{ textAlign: "center", color: "var(--text-muted)" }}>
              <span className="spinner" style={{ display: "block", margin: "0 auto 0.5rem" }} />
              <span style={{ fontSize: "0.85rem" }}>Rendering page {currentPage}...</span>
            </div>
          </div>
        )}

        {bgImage && pageInfo && (
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            {/* PDF page image */}
            <img
              src={bgImage}
              alt={`Page ${currentPage}`}
              style={{ display: "block", maxWidth: "100%", userSelect: "none" }}
              draggable={false}
            />

            {/* Block overlays — positioned using percentage of page dimensions */}
            {pageInfo.blocks.map(block => {
              const isEdited = editedBlockIds.has(block.id);
              return (
                <div
                  key={block.id}
                  title={block.text}
                  onClick={() => handleBlockClick(block)}
                  style={{
                    position: "absolute",
                    left: `${(block.x0 / pageInfo.width) * 100}%`,
                    top: `${(block.y0 / pageInfo.height) * 100}%`,
                    width: `${((block.x1 - block.x0) / pageInfo.width) * 100}%`,
                    height: `${((block.y1 - block.y0) / pageInfo.height) * 100}%`,
                    background: isEdited ? "rgba(255,140,66,0.18)" : "rgba(255,255,255,0.02)",
                    border: isEdited
                      ? "1px solid rgba(255,140,66,0.6)"
                      : "1px solid transparent",
                    cursor: "pointer",
                    boxSizing: "border-box",
                    transition: "background 0.15s, border-color 0.15s",
                    borderRadius: 1,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    if (!isEdited) {
                      el.style.background = "rgba(255,255,255,0.08)";
                      el.style.borderColor = "rgba(255,255,255,0.25)";
                    } else {
                      el.style.background = "rgba(255,140,66,0.28)";
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement;
                    el.style.background = isEdited ? "rgba(255,140,66,0.18)" : "rgba(255,255,255,0.02)";
                    el.style.borderColor = isEdited ? "rgba(255,140,66,0.6)" : "transparent";
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Page info footer */}
      {pageInfo && (
        <div style={{ marginTop: "0.6rem", display: "flex", gap: "1rem", color: "#555", fontSize: "0.72rem" }}>
          <span>{pageInfo.blocks.length} text block{pageInfo.blocks.length !== 1 ? "s" : ""} on this page</span>
          {editedBlockIds.size > 0 && (
            <span style={{ color: "rgb(255,140,66)" }}>
              {Array.from(editedBlockIds).filter(id =>
                allPages[currentPage - 1]?.blocks.some(b => b.id === id)
              ).length} edited on this page
            </span>
          )}
        </div>
      )}

      {/* Edit popup */}
      {selectedBlock && (
        <BlockPopup
          block={selectedBlock}
          currentValue={editValue}
          onSave={handleSave}
          onReset={handleReset}
          onCancel={() => setSelectedBlock(null)}
        />
      )}

      {/* Preview modal */}
      {previewUrl && file && (
        <PreviewModal
          url={previewUrl}
          fileName={(file.name.replace(".pdf", "") || "edited") + "_edited.pdf"}
          onClose={closePreview}
          onDownload={() => {
            if (!previewUrl || !file) return;
            const a = document.createElement("a");
            a.href = previewUrl;
            a.download = (file.name.replace(".pdf", "") || "edited") + "_edited.pdf";
            a.click();
            toast.success("Downloaded!");
          }}
        />
      )}
    </div>
  );
}
