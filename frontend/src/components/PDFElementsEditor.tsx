"use client";

/**
 * PDFElementsEditor
 *
 * PDF mein naye elements add karo:
 *  - Text: font, size, bold/italic, color, position (x, y)
 *  - Image: upload, position (x, y), size (width, height)
 *
 * Flow: PDF upload → elements queue banao → Apply & Download
 * Coordinates: x/y = pts from top-left. A4 = 595×842 pts.
 */

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";

const API = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/pdf`;

// ─── Types ────────────────────────────────────────────────────────────────────
type TextEl = {
  id: string;
  type: "text";
  page: number;
  x: number;
  y: number;
  text: string;
  font_size: number;
  bold: boolean;
  italic: boolean;
  color: string;
};

type ImageEl = {
  id: string;
  type: "image";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  image_data: string;
  image_name: string;
};

type Element = TextEl | ImageEl;

function uid() {
  return Math.random().toString(36).slice(2);
}

// ─── PDF Dropzone ─────────────────────────────────────────────────────────────
function PDFDrop({ onFile }: { onFile: (f: File) => void }) {
  const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
    onDrop: (fs) => fs[0] && onFile(fs[0]),
    multiple: false,
    accept: { "application/pdf": [".pdf"] },
  });
  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "active" : ""}`}
      style={{ padding: "1.5rem", textAlign: "center", borderRadius: 2 }}
    >
      <input {...getInputProps()} />
      <div style={{ fontSize: "1.75rem", marginBottom: "0.4rem" }}>📄</div>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
        {isDragActive ? "Drop here..." : "Drop PDF here or click to browse"}
      </p>
      {acceptedFiles[0] && (
        <span style={{
          display: "inline-block", background: "rgba(120,80,255,0.12)",
          color: "#a080ff", padding: "0.2rem 0.6rem", fontSize: "0.8rem",
          marginTop: "0.25rem", fontFamily: "monospace",
        }}>
          {acceptedFiles[0].name}
        </span>
      )}
    </div>
  );
}

