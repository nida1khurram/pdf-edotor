from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
import tempfile, os, io, json, shutil

router = APIRouter()


def _int_color_to_rgb(color_int: int):
    """PyMuPDF integer color → (r, g, b) 0–1 range."""
    r = ((color_int >> 16) & 0xFF) / 255
    g = ((color_int >> 8) & 0xFF) / 255
    b = (color_int & 0xFF) / 255
    return (r, g, b)


def _get_font_name(font_str: str) -> str:
    f = font_str.lower()
    if "bold" in f and ("italic" in f or "oblique" in f):
        return "hebi"
    if "bold" in f:
        return "hebo"
    if "italic" in f or "oblique" in f:
        return "heoi"
    return "helv"


@router.post("/extract-text-blocks")
async def extract_text_blocks(file: UploadFile = File(...)):
    """
    PDF se har page ka text extract karo.
    Response: { total_pages, pages: [{page, text, has_text}] }
    """
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Sirf PDF files allowed hain")

    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        try:
            import fitz
        except ImportError:
            raise HTTPException(500, "PyMuPDF install nahi hai — uv add pymupdf chalao")

        try:
            doc = fitz.open(pdf_path)
            pages = []
            for i, page in enumerate(doc):
                text = page.get_text("text").strip()
                pages.append({"page": i + 1, "text": text, "has_text": bool(text)})
            doc.close()
        except Exception as e:
            raise HTTPException(500, f"PDF parse error: {str(e)}")

        return JSONResponse({"total_pages": len(pages), "pages": pages})
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/replace-text")
async def replace_text(
    file: UploadFile = File(...),
    replacements_json: str = Form(...),
):
    """
    PDF mein text find karke replace karo.

    replacements_json: [{"find": "purana text", "replace": "naya text"}, ...]

    Steps per page:
      1. Har pair ke liye page.search_for() se rects + font info collect karo
      2. Saare rects ko redact karo (white box)
      3. Naya text same position pe insert karo
    """
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Sirf PDF files allowed hain")

    try:
        replacements = json.loads(replacements_json)
        if not isinstance(replacements, list):
            raise ValueError()
    except Exception:
        raise HTTPException(400, "replacements_json invalid format")

    # Sirf valid pairs rakhein
    replacements = [r for r in replacements if str(r.get("find", "")).strip()]
    if not replacements:
        raise HTTPException(400, "Koi valid replacement pair nahi")

    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        out_path = os.path.join(tmp_dir, "output.pdf")
        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        try:
            import fitz
        except ImportError:
            raise HTTPException(500, "PyMuPDF install nahi hai — pip install PyMuPDF")

        try:
            doc = fitz.open(pdf_path)
        except Exception as e:
            raise HTTPException(500, f"PDF open error: {str(e)}")

        try:
            for page in doc:
                # Step 1: Saare replacements ke liye positions + font info collect karo
                jobs = []  # (rect, new_text, font_size, color_rgb, font_name)
                blocks = page.get_text("dict").get("blocks", [])

                for pair in replacements:
                    find_text = str(pair["find"])
                    new_text = str(pair.get("replace", ""))
                    rects = page.search_for(find_text)

                    for rect in rects:
                        # Default font info
                        font_size, color_rgb, font_name = 11.0, (0.0, 0.0, 0.0), "helv"

                        # Matching span se font info lo
                        for block in blocks:
                            if block.get("type") != 0:
                                continue
                            for line in block.get("lines", []):
                                for span in line.get("spans", []):
                                    if fitz.Rect(span["bbox"]).intersects(rect):
                                        font_size = span.get("size", 11.0)
                                        color_rgb = _int_color_to_rgb(span.get("color", 0))
                                        font_name = _get_font_name(span.get("font", ""))
                                        break

                        jobs.append((rect, new_text, font_size, color_rgb, font_name))

                # Step 2: Purana text redact (white background se dhako)
                for rect, _, _, _, _ in jobs:
                    page.add_redact_annot(rect, fill=(1, 1, 1))
                if jobs:
                    page.apply_redactions()

                # Step 3: Naya text insert karo
                for rect, new_text, font_size, color_rgb, font_name in jobs:
                    if new_text:
                        try:
                            page.insert_text(
                                fitz.Point(rect.x0, rect.y1 - 1),
                                new_text,
                                fontname=font_name,
                                fontsize=font_size,
                                color=color_rgb,
                            )
                        except Exception:
                            # Font fail hone pe helv (Helvetica) fallback
                            page.insert_text(
                                fitz.Point(rect.x0, rect.y1 - 1),
                                new_text,
                                fontname="helv",
                                fontsize=font_size,
                                color=color_rgb,
                            )

            doc.save(out_path)
            doc.close()
        except HTTPException:
            raise
        except Exception as e:
            doc.close()
            raise HTTPException(500, f"PDF edit error: {str(e)}")

        with open(out_path, "rb") as f:
            content = f.read()

        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=edited.pdf"},
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/extract-blocks-with-positions")
async def extract_blocks_with_positions(file: UploadFile = File(...)):
    """
    PDF se har page ke text blocks extract karo with positions.
    Response: { total_pages, pages: [{page, width, height, blocks: [{id, text, x0, y0, x1, y1}]}] }
    """
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Sirf PDF files allowed hain")

    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        try:
            import fitz
        except ImportError:
            raise HTTPException(500, "PyMuPDF install nahi hai — uv add pymupdf chalao")

        try:
            doc = fitz.open(pdf_path)
            result = []
            for i, page in enumerate(doc):
                pw, ph = page.rect.width, page.rect.height
                raw = page.get_text("blocks")  # (x0,y0,x1,y1,text,block_no,type)
                blocks = []
                for b in raw:
                    if b[6] == 0 and b[4].strip():  # type 0 = text, skip empty
                        blocks.append({
                            "id": f"p{i+1}_b{b[5]}",
                            "text": b[4].strip(),
                            "x0": b[0], "y0": b[1], "x1": b[2], "y1": b[3],
                        })
                result.append({"page": i + 1, "width": pw, "height": ph, "blocks": blocks})
            doc.close()
        except Exception as e:
            raise HTTPException(500, f"PDF parse error: {str(e)}")

        return JSONResponse({"total_pages": len(result), "pages": result})
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
