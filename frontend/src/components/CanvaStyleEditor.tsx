"use client";

/**
 * CanvaStyleEditor — Canva jaisa full-page PDF editor
 *
 * Flow:
 *  1. PDF page → PDF.js se image (PNG dataUrl) mein convert
 *  2. Background image ke upar freely movable/editable elements
 *  3. Save: HTML Canvas pe sab kuch draw → PNG → PDF (jsPDF)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type ElementType = "text" | "image" | "shape" | "signature";

interface BaseEl {
  id: string;
  type: ElementType;
  x: number; y: number;
  width: number; height: number;
  rotation: number; // degrees
  opacity: number;
}

interface TextEl extends BaseEl {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  bgColor: string; // background fill, "" = none
}

interface ImageEl extends BaseEl {
  type: "image" | "signature";
  src: string; // dataUrl
}

interface ShapeEl extends BaseEl {
  type: "shape";
  shape: "rect" | "ellipse" | "line";
  fill: string;
  stroke: string;
  strokeWidth: number;
}

type CanvasEl = TextEl | ImageEl | ShapeEl;

// ─── Constants ────────────────────────────────────────────────────────────────
const FONTS = ["Helvetica", "Times New Roman", "Courier New", "Arial", "Georgia", "Verdana"];
const HANDLE_SIZE = 8;

function uid() { return Math.random().toString(36).slice(2, 9); }

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// ─── Signature Pad ────────────────────────────────────────────────────────────
function SignaturePad({ onSave, onClose }: { onSave: (d: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const history = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [empty, setEmpty] = useState(true);

  const pos = (e: React.MouseEvent | React.TouchEvent, c: HTMLCanvasElement) => {
    const r = c.getBoundingClientRect();
    if ("touches" in e) return { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    return { x: (e as React.MouseEvent).clientX - r.left, y: (e as React.MouseEvent).clientY - r.top };
  };

  const snapshot = () => {
    const c = ref.current!; history.current.push(c.getContext("2d")!.getImageData(0, 0, c.width, c.height));
    setCanUndo(true);
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => { snapshot(); drawing.current = true; last.current = pos(e, ref.current!); };
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const c = ref.current!; const ctx = c.getContext("2d")!; const p = pos(e, c);
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    last.current = p; setEmpty(false);
  };
  const onUp = () => { drawing.current = false; };

  const undo = () => {
    if (!history.current.length) return;
    const c = ref.current!; c.getContext("2d")!.putImageData(history.current.pop()!, 0, 0);
    setCanUndo(history.current.length > 0);
    const d = ref.current!.getContext("2d")!.getImageData(0, 0, ref.current!.width, ref.current!.height).data;
    setEmpty(!Array.from(d).some(v => v !== 0));
  };

  const clear = () => { snapshot(); ref.current!.getContext("2d")!.clearRect(0, 0, 400, 180); setEmpty(true); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#111", border: "1px solid #333", padding: "1.5rem", borderRadius: 6, minWidth: 440 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h3 style={{ fontFamily: "Syne,sans-serif", color: "#f0ece4", fontSize: "1rem" }}>✍️ Signature</h3>
          <span style={{ color: "#666", fontSize: "0.75rem" }}>Draw with your mouse</span>
        </div>
        <div style={{ position: "relative" }}>
          <canvas ref={ref} width={400} height={180}
            style={{ background: "#fff", borderRadius: 3, display: "block", width: "100%", cursor: "crosshair" }}
            onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
            onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
          />
          {empty && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "rgba(0,0,0,0.2)", fontSize: "0.85rem" }}>Sign here...</div>}
          <div style={{ position: "absolute", bottom: 40, left: 16, right: 16, height: 1, background: "rgba(0,0,0,0.1)", pointerEvents: "none" }} />
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button className="btn-primary" disabled={empty} style={{ opacity: empty ? 0.4 : 1 }}
            onClick={() => { onSave(ref.current!.toDataURL()); onClose(); }}>✅ Save</button>
          <button className="btn-ghost" disabled={!canUndo} onClick={undo}
            style={{ borderColor: canUndo ? "#ff8c42" : "#333", color: canUndo ? "#ff8c42" : "#555" }}>↩ Undo</button>
          <button className="btn-ghost" disabled={empty} onClick={clear}
            style={{ borderColor: !empty ? "#ff4444" : "#333", color: !empty ? "#ff4444" : "#555" }}>🗑 Clear</button>
          <button className="btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Cancel</button>
        </div>
        <p style={{ color: "#555", fontSize: "0.7rem", marginTop: "0.6rem" }}>💡 Made a mistake? Use Undo to remove it</p>
      </div>
    </div>
  );
}

// ─── Floating Text Toolbar ─────────────────────────────────────────────────────
function TextToolbar({ el, onChange, onDelete }: {
  el: TextEl;
  onChange: (updates: Partial<TextEl>) => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      position: "absolute", top: -46, left: 0, zIndex: 100,
      display: "flex", gap: 3, background: "#1a1a1a",
      border: "1px solid #333", padding: "4px 6px", borderRadius: 4,
      boxShadow: "0 4px 20px rgba(0,0,0,0.7)", whiteSpace: "nowrap", alignItems: "center",
    }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Font family */}
      <select value={el.fontFamily} onChange={e => onChange({ fontFamily: e.target.value })}
        style={{ background: "#2a2a2a", color: "#ddd", border: "1px solid #444", fontSize: "0.7rem", padding: "2px 4px", borderRadius: 2, cursor: "pointer" }}>
        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      {/* Font size */}
      <select value={el.fontSize} onChange={e => onChange({ fontSize: +e.target.value })}
        style={{ background: "#2a2a2a", color: "#ddd", border: "1px solid #444", fontSize: "0.7rem", padding: "2px 4px", borderRadius: 2, width: 52, cursor: "pointer" }}>
        {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 60, 72].map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "#333", margin: "0 2px" }} />

      {/* Bold */}
      <button onClick={() => onChange({ bold: !el.bold })}
        style={{ background: el.bold ? "#ff8c42" : "transparent", color: el.bold ? "#fff" : "#aaa", border: "1px solid #333", padding: "2px 7px", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", borderRadius: 2 }}>B</button>

      {/* Italic */}
      <button onClick={() => onChange({ italic: !el.italic })}
        style={{ background: el.italic ? "#ff8c42" : "transparent", color: el.italic ? "#fff" : "#aaa", border: "1px solid #333", padding: "2px 7px", fontSize: "0.75rem", fontStyle: "italic", cursor: "pointer", borderRadius: 2 }}>I</button>

      {/* Underline */}
      <button onClick={() => onChange({ underline: !el.underline })}
        style={{ background: el.underline ? "#ff8c42" : "transparent", color: el.underline ? "#fff" : "#aaa", border: "1px solid #333", padding: "2px 7px", fontSize: "0.75rem", textDecoration: "underline", cursor: "pointer", borderRadius: 2 }}>U</button>

      <div style={{ width: 1, height: 20, background: "#333", margin: "0 2px" }} />

      {/* Align */}
      {(["left", "center", "right"] as const).map(a => (
        <button key={a} onClick={() => onChange({ align: a })}
          style={{ background: el.align === a ? "#ff8c42" : "transparent", color: el.align === a ? "#fff" : "#aaa", border: "1px solid #333", padding: "2px 5px", fontSize: "0.65rem", cursor: "pointer", borderRadius: 2 }}>
          {a === "left" ? "≡" : a === "center" ? "☰" : "≡"}
        </button>
      ))}

      <div style={{ width: 1, height: 20, background: "#333", margin: "0 2px" }} />

      {/* Text color */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ color: "#888", fontSize: "0.65rem", marginRight: 2 }}>A</span>
        <input type="color" value={el.color} onChange={e => onChange({ color: e.target.value })}
          title="Text color" style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", padding: 0 }} />
      </div>

      {/* Background color */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <span style={{ color: "#888", fontSize: "0.65rem", marginRight: 2 }}>bg</span>
        <input type="color" value={el.bgColor || "#ffffff"} onChange={e => onChange({ bgColor: e.target.value })}
          title="Background color" style={{ width: 22, height: 22, border: "none", background: "transparent", cursor: "pointer", padding: 0 }} />
        <button onClick={() => onChange({ bgColor: "" })} title="No background"
          style={{ background: "transparent", border: "1px solid #333", color: "#888", padding: "1px 3px", fontSize: "0.6rem", cursor: "pointer", borderRadius: 2, marginLeft: 2 }}>✕</button>
      </div>

      <div style={{ width: 1, height: 20, background: "#333", margin: "0 2px" }} />

      {/* Delete */}
      <button onClick={onDelete}
        style={{ background: "transparent", color: "#ff4444", border: "1px solid #ff4444", padding: "2px 6px", fontSize: "0.7rem", cursor: "pointer", borderRadius: 2 }}>🗑</button>
    </div>
  );
}

