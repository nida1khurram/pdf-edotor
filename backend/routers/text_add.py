from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import tempfile, os, io
from pypdf import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor

router = APIRouter()

@router.post("/add-text")
async def add_text(
    file: UploadFile = File(...),
    text: str = Form(...),
    page_num: int = Form(1),
    x: float = Form(100),
    y: float = Form(100),
    font_size: int = Form(12),
    color: str = Form("#000000"),
    bold: bool = Form(False),
    italic: bool = Form(False),
):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()
    
    try:
        reader = PdfReader(tmp.name)
        total = len(reader.pages)
        page_idx = min(page_num - 1, total - 1)
        
        # Get page dimensions
        page = reader.pages[page_idx]
        pw = float(page.mediabox.width)
        ph = float(page.mediabox.height)
        
        # Create text overlay
        overlay_buf = io.BytesIO()
        c = canvas.Canvas(overlay_buf, pagesize=(pw, ph))
        
        # Font selection
        if bold and italic:
            font = "Helvetica-BoldOblique"
        elif bold:
            font = "Helvetica-Bold"
        elif italic:
            font = "Helvetica-Oblique"
        else:
            font = "Helvetica"
        
        try:
            hex_color = color.lstrip("#")
            r = int(hex_color[0:2], 16) / 255
            g = int(hex_color[2:4], 16) / 255
            b = int(hex_color[4:6], 16) / 255
        except:
            r, g, b = 0, 0, 0
        
        c.setFillColorRGB(r, g, b)
        c.setFont(font, font_size)
        c.drawString(x, ph - y, text)  # flip y-axis
        c.save()
        overlay_buf.seek(0)
        
        # Merge overlay with original pages
        overlay_reader = PdfReader(overlay_buf)
        writer = PdfWriter()
        
        for i, orig_page in enumerate(reader.pages):
            if i == page_idx:
                orig_page.merge_page(overlay_reader.pages[0])
            writer.add_page(orig_page)
        
        out_buf = io.BytesIO()
        writer.write(out_buf)
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=text_added.pdf"}
        )
    finally:
        os.unlink(tmp.name)


@router.post("/add-image")
async def add_image(
    file: UploadFile = File(...),
    image: UploadFile = File(...),
    page_num: int = Form(1),
    x: float = Form(100),
    y: float = Form(100),
    width: float = Form(200),
    height: float = Form(150),
):
    tmp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp_pdf.write(await file.read())
    tmp_pdf.close()
    
    img_bytes = await image.read()
    img_ext = image.filename.split(".")[-1].lower()
    tmp_img = tempfile.NamedTemporaryFile(delete=False, suffix=f".{img_ext}")
    tmp_img.write(img_bytes)
    tmp_img.close()
    
    try:
        reader = PdfReader(tmp_pdf.name)
        total = len(reader.pages)
        page_idx = min(page_num - 1, total - 1)
        
        page = reader.pages[page_idx]
        pw = float(page.mediabox.width)
        ph = float(page.mediabox.height)
        
        overlay_buf = io.BytesIO()
        c = canvas.Canvas(overlay_buf, pagesize=(pw, ph))
        c.drawImage(tmp_img.name, x, ph - y - height, width=width, height=height, preserveAspectRatio=True)
        c.save()
        overlay_buf.seek(0)
        
        overlay_reader = PdfReader(overlay_buf)
        writer = PdfWriter()
        
        for i, orig_page in enumerate(reader.pages):
            if i == page_idx:
                orig_page.merge_page(overlay_reader.pages[0])
            writer.add_page(orig_page)
        
        out_buf = io.BytesIO()
        writer.write(out_buf)
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=image_added.pdf"}
        )
    finally:
        os.unlink(tmp_pdf.name)
        os.unlink(tmp_img.name)
