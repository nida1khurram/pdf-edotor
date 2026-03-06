from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import tempfile, os, io, json, base64
from pypdf import PdfWriter, PdfReader
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
from PIL import Image as PILImage

router = APIRouter()


def hex_to_rgb(hex_color: str):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) / 255 for i in (0, 2, 4))


@router.post("/apply-canvas-edits")
async def apply_canvas_edits(
    file: UploadFile = File(...),
    edits_json: str = Form(...),  # JSON string of all edits
    page_width: float = Form(595),
    page_height: float = Form(842),
):
    """
    Apply all canvas edits (text, images, highlights, signatures) to PDF.
    
    edits_json format:
    [
      {
        "type": "text",
        "page": 1,
        "x": 100, "y": 100,        # in canvas px coords
        "text": "Hello",
        "fontSize": 16,
        "color": "#000000",
        "bold": false,
        "italic": false,
        "canvasWidth": 800,         # canvas display width
        "canvasHeight": 1000        # canvas display height
      },
      {
        "type": "image",
        "page": 1,
        "x": 50, "y": 200,
        "width": 150, "height": 100,
        "dataUrl": "data:image/png;base64,...",
        "canvasWidth": 800,
        "canvasHeight": 1000
      },
      {
        "type": "highlight",
        "page": 1,
        "x": 50, "y": 300,
        "width": 200, "height": 20,
        "color": "#ffff00",
        "opacity": 0.4,
        "canvasWidth": 800,
        "canvasHeight": 1000
      },
      {
        "type": "signature",
        "page": 1,
        "x": 100, "y": 400,
        "width": 200, "height": 80,
        "dataUrl": "data:image/png;base64,...",
        "canvasWidth": 800,
        "canvasHeight": 1000
      }
    ]
    """
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()

    try:
        edits = json.loads(edits_json)
        reader = PdfReader(tmp.name)
        writer = PdfWriter()

        # Group edits by page
        edits_by_page = {}
        for edit in edits:
            pg = edit.get("page", 1) - 1
            edits_by_page.setdefault(pg, []).append(edit)

        for page_idx, page in enumerate(reader.pages):
            pdf_w = float(page.mediabox.width)
            pdf_h = float(page.mediabox.height)

            page_edits = edits_by_page.get(page_idx, [])

            if page_edits:
                overlay_buf = io.BytesIO()
                c = canvas.Canvas(overlay_buf, pagesize=(pdf_w, pdf_h))

                for edit in page_edits:
                    canvas_w = edit.get("canvasWidth", 800)
                    canvas_h = edit.get("canvasHeight", 1000)
                    scale_x = pdf_w / canvas_w
                    scale_y = pdf_h / canvas_h

                    # Convert canvas coords → PDF coords (flip Y axis)
                    cx = edit["x"] * scale_x
                    cy = pdf_h - edit["y"] * scale_y

                    etype = edit["type"]

                    if etype == "text":
                        r, g, b = hex_to_rgb(edit.get("color", "#000000"))
                        c.setFillColorRGB(r, g, b)
                        fs = edit.get("fontSize", 14)
                        bold = edit.get("bold", False)
                        italic = edit.get("italic", False)
                        if bold and italic:
                            font = "Helvetica-BoldOblique"
                        elif bold:
                            font = "Helvetica-Bold"
                        elif italic:
                            font = "Helvetica-Oblique"
                        else:
                            font = "Helvetica"
                        c.setFont(font, fs * scale_x)
                        c.drawString(cx, cy - fs * scale_y, edit.get("text", ""))

                    elif etype in ("image", "signature"):
                        data_url = edit.get("dataUrl", "")
                        if "," in data_url:
                            img_data = base64.b64decode(data_url.split(",")[1])
                            img = PILImage.open(io.BytesIO(img_data))
                            tmp_img = tempfile.NamedTemporaryFile(delete=False, suffix=".png")
                            img.save(tmp_img.name, "PNG")
                            tmp_img.close()
                            iw = edit.get("width", 150) * scale_x
                            ih = edit.get("height", 100) * scale_y
                            c.drawImage(tmp_img.name, cx, cy - ih, width=iw, height=ih,
                                        preserveAspectRatio=True, mask="auto")
                            os.unlink(tmp_img.name)

                    elif etype == "highlight":
                        r, g, b = hex_to_rgb(edit.get("color", "#ffff00"))
                        opacity = edit.get("opacity", 0.4)
                        c.setFillColor(Color(r, g, b, alpha=opacity))
                        hw = edit.get("width", 100) * scale_x
                        hh = edit.get("height", 20) * scale_y
                        c.rect(cx, cy - hh, hw, hh, fill=1, stroke=0)

                c.save()
                overlay_buf.seek(0)
                overlay_reader = PdfReader(overlay_buf)
                page.merge_page(overlay_reader.pages[0])

            writer.add_page(page)

        out_buf = io.BytesIO()
        writer.write(out_buf)
        out_buf.seek(0)

        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=edited.pdf"}
        )
    finally:
        os.unlink(tmp.name)
