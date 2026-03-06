---
title: PDF Editor Backend
emoji: 📄
colorFrom: orange
colorTo: red
sdk: docker
pinned: false
app_port: 7860
---

# 📄 PDF Editor Pro v2.0
## Canvas Editor + All PDF Tools

---

## 🎨 NEW: Canvas Editor Features

| Feature | Description |
|---|---|
| ↖ **Select Tool** | Edits ko drag karein kisi bhi jagah |
| T **Text Add** | Click karein → text likhen → bold/italic/color |
| ◧ **Highlight** | Mouse drag karein → highlight ban jaye |
| ⬜ **Image Upload** | Image upload karein → PDF pe place karein |
| ✍️ **Signature** | Canvas pe draw karein → PDF mein embed |

---

## 🚀 Setup — 2 Commands

### Backend (Terminal 1)
```bash
cd backend
pip install -r requirements.txt
python main.py
# → http://localhost:8000
# → Docs: http://localhost:8000/docs
```

### Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 📁 Project Structure

```
pdf-editor-v2/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── routers/
│       ├── canvas_edit.py   ← NEW: Canvas edits apply karna
│       ├── merge.py
│       ├── split.py
│       ├── watermark.py
│       ├── password.py
│       ├── text_add.py
│       └── reorder.py
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx       ← Main app + Canvas launcher
        │   ├── layout.tsx
        │   └── globals.css
        └── components/
            └── CanvasEditor.tsx  ← NEW: Full drag & drop editor
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/pdf/apply-canvas-edits` | **NEW**: Canvas edits PDF pe apply |
| POST | `/api/pdf/merge` | PDFs merge |
| POST | `/api/pdf/split` | Pages extract (ZIP) |
| POST | `/api/pdf/delete-pages` | Pages delete |
| POST | `/api/pdf/reorder` | Pages reorder |
| POST | `/api/pdf/watermark` | Watermark add |
| POST | `/api/pdf/protect` | Password lagao |
| POST | `/api/pdf/unlock` | Password hatao |
| POST | `/api/pdf/get-info` | PDF info |

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind, PDF.js (CDN)
- **Backend**: FastAPI, Python, pypdf, pikepdf, reportlab, Pillow

---

## 📝 Canvas Editor Usage

1. **Canvas Editor tab** → PDF upload karein
2. **Canvas Editor Kholein** → Full screen editor khulega
3. Tool select karein (Text / Highlight / Image / Signature)
4. PDF page pe click/drag karein
5. **💾 PDF Save** → Download ho jayegi
