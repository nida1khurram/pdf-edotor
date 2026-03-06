from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import tempfile, os, io, json, shutil, base64

router = APIRouter()


def _hex_to_rgb(hex_color: str):
    """#RRGGBB → (r, g, b) 0–1 range"""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) < 6:
        return (0.0, 0.0, 0.0)
    r = int(hex_color[0:2], 16) / 255
    g = int(hex_color[2:4], 16) / 255
    b = int(hex_color[4:6], 16) / 255
    return (r, g, b)


@router.post("/apply-elements")
async def apply_elements(
    file: UploadFile = File(...),
    elements_json: str = Form(...),
):
    """
    PDF mein text aur image elements add karo.

    elements_json format:
    [
      {"type":"text","page":1,"x":50,"y":100,"text":"Hello","font_size":14,
       "bold":false,"italic":false,"color":"#000000"},
      {"type":"image","page":1,"x":50,"y":200,"width":200,"height":150,
       "image_data":"base64..."}
    ]

    Coordinates: x/y = points from page top-left.
    A4 = 595×842 pts, Letter = 612×792 pts. 1 inch = 72 pts.
    Y for text = baseline position (text upar dikhega).
    """
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Sirf PDF files allowed hain")

    try:
        elements = json.loads(elements_json)
        if not isinstance(elements, list) or not elements:
            raise ValueError()
    except Exception:
        raise HTTPException(400, "elements_json invalid format")

    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        out_path = os.path.join(tmp_dir, "output.pdf")

        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        try:
            import fitz
        except ImportError:
            raise HTTPException(500, "PyMuPDF install nahi — uv add pymupdf chalao")

        try:
            doc = fitz.open(pdf_path)
        except Exception as e:
            raise HTTPException(500, f"PDF open error: {str(e)}")

        total_pages = len(doc)

        try:
            for i, elem in enumerate(elements):
                page_num = int(elem.get("page", 1)) - 1
                if page_num < 0 or page_num >= total_pages:
                    continue

                page = doc[page_num]
                x = float(elem.get("x", 50))
                y = float(elem.get("y", 100))
                elem_type = elem.get("type", "")

                if elem_type == "text":
                    text = str(elem.get("text", "")).strip()
                    if not text:
                        continue

                    font_size = max(6.0, float(elem.get("font_size", 12)))
                    bold = bool(elem.get("bold", False))
                    italic = bool(elem.get("italic", False))
                    color_rgb = _hex_to_rgb(str(elem.get("color", "#000000")))

                    if bold and italic:
                        fontname = "hebi"
                    elif bold:
                        fontname = "hebo"
                    elif italic:
                        fontname = "heoi"
                    else:
                        fontname = "helv"

                    try:
                        page.insert_text(
                            fitz.Point(x, y),
                            text,
                            fontname=fontname,
                            fontsize=font_size,
                            color=color_rgb,
                        )
                    except Exception:
                        # Font fail → helv fallback
                        page.insert_text(
                            fitz.Point(x, y),
                            text,
                            fontname="helv",
                            fontsize=font_size,
                            color=color_rgb,
                        )

                elif elem_type == "image":
                    img_b64 = str(elem.get("image_data", ""))
                    if not img_b64:
                        continue

                    # Data-URL prefix remove karo
                    if "," in img_b64:
                        img_b64 = img_b64.split(",", 1)[1]

                    try:
                        img_bytes = base64.b64decode(img_b64)
                    except Exception:
                        continue

                    width = max(10.0, float(elem.get("width", 150)))
                    height = max(10.0, float(elem.get("height", 100)))
                    rect = fitz.Rect(x, y, x + width, y + height)

                    try:
                        page.insert_image(rect, stream=img_bytes)
                    except Exception as e:
                        raise HTTPException(500, f"Image {i + 1} insert error: {str(e)}")

            doc.save(out_path)
            doc.close()

        except HTTPException:
            raise
        except Exception as e:
            try:
                doc.close()
            except Exception:
                pass
            raise HTTPException(500, f"PDF edit error: {str(e)}")

        with open(out_path, "rb") as f:
            content = f.read()

        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=with_elements.pdf"},
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
