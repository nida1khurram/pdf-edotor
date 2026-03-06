from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import tempfile, os
from pypdf import PdfWriter, PdfReader

router = APIRouter()

@router.post("/merge")
async def merge_pdfs(files: list[UploadFile] = File(...)):
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="At least 2 PDF files required")
    
    writer = PdfWriter()
    tmp_inputs = []
    
    try:
        for file in files:
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            tmp.write(await file.read())
            tmp.close()
            tmp_inputs.append(tmp.name)
            reader = PdfReader(tmp.name)
            for page in reader.pages:
                writer.add_page(page)
        
        output = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        writer.write(output)
        output.close()
        
        return FileResponse(
            output.name,
            media_type="application/pdf",
            filename="merged_output.pdf",
            headers={"Content-Disposition": "attachment; filename=merged_output.pdf"}
        )
    finally:
        for f in tmp_inputs:
            try: os.unlink(f)
            except: pass
