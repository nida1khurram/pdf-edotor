from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import tempfile, os, io
from pypdf import PdfWriter, PdfReader

router = APIRouter()

@router.post("/reorder")
async def reorder_pages(
    file: UploadFile = File(...),
    order: str = Form(...),  # e.g., "3,1,2,4" — new order of pages (1-indexed)
):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()
    
    try:
        reader = PdfReader(tmp.name)
        total = len(reader.pages)
        
        try:
            new_order = [int(x.strip()) - 1 for x in order.split(",")]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid page order format")
        
        # Validate
        for idx in new_order:
            if idx < 0 or idx >= total:
                raise HTTPException(status_code=400, detail=f"Page {idx+1} does not exist")
        
        writer = PdfWriter()
        for idx in new_order:
            writer.add_page(reader.pages[idx])
        
        out_buf = io.BytesIO()
        writer.write(out_buf)
        out_buf.seek(0)
        
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=reordered.pdf"}
        )
    finally:
        os.unlink(tmp.name)


@router.post("/get-info")
async def get_pdf_info(file: UploadFile = File(...)):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(await file.read())
    tmp.close()
    
    try:
        reader = PdfReader(tmp.name)
        return {
            "total_pages": len(reader.pages),
            "is_encrypted": reader.is_encrypted,
            "metadata": {
                "title": reader.metadata.title if reader.metadata else None,
                "author": reader.metadata.author if reader.metadata else None,
                "creator": reader.metadata.creator if reader.metadata else None,
            }
        }
    finally:
        os.unlink(tmp.name)