// ─── Image Dropzone ───────────────────────────────────────────────────────────
function ImageDrop({ onImage }: { onImage: (name: string, data: string) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      const f = files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (e) => onImage(f.name, e.target?.result as string);
      reader.readAsDataURL(f);
    },
    multiple: false,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"] },
  });
  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "active" : ""}`}
      style={{ padding: "0.85rem", textAlign: "center", borderRadius: 2, cursor: "pointer" }}
    >
      <input {...getInputProps()} />
      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", margin: 0 }}>
        {isDragActive ? "Drop here..." : "🖼️ Drop image here or click to browse"}
      </p>
      <p style={{ color: "#555", fontSize: "0.7rem", margin: "0.2rem 0 0" }}>
        PNG, JPG, WEBP
      </p>
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: "0.7rem", color: "var(--text-muted)",
        marginBottom: "0.25rem", textTransform: "uppercase", letterSpacing: "0.06em",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────
function NumInp({ value, onChange, min = 0, max = 9999 }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number;
}) {
  return (
    <input
      type="number" value={value} min={min} max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, +e.target.value)))}
      style={{
        width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 2, padding: "0.4rem 0.5rem", color: "var(--text)",
        fontSize: "0.82rem", outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

// ─── Text input ───────────────────────────────────────────────────────────────
function TxtInp({ value, onChange, placeholder = "" }: {
  value: string; onChange: (s: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
        borderRadius: 2, padding: "0.4rem 0.5rem", color: "var(--text)",
        fontSize: "0.82rem", outline: "none", boxSizing: "border-box",
      }}
    />
  );
}

// ─── Element queue row ────────────────────────────────────────────────────────
function ElementRow({ elem, onRemove }: { elem: Element; onRemove: () => void }) {
  const isText = elem.type === "text";
  const te = elem as TextEl;
  const ie = elem as ImageEl;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.6rem",
      padding: "0.5rem 0.75rem", background: "var(--surface2)",
      border: "1px solid var(--border)", borderRadius: 2, marginBottom: "0.4rem",
    }}>
      <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>{isText ? "✏️" : "🖼️"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8rem", color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isText
            ? `"${te.text.length > 35 ? te.text.slice(0, 35) + "…" : te.text}"`
            : ie.image_name}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
          Page {elem.page} · x:{elem.x} y:{elem.y}
          {isText ? ` · ${te.font_size}pt${te.bold ? " Bold" : ""}${te.italic ? " Italic" : ""}` : ` · ${ie.width}×${ie.height}pts`}
          {isText && (
            <span style={{
              display: "inline-block", width: 10, height: 10, borderRadius: "50%",
              background: te.color, border: "1px solid #444", marginLeft: 6, verticalAlign: "middle",
            }} />
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.9rem", padding: "0 2px", flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function PDFElementsEditor() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(1);
  const [elements, setElements] = useState<Element[]>([]);
  const [applying, setApplying] = useState(false);
  const [activeForm, setActiveForm] = useState<"text" | "image">("text");

  // ─── Text form state ───────────────────────────────────────────────────────
  const [tText, setTText] = useState("");
  const [tPage, setTPage] = useState(1);
  const [tX, setTX] = useState(50);
  const [tY, setTY] = useState(100);
  const [tSize, setTSize] = useState(14);
  const [tBold, setTBold] = useState(false);
  const [tItalic, setTItalic] = useState(false);
  const [tColor, setTColor] = useState("#000000");

  // ─── Image form state ──────────────────────────────────────────────────────
  const [iData, setIData] = useState("");
  const [iName, setIName] = useState("");
  const [iPage, setIPage] = useState(1);
  const [iX, setIX] = useState(50);
  const [iY, setIY] = useState(50);
  const [iW, setIW] = useState(200);
  const [iH, setIH] = useState(150);

  // ─── PDF upload ────────────────────────────────────────────────────────────
  const handlePDF = async (f: File) => {
    setPdfFile(f);
    setElements([]);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await axios.post(`${API}/extract-text-blocks`, fd);
      setPageCount(res.data.total_pages || 1);
    } catch {
      setPageCount(1);
    }
  };

  // ─── Add text element ──────────────────────────────────────────────────────
  const addText = () => {
    if (!tText.trim()) return toast.error("Please enter some text first");
    setElements((prev) => [
      ...prev,
      { id: uid(), type: "text", page: tPage, x: tX, y: tY, text: tText, font_size: tSize, bold: tBold, italic: tItalic, color: tColor },
    ]);
    setTText("");
    toast.success("Text element added ✓");
  };

  // ─── Add image element ─────────────────────────────────────────────────────
  const addImage = () => {
    if (!iData) return toast.error("Please select an image first");
    setElements((prev) => [
      ...prev,
      { id: uid(), type: "image", page: iPage, x: iX, y: iY, width: iW, height: iH, image_data: iData, image_name: iName },
    ]);
    setIData("");
    setIName("");
    toast.success("Image element added ✓");
  };

  const removeEl = (id: string) => setElements((prev) => prev.filter((e) => e.id !== id));

  // ─── Apply all elements ────────────────────────────────────────────────────
  const handleApply = async () => {
    if (!pdfFile || !elements.length) return;
    setApplying(true);
    try {
      const payload = elements.map(({ id, ...rest }) => {
        if (rest.type === "image") {
          const { image_name, ...imageRest } = rest as any;
          return imageRest;
        }
        return rest;
      });

      const fd = new FormData();
      fd.append("file", pdfFile);
      fd.append("elements_json", JSON.stringify(payload));

      const res = await axios.post(`${API}/apply-elements`, fd, { responseType: "blob" });

      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = (pdfFile.name.replace(".pdf", "") || "edited") + "_elements.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${elements.length} element${elements.length > 1 ? "s" : ""} applied! 🎉`);
    } catch (e: any) {
      let msg = "Error applying elements";
      if (e.response?.data instanceof Blob) {
        try {
          const text = await e.response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || msg;
        } catch {}
      } else {
        msg = e.response?.data?.detail || e.message || msg;
      }
      toast.error(msg, { duration: 5000 });
    } finally {
      setApplying(false);
    }
  };

  // ─── Upload screen ─────────────────────────────────────────────────────────
  if (!pdfFile) {
    return (
      <div className="fade-in">
        <div style={{
          background: "linear-gradient(135deg, rgba(120,80,255,0.08) 0%, rgba(255,77,28,0.04) 100%)",
          border: "1px solid rgba(120,80,255,0.25)",
          padding: "1.5rem", marginBottom: "1.25rem", borderRadius: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "2rem" }}>🖼️</span>
            <div>
              <h3 style={{ fontFamily: "Syne, sans-serif", fontSize: "1.1rem", fontWeight: 700 }}>
                Elements Editor
                <span style={{
                  background: "#7850ff", color: "#fff",
                  fontSize: "0.6rem", padding: "1px 5px", borderRadius: 2, marginLeft: 6,
                }}>
                  NEW
                </span>
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                Add styled text and images to your PDF — control position, size, and formatting
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            {["✏️ Styled text", "🖼️ Image insert", "📍 Precise position", "🎨 Font & color", "💾 PDF download"].map((f) => (
              <span key={f} style={{ color: "#a080ff", fontSize: "0.8rem", fontFamily: "Syne, sans-serif", fontWeight: 600 }}>
                {f}
              </span>
            ))}
          </div>
          <p style={{ color: "#555", fontSize: "0.72rem", borderTop: "1px solid #1a1a1a", paddingTop: "0.75rem", margin: 0 }}>
            💡 Coordinates: A4 = 595×842 pts, Letter = 612×792 pts. 1 inch = 72 pts. (0,0) = page top-left.
          </p>
        </div>
        <PDFDrop onFile={handlePDF} />
      </div>
    );
  }

  // ─── Editor screen ─────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* PDF info bar */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={{
          background: "var(--surface2)", padding: "0.4rem 0.8rem",
          fontSize: "0.8rem", color: "var(--text-muted)", borderRadius: 2, flex: 1,
        }}>
          📄 <strong style={{ color: "var(--text)" }}>{pdfFile.name}</strong>
          {" "}— {pageCount} page{pageCount !== 1 ? "s" : ""}
          <span style={{ marginLeft: "0.75rem", color: "#444", fontSize: "0.7rem" }}>
            A4 ≈ 595×842 pts · Letter ≈ 612×792 pts
          </span>
        </div>
        <button
          className="btn-ghost"
          onClick={() => { setPdfFile(null); setElements([]); }}
          style={{ fontSize: "0.8rem" }}
        >
          ↩ New PDF
        </button>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", alignItems: "start" }}>

        {/* LEFT: Element form */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 2, overflow: "hidden",
        }}>
          {/* Form type tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            {(["text", "image"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveForm(t)}
                style={{
                  flex: 1, padding: "0.6rem", fontSize: "0.82rem", fontWeight: 700,
                  background: activeForm === t ? "rgba(120,80,255,0.1)" : "transparent",
                  border: "none",
                  borderBottom: activeForm === t ? "2px solid #7850ff" : "2px solid transparent",
                  color: activeForm === t ? "#a080ff" : "var(--text-muted)",
                  cursor: "pointer", fontFamily: "Syne, sans-serif",
                }}
              >
                {t === "text" ? "✏️ Text Add" : "🖼️ Image Add"}
              </button>
            ))}
          </div>

          <div style={{ padding: "1rem" }}>
            {/* ── TEXT FORM ── */}
            {activeForm === "text" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Field label="Text Content">
                  <textarea
                    value={tText}
                    onChange={(e) => setTText(e.target.value)}
                    placeholder="Type your text here..."
                    rows={3}
                    style={{
                      width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: 2, padding: "0.4rem 0.6rem", color: "var(--text)",
                      fontSize: "0.85rem", resize: "vertical", outline: "none",
                      boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <Field label="Page"><NumInp value={tPage} onChange={setTPage} min={1} max={pageCount} /></Field>
                  <Field label="X (left →)"><NumInp value={tX} onChange={setTX} min={0} max={2000} /></Field>
                  <Field label="Y (top ↓)"><NumInp value={tY} onChange={setTY} min={0} max={2000} /></Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", alignItems: "end" }}>
                  <Field label="Font Size (pt)">
                    <NumInp value={tSize} onChange={setTSize} min={6} max={200} />
                  </Field>

                  <Field label="Color">
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <input
                        type="color" value={tColor}
                        onChange={(e) => setTColor(e.target.value)}
                        style={{
                          width: 36, height: 33, padding: 2, borderRadius: 2,
                          border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer",
                          flexShrink: 0,
                        }}
                      />
                      <TxtInp value={tColor} onChange={setTColor} placeholder="#000000" />
                    </div>
                  </Field>

                  <Field label="Style">
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      {([
                        { label: "B", bold: true, active: tBold, toggle: () => setTBold(!tBold) },
                        { label: "I", bold: false, active: tItalic, toggle: () => setTItalic(!tItalic) },
                      ]).map((s) => (
                        <button
                          key={s.label}
                          onClick={s.toggle}
                          style={{
                            flex: 1, padding: "0.35rem", fontSize: "0.85rem",
                            fontWeight: s.bold ? 800 : 400,
                            fontStyle: s.bold ? "normal" : "italic",
                            background: s.active ? "rgba(120,80,255,0.2)" : "var(--surface2)",
                            border: `1px solid ${s.active ? "#7850ff" : "var(--border)"}`,
                            borderRadius: 2,
                            color: s.active ? "#a080ff" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                {/* Preview */}
                {tText && (
                  <div style={{
                    padding: "0.5rem 0.75rem", background: "rgba(120,80,255,0.06)",
                    border: "1px solid rgba(120,80,255,0.2)", borderRadius: 2,
                    fontSize: "0.75rem", color: "var(--text-muted)",
                  }}>
                    Preview:{" "}
                    <span style={{
                      fontWeight: tBold ? 700 : 400,
                      fontStyle: tItalic ? "italic" : "normal",
                      color: tColor || "var(--text)",
                      fontSize: Math.min(tSize, 18),
                    }}>
                      {tText.slice(0, 40)}
                    </span>
                  </div>
                )}

                <button
                  className="btn-primary"
                  onClick={addText}
                  style={{ background: "#7850ff", border: "none" }}
                >
                  + Add Text to Queue
                </button>
              </div>
            )}

            {/* ── IMAGE FORM ── */}
            {activeForm === "image" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Field label="Image File">
                  {iData ? (
                    <div style={{
                      display: "flex", gap: "0.6rem", alignItems: "center",
                      padding: "0.5rem", background: "var(--surface2)", borderRadius: 2,
                      border: "1px solid var(--border)",
                    }}>
                      <img src={iData} alt="" style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {iName}
                      </div>
                      <button
                        onClick={() => { setIData(""); setIName(""); }}
                        style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: "0.9rem" }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <ImageDrop onImage={(name, data) => { setIName(name); setIData(data); }} />
                  )}
                </Field>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  <Field label="Page"><NumInp value={iPage} onChange={setIPage} min={1} max={pageCount} /></Field>
                  <Field label="X (left →)"><NumInp value={iX} onChange={setIX} min={0} max={2000} /></Field>
                  <Field label="Y (top ↓)"><NumInp value={iY} onChange={setIY} min={0} max={2000} /></Field>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <Field label="Width (pts)"><NumInp value={iW} onChange={setIW} min={10} max={2000} /></Field>
                  <Field label="Height (pts)"><NumInp value={iH} onChange={setIH} min={10} max={2000} /></Field>
                </div>

                <p style={{ fontSize: "0.7rem", color: "#555", margin: 0 }}>
                  💡 1 inch = 72 pts &nbsp;·&nbsp; A4 width = 595 pts &nbsp;·&nbsp; (0,0) = page top-left
                </p>

                <button
                  className="btn-primary"
                  onClick={addImage}
                  disabled={!iData}
                  style={{ background: "#7850ff", border: "none" }}
                >
                  + Add Image to Queue
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Queue + Apply */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
            <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "0.85rem", margin: 0 }}>
              Queue
              <span style={{
                background: elements.length ? "rgba(120,80,255,0.2)" : "var(--surface2)",
                color: elements.length ? "#a080ff" : "var(--text-muted)",
                fontSize: "0.7rem", padding: "1px 6px", borderRadius: 10, marginLeft: 8,
              }}>
                {elements.length}
              </span>
            </p>
            {elements.length > 0 && (
              <button
                onClick={() => setElements([])}
                style={{ background: "none", border: "none", color: "#555", fontSize: "0.75rem", cursor: "pointer" }}
              >
                Clear All
              </button>
            )}
          </div>

          {elements.length === 0 ? (
            <div style={{
              padding: "2.5rem 1rem", textAlign: "center",
              border: "1px dashed var(--border)", borderRadius: 2,
              color: "var(--text-muted)", fontSize: "0.8rem",
            }}>
              Queue is empty
              <br />
              <span style={{ color: "#444", fontSize: "0.72rem" }}>
                Add text or image from the left panel
              </span>
            </div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {elements.map((el) => (
                <ElementRow key={el.id} elem={el} onRemove={() => removeEl(el.id)} />
              ))}
            </div>
          )}

          {elements.length > 0 && (
            <button
              className="btn-primary"
              onClick={handleApply}
              disabled={applying}
              style={{ width: "100%", marginTop: "1rem", background: "#7850ff", border: "none" }}
            >
              {applying
                ? <><span className="spinner" /> &nbsp;Applying...</>
                : `✅ Apply ${elements.length} Element${elements.length > 1 ? "s" : ""} & Download`}
            </button>
          )}

          {/* Quick tips */}
          <div style={{
            marginTop: "1rem", padding: "0.75rem",
            background: "rgba(120,80,255,0.05)", border: "1px solid rgba(120,80,255,0.15)",
            borderRadius: 2, fontSize: "0.72rem", color: "#555",
          }}>
            <strong style={{ color: "var(--text-muted)" }}>Tips:</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", lineHeight: 1.7 }}>
              <li>Text ka Y = baseline position (text Y se thoda upar dikhega)</li>
              <li>Image ka (X, Y) = top-left corner of image</li>
              <li>Add multiple elements and apply all at once</li>
              <li>Page number 1 se shuru hota hai</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
