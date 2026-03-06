from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import tempfile, os, shutil

router = APIRouter()


def _render_pages(pdf_path: str, dpi: int = 150):
    """PDF pages ko PIL Images mein convert karo using PyMuPDF."""
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    images = []
    zoom = dpi / 72  # 72 DPI base
    mat = fitz.Matrix(zoom, zoom)
    for page in doc:
        pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
        from PIL import Image
        import io
        img_bytes = pix.tobytes("png")
        images.append(Image.open(io.BytesIO(img_bytes)))
    doc.close()
    return images


def _ocr_image(img) -> str:
    """Ek PIL Image se OCR text extract karo."""
    try:
        import pytesseract
        # Windows mein Tesseract default path
        if os.name == "nt":
            candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            ]
            for p in candidates:
                if os.path.exists(p):
                    pytesseract.pytesseract.tesseract_cmd = p
                    break
        return pytesseract.image_to_string(img, lang="eng+urd").strip()
    except Exception as e:
        raise RuntimeError(f"Tesseract OCR error: {e}")


@router.post("/ocr-extract")
async def ocr_extract(file: UploadFile = File(...)):
    """
    PDF upload karo → har page ka OCR text wapas milega.
    Response: { "total_pages": N, "pages": [{"page": 1, "text": "..."}, ...] }
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Sirf PDF files allowed hain")

    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        content = await file.read()
        with open(pdf_path, "wb") as f:
            f.write(content)

        # Pages render karo
        try:
            images = _render_pages(pdf_path, dpi=150)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF render error: {e}")

        # OCR run karo
        results = []
        for idx, img in enumerate(images):
            try:
                text = _ocr_image(img)
            except RuntimeError as e:
                raise HTTPException(status_code=500, detail=str(e))
            results.append({"page": idx + 1, "text": text})

        return JSONResponse({
            "total_pages": len(results),
            "pages": results
        })

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
