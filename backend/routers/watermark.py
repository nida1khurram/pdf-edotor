from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import tempfile, os, io
from pypdf import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color

router = APIRouter()

def create_watermark(text: str, opacity: float = 0.3, color: str = "gray") -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    w, h = letter
    
    color_map = {
        "gray": (0.5, 0.5, 0.5),
        "red": (1, 0, 0),
        "blue": (0, 0, 1),
        "black": (0, 0, 0),
    }
    r, g, b = color_map.get(color, (0.5, 0.5, 0.5))
    c.setFillColor(Color(r, g, b, alpha=opacity))
    c.setFont("Helvetica-Bold", 60)
    c.saveState()
    c.translate(w/2, h/2)
    c.rotate(45)
    c.drawCentredString(0, 0, text)
    c.restoreState()
    c.save()
    buf.seek(0)
    return buf.read()

@router.post("/watermark")
async def add_watermark(
    file: UploadFile = File(...),
    text: str = Form("CONFIDENTIAL"),
    opacity: float = Form(0.3),
    color: str = Form("gray"),
):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()
    
    try:
        wm_bytes = create_watermark(text, opacity, color)
        wm_reader = PdfReader(io.BytesIO(wm_bytes))
        wm_page = wm_reader.pages[0]
        
        reader = PdfReader(tmp.name)
        writer = PdfWriter()
        
        for page in reader.pages:
            page.merge_page(wm_page)
            writer.add_page(page)
        
        out_buf = io.BytesIO()
        writer.write(out_buf)
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=watermarked.pdf"}
        )
    finally:
        os.unlink(tmp.name)