// ─── Main CanvaStyleEditor ─────────────────────────────────────────────────────
export default function CanvaStyleEditor({ pdfFile, pageCount, onBack }: {
  pdfFile: File; pageCount: number; onBack: () => void;
}) {
  const [page, setPage] = useState(1);
  const [bgImage, setBgImage] = useState<string | null>(null); // PDF page as image
  const [canvasW, setCanvasW] = useState(794);
  const [canvasH, setCanvasH] = useState(1122);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // inline text edit

  const [activeTool, setActiveTool] = useState<"select" | "text" | "image" | "signature" | "rect" | "ellipse">("select");
  const [showSigPad, setShowSigPad] = useState(false);

  // Drag / resize state
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ id: string; handle: string; startX: number; startY: number; origW: number; origH: number; origX: number; origY: number } | null>(null);

  // Undo
  const undoStack = useRef<CanvasEl[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const pushUndo = useCallback((els: CanvasEl[]) => {
    undoStack.current.push(els.map(e => ({ ...e })));
    if (undoStack.current.length > 60) undoStack.current.shift();
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    if (!undoStack.current.length) return;
    setElements(undoStack.current.pop()!);
    setCanUndo(undoStack.current.length > 0);
    setSelectedId(null); setEditingId(null);
    toast("↩ Undo", { duration: 700 });
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        e.preventDefault(); undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
        if (selectedId) { pushUndo(elements); setElements(p => p.filter(el => el.id !== selectedId)); setSelectedId(null); }
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, selectedId, elements, pushUndo]);

  // ── Render PDF page as image ───────────────────────────────────────────────
  useEffect(() => {
    setLoading(true); setBgImage(null);
    const render = async () => {
      try {
        const lib = (window as any).pdfjsLib;
        if (!lib) return;
        lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const url = URL.createObjectURL(pdfFile);
        const pdf = await lib.getDocument(url).promise;
        const pg = await pdf.getPage(page);
        const vp = pg.getViewport({ scale: 2 }); // high-res
        const cvs = document.createElement("canvas");
        cvs.width = vp.width; cvs.height = vp.height;
        setCanvasW(vp.width); setCanvasH(vp.height);
        await pg.render({ canvasContext: cvs.getContext("2d")!, viewport: vp }).promise;
        setBgImage(cvs.toDataURL("image/png"));
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
      setLoading(false);
    };
    if ((window as any).pdfjsLib) { render(); }
    else {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = render; document.head.appendChild(s);
    }
  }, [pdfFile, page]);

  // ── Element helpers ────────────────────────────────────────────────────────
  const updateEl = (id: string, updates: Partial<CanvasEl>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } as CanvasEl : el));
  };

  const deleteEl = (id: string) => {
    pushUndo(elements);
    setElements(prev => prev.filter(el => el.id !== id));
    setSelectedId(null); setEditingId(null);
  };

  const addText = (x: number, y: number) => {
    pushUndo(elements);
    const id = uid();
    const el: TextEl = {
      id, type: "text", x, y, width: 200, height: 50, rotation: 0, opacity: 1,
      content: "Click to edit text", fontSize: 18, fontFamily: "Helvetica",
      color: "#000000", bold: false, italic: false, underline: false, align: "left", bgColor: "",
    };
    setElements(prev => [...prev, el]);
    setSelectedId(id); setEditingId(id); setActiveTool("select");
  };

  const addShape = (x: number, y: number, shape: "rect" | "ellipse") => {
    pushUndo(elements);
    const id = uid();
    const el: ShapeEl = { id, type: "shape", x, y, width: 150, height: 80, rotation: 0, opacity: 0.8, shape, fill: "#fff176", stroke: "#333", strokeWidth: 1 };
    setElements(prev => [...prev, el]);
    setSelectedId(id); setActiveTool("select");
  };

  const addImage = (src: string) => {
    pushUndo(elements);
    const id = uid();
    const el: ImageEl = { id, type: "image", x: 80, y: 80, width: 200, height: 150, rotation: 0, opacity: 1, src };
    setElements(prev => [...prev, el]);
    setSelectedId(id); setActiveTool("select");
  };

  const addSignature = (src: string, x = 120, y = 120) => {
    pushUndo(elements);
    const id = uid();
    const el: ImageEl = { id, type: "signature", x, y, width: 220, height: 90, rotation: 0, opacity: 1, src };
    setElements(prev => [...prev, el]);
    setSelectedId(id);
  };

  // ── Canvas click ──────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);

  const toCanvas = (e: React.MouseEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvasW / r.width),
      y: (e.clientY - r.top) * (canvasH / r.height),
    };
  };

  const handleBgClick = (e: React.MouseEvent) => {
    if (editingId) return;
    const c = toCanvas(e);
    if (activeTool === "text") { addText(c.x, c.y); return; }
    if (activeTool === "rect") { addShape(c.x, c.y, "rect"); return; }
    if (activeTool === "ellipse") { addShape(c.x, c.y, "ellipse"); return; }
    if (activeTool === "signature") { (window as any)._sigPos = c; setShowSigPad(true); return; }
    setSelectedId(null);
  };

  // ── Drag move ─────────────────────────────────────────────────────────────
  const onElMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (editingId === id) return;
    setSelectedId(id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: elements.find(el => el.id === id)!.x, origY: elements.find(el => el.id === id)!.y };
  };

  const onResizeMouseDown = (e: React.MouseEvent, id: string, handle: string) => {
    e.stopPropagation();
    const el = elements.find(el => el.id === id)!;
    resizeRef.current = { id, handle, startX: e.clientX, startY: e.clientY, origW: el.width, origH: el.height, origX: el.x, origY: el.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    const scaleX = canvasW / r.width;
    const scaleY = canvasH / r.height;

    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) * scaleX;
      const dy = (e.clientY - dragRef.current.startY) * scaleY;
      updateEl(dragRef.current.id, { x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
    }

    if (resizeRef.current) {
      const { handle, startX, startY, origW, origH, origX, origY, id } = resizeRef.current;
      const dx = (e.clientX - startX) * scaleX;
      const dy = (e.clientY - startY) * scaleY;
      let w = origW, h = origH, x = origX, y = origY;
      if (handle.includes("e")) w = Math.max(40, origW + dx);
      if (handle.includes("s")) h = Math.max(20, origH + dy);
      if (handle.includes("w")) { w = Math.max(40, origW - dx); x = origX + (origW - w); }
      if (handle.includes("n")) { h = Math.max(20, origH - dy); y = origY + (origH - h); }
      updateEl(id, { width: w, height: h, x, y });
    }
  };

  const onMouseUp = () => {
    if (dragRef.current || resizeRef.current) {
      dragRef.current = null; resizeRef.current = null;
    }
  };

  // ── Export to PDF ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!bgImage) return;
    setSaving(true);
    try {
      // Load jsPDF dynamically
      if (!(window as any).jspdf) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
          s.onload = () => res(); s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      const cvs = document.createElement("canvas");
      cvs.width = canvasW; cvs.height = canvasH;
      const ctx = cvs.getContext("2d")!;

      // 1. Draw PDF page background
      const bg = new Image(); bg.src = bgImage;
      await new Promise(r => { bg.onload = r; });
      ctx.drawImage(bg, 0, 0, canvasW, canvasH);

      // 2. Draw each element
      for (const el of elements) {
        ctx.save();
        ctx.globalAlpha = el.opacity;
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-cx, -cy);

        if (el.type === "shape") {
          const se = el as ShapeEl;
          ctx.fillStyle = se.fill;
          ctx.strokeStyle = se.stroke;
          ctx.lineWidth = se.strokeWidth;
          if (se.shape === "rect") {
            ctx.fillRect(el.x, el.y, el.width, el.height);
            ctx.strokeRect(el.x, el.y, el.width, el.height);
          } else if (se.shape === "ellipse") {
            ctx.beginPath();
            ctx.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
          }
        }

        if (el.type === "text") {
          const te = el as TextEl;
          if (te.bgColor) { ctx.fillStyle = te.bgColor; ctx.fillRect(el.x, el.y, el.width, el.height); }
          const style = `${te.italic ? "italic " : ""}${te.bold ? "bold " : ""}${te.fontSize}px ${te.fontFamily}`;
          ctx.font = style;
          ctx.fillStyle = te.color;
          ctx.textAlign = te.align;
          const ax = te.align === "center" ? el.x + el.width / 2 : te.align === "right" ? el.x + el.width : el.x;
          // Word-wrap
          const words = te.content.split(" ");
          let line = ""; let lineY = el.y + te.fontSize;
          for (const word of words) {
            const test = line + word + " ";
            if (ctx.measureText(test).width > el.width && line) {
              ctx.fillText(line, ax, lineY);
              if (te.underline) { const m = ctx.measureText(line); ctx.fillRect(ax, lineY + 2, m.width, 1); }
              line = word + " "; lineY += te.fontSize * 1.3;
            } else { line = test; }
          }
          if (line) {
            ctx.fillText(line, ax, lineY);
            if (te.underline) { const m = ctx.measureText(line); ctx.fillRect(ax, lineY + 2, m.width, 1); }
          }
        }

        if (el.type === "image" || el.type === "signature") {
          const ie = el as ImageEl;
          const img = new Image(); img.src = ie.src;
          await new Promise(r => { img.onload = r; });
          ctx.drawImage(img, el.x, el.y, el.width, el.height);
        }

        ctx.restore();
      }

      // 3. Canvas → PDF via jsPDF
      const imgData = cvs.toDataURL("image/jpeg", 0.92);
      const { jsPDF } = (window as any).jspdf;
      const orientation = canvasW > canvasH ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [canvasW, canvasH] });
      pdf.addImage(imgData, "JPEG", 0, 0, canvasW, canvasH);
      pdf.save("edited_page.pdf");
      toast.success("PDF saved! 🎉");
    } catch (err) {
      console.error(err);
      toast.error("Error saving PDF");
    } finally { setSaving(false); }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  const selectedEl = elements.find(e => e.id === selectedId);

  const ResizeHandles = ({ id }: { id: string }) => {
    const handles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
    const posMap: Record<string, { top?: string; bottom?: string; left?: string; right?: string; transform: string }> = {
      n: { top: "-4px", left: "50%", transform: "translateX(-50%)" },
      s: { bottom: "-4px", left: "50%", transform: "translateX(-50%)" },
      e: { top: "50%", right: "-4px", transform: "translateY(-50%)" },
      w: { top: "50%", left: "-4px", transform: "translateY(-50%)" },
      ne: { top: "-4px", right: "-4px", transform: "" },
      nw: { top: "-4px", left: "-4px", transform: "" },
      se: { bottom: "-4px", right: "-4px", transform: "" },
      sw: { bottom: "-4px", left: "-4px", transform: "" },
    };
    return <>
      {handles.map(h => (
        <div key={h} onMouseDown={e => onResizeMouseDown(e, id, h)}
          style={{
            position: "absolute", width: HANDLE_SIZE, height: HANDLE_SIZE,
            background: "#ff4d1c", border: "1px solid #fff", borderRadius: 1,
            cursor: `${h}-resize`, zIndex: 10, boxSizing: "border-box",
            ...posMap[h],
          }}
        />
      ))}
    </>;
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", overflow: "hidden", flexDirection: "column" }}>

      {/* ── Top Bar ── */}
      <div style={{ height: 52, background: "#111", borderBottom: "1px solid #222", display: "flex", alignItems: "center", padding: "0 1rem", gap: "0.75rem", flexShrink: 0 }}>
        <button className="btn-ghost" onClick={onBack} style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}>← Back</button>
        <div style={{ width: 1, height: 24, background: "#333" }} />

        {/* Tools */}
        {([
          { id: "select", label: "↖ Select", title: "Select & Move" },
          { id: "text", label: "T Text", title: "Add text" },
          { id: "image", label: "🖼 Image", title: "Image upload" },
          { id: "rect", label: "▭ Box", title: "Rectangle shape" },
          { id: "ellipse", label: "◯ Circle", title: "Ellipse shape" },
          { id: "signature", label: "✍ Sign", title: "Signature draw" },
        ] as { id: typeof activeTool; label: string; title: string }[]).map(t => (
          <button key={t.id} title={t.title}
            onClick={() => {
              setActiveTool(t.id);
              if (t.id === "image") document.getElementById("img-upload")!.click();
            }}
            style={{
              background: activeTool === t.id ? "rgba(255,77,28,0.2)" : "transparent",
              border: `1px solid ${activeTool === t.id ? "var(--accent)" : "#333"}`,
              color: activeTool === t.id ? "var(--accent)" : "#999",
              padding: "0.3rem 0.75rem", fontSize: "0.8rem", cursor: "pointer",
              fontFamily: "Syne,sans-serif", fontWeight: 600, borderRadius: 3,
              transition: "all 0.15s",
            }}>{t.label}</button>
        ))}

        <input id="img-upload" type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => addImage(ev.target!.result as string); r.readAsDataURL(f); e.target.value = ""; }}
        />

        <div style={{ width: 1, height: 24, background: "#333" }} />

        {/* Page nav */}
        <button className="btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
        <span style={{ color: "#888", fontSize: "0.8rem", whiteSpace: "nowrap" }}>Page {page} / {pageCount}</span>
        <button className="btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem" }} disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}>›</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ color: "#666", fontSize: "0.7rem" }}>{elements.length} elements</span>
          <button className="btn-ghost" onClick={undo} disabled={!canUndo}
            style={{ fontSize: "0.75rem", borderColor: canUndo ? "#ff8c42" : "#333", color: canUndo ? "#ff8c42" : "#444" }}>
            ↩ Undo <span style={{ fontSize: "0.6rem" }}>Ctrl+Z</span>
          </button>
          <button className="btn-ghost" onClick={() => { pushUndo(elements); setElements([]); }} style={{ fontSize: "0.75rem" }}>Clear</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !bgImage}>
            {saving ? <span className="spinner" /> : "💾 PDF Save"}
          </button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, overflow: "auto", background: "#1a1a1a", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "2rem" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", marginTop: "4rem" }}>
            <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
            <span style={{ color: "#888" }}>Loading PDF page...</span>
          </div>
        ) : (
          <div ref={containerRef}
            style={{
              position: "relative",
              width: "min(850px, 88vw)",
              aspectRatio: `${canvasW} / ${canvasH}`,
              boxShadow: "0 8px 60px rgba(0,0,0,0.7)",
              cursor: activeTool === "select" ? "default" : "crosshair",
              userSelect: "none",
              flexShrink: 0,
            }}
            onClick={handleBgClick}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            {/* PDF background */}
            {bgImage && <img src={bgImage} alt="PDF" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />}

            {/* Elements */}
            {elements.map(el => {
              const isSelected = selectedId === el.id;
              const isEditing = editingId === el.id;

              const style: React.CSSProperties = {
                position: "absolute",
                left: pct(el.x, canvasW),
                top: pct(el.y, canvasH),
                width: pct(el.width, canvasW),
                height: pct(el.height, canvasH),
                opacity: el.opacity,
                transform: `rotate(${el.rotation}deg)`,
                boxSizing: "border-box",
                outline: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: isEditing ? "text" : "move",
                zIndex: isSelected ? 5 : 1,
              };

              if (el.type === "shape") {
                const se = el as ShapeEl;
                return (
                  <div key={el.id} style={style} onMouseDown={e => onElMouseDown(e, el.id)}>
                    <svg width="100%" height="100%" style={{ overflow: "visible" }}>
                      {se.shape === "rect" && <rect x={0} y={0} width="100%" height="100%" fill={se.fill} stroke={se.stroke} strokeWidth={se.strokeWidth} />}
                      {se.shape === "ellipse" && <ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={se.fill} stroke={se.stroke} strokeWidth={se.strokeWidth} />}
                    </svg>
                    {isSelected && <ResizeHandles id={el.id} />}
                  </div>
                );
              }

              if (el.type === "text") {
                const te = el as TextEl;
                const fsVw = (te.fontSize / canvasW) * 100;
                return (
                  <div key={el.id} style={{ ...style, overflow: "visible" }}
                    onMouseDown={e => { if (!isEditing) onElMouseDown(e, el.id); }}
                    onClick={e => { e.stopPropagation(); setSelectedId(el.id); }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingId(el.id); setSelectedId(el.id); }}
                  >
                    {/* Floating toolbar */}
                    {isSelected && !isEditing && (
                      <TextToolbar
                        el={te}
                        onChange={updates => updateEl(el.id, updates)}
                        onDelete={() => deleteEl(el.id)}
                      />
                    )}

                    {/* Inline textarea */}
                    {isEditing ? (
                      <textarea
                        autoFocus
                        value={te.content}
                        onChange={e => updateEl(el.id, { content: e.target.value })}
                        onBlur={() => setEditingId(null)}
                        onKeyDown={e => { if (e.key === "Escape") setEditingId(null); e.stopPropagation(); }}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: "100%", height: "100%", resize: "none",
                          background: te.bgColor || "rgba(255,255,255,0.9)",
                          border: "none", outline: "2px solid #ff8c42",
                          fontFamily: te.fontFamily,
                          fontWeight: te.bold ? 700 : 400,
                          fontStyle: te.italic ? "italic" : "normal",
                          textDecoration: te.underline ? "underline" : "none",
                          color: te.color,
                          fontSize: `${fsVw}vw`,
                          textAlign: te.align,
                          padding: "2px 4px",
                          lineHeight: 1.3,
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <div style={{
                        width: "100%", height: "100%",
                        fontFamily: te.fontFamily,
                        fontWeight: te.bold ? 700 : 400,
                        fontStyle: te.italic ? "italic" : "normal",
                        textDecoration: te.underline ? "underline" : "none",
                        color: te.color,
                        fontSize: `${fsVw}vw`,
                        textAlign: te.align,
                        background: te.bgColor || "transparent",
                        padding: "2px 4px",
                        lineHeight: 1.3,
                        overflow: "hidden",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        boxSizing: "border-box",
                      }}>
                        {te.content}
                      </div>
                    )}

                    {isSelected && !isEditing && <ResizeHandles id={el.id} />}
                  </div>
                );
              }

              if (el.type === "image" || el.type === "signature") {
                const ie = el as ImageEl;
                return (
                  <div key={el.id} style={style} onMouseDown={e => onElMouseDown(e, el.id)}>
                    <img src={ie.src} alt={el.type} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
                    {isSelected && <ResizeHandles id={el.id} />}
                    {isSelected && (
                      <button onClick={() => deleteEl(el.id)}
                        style={{ position: "absolute", top: -28, right: 0, background: "#ff4444", color: "#fff", border: "none", padding: "2px 6px", fontSize: "0.7rem", cursor: "pointer", borderRadius: 2 }}>
                        🗑 Delete
                      </button>
                    )}
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>

      {/* Signature pad */}
      {showSigPad && (
        <SignaturePad
          onSave={src => { const p = (window as any)._sigPos || { x: 100, y: 100 }; addSignature(src, p.x, p.y); }}
          onClose={() => { setShowSigPad(false); setActiveTool("select"); }}
        />
      )}

      {/* Bottom hint bar */}
      <div style={{ height: 28, background: "#0d0d0d", borderTop: "1px solid #1a1a1a", display: "flex", alignItems: "center", padding: "0 1rem", gap: "1.5rem" }}>
        {[
          "Click → Select",
          "Double click → Edit text",
          "Drag corners → Resize",
          "Delete key → Remove",
          "Ctrl+Z → Undo",
        ].map(tip => (
          <span key={tip} style={{ color: "#444", fontSize: "0.65rem" }}>{tip}</span>
        ))}
      </div>
    </div>
  );
}
