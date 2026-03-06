from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import uvicorn
import os
import tempfile
import shutil
from routers import merge, split, watermark, password, text_add, reorder, canvas_edit, ocr, text_edit, elements_add

app = FastAPI(title="PDF Editor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(merge.router, prefix="/api/pdf", tags=["Merge"])
app.include_router(split.router, prefix="/api/pdf", tags=["Split"])
app.include_router(watermark.router, prefix="/api/pdf", tags=["Watermark"])
app.include_router(password.router, prefix="/api/pdf", tags=["Password"])
app.include_router(text_add.router, prefix="/api/pdf", tags=["Text"])
app.include_router(reorder.router, prefix="/api/pdf", tags=["Reorder"])
app.include_router(canvas_edit.router, prefix="/api/pdf", tags=["Canvas Editor"])
app.include_router(ocr.router, prefix="/api/pdf", tags=["OCR"])
app.include_router(text_edit.router, prefix="/api/pdf", tags=["Text Edit"])
app.include_router(elements_add.router, prefix="/api/pdf", tags=["Elements"])

@app.get("/")
def root():
    return {"message": "PDF Editor API is running!", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
