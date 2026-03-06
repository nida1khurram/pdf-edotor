from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import tempfile, os, io, zipfile
from pypdf import PdfWriter, PdfReader

router = APIRouter()

@router.post("/split")
async def split_pdf(
    file: UploadFile = File(...),
    pages: str = Form(...),  # e.g., "1,3,5-7" or "all"
):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()
    
    try:
        reader = PdfReader(tmp.name)
        total = len(reader.pages)
        
        # Parse page ranges
        page_nums = set()
        if pages.strip() == "all":
            page_nums = set(range(total))
        else:
            for part in pages.split(","):
                part = part.strip()
                if "-" in part:
                    a, b = part.split("-")
                    page_nums.update(range(int(a)-1, int(b)))
                else:
                    page_nums.add(int(part)-1)
        
        page_nums = sorted([p for p in page_nums if 0 <= p < total])
        
        # Create ZIP with individual pages
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, pg in enumerate(page_nums):
                writer = PdfWriter()
                writer.add_page(reader.pages[pg])
                page_buf = io.BytesIO()
                writer.write(page_buf)
                zf.writestr(f"page_{pg+1}.pdf", page_buf.getvalue())
        
        zip_buffer.seek(0)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=split_pages.zip"}
        )
    finally:
        os.unlink(tmp.name)


@router.post("/delete-pages")
async def delete_pages(
    file: UploadFile = File(...),
    pages: str = Form(...),  # comma-separated 1-indexed page numbers to DELETE
):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()
    
    try:
        reader = PdfReader(tmp.name)
        total = len(reader.pages)
        
        delete_set = set()
        for part in pages.split(","):
            part = part.strip()
            if part:
                delete_set.add(int(part) - 1)
        
        writer = PdfWriter()
        for i, page in enumerate(reader.pages):
            if i not in delete_set:
                writer.add_page(page)
        
        out_buf = io.BytesIO()
        writer.write(out_buf)
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=deleted_pages.pdf"}
        )
    finally:
        os.unlink(tmp.name)
