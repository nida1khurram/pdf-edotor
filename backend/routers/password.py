from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
import tempfile, os, io, shutil
import pikepdf

router = APIRouter()


@router.post("/protect")
async def protect_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
    owner_password: str = Form(None),
):
    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        with pikepdf.open(pdf_path) as pdf:
            out_buf = io.BytesIO()
            permissions = pikepdf.Permissions(
                extract=False,
                modify_annotation=False,
                modify_assembly=False,
                modify_form=False,
                modify_other=False,
                print_highres=True,
                print_lowres=True,
            )
            pdf.save(
                out_buf,
                encryption=pikepdf.Encryption(
                    user=password,
                    owner=owner_password or password,
                    R=6,
                    allow=permissions,
                )
            )

        out_buf.seek(0)
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=protected.pdf"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"PDF protect error: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


@router.post("/unlock")
async def unlock_pdf(
    file: UploadFile = File(...),
    password: str = Form(...),
):
    tmp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(tmp_dir, "input.pdf")
        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        try:
            with pikepdf.open(pdf_path, password=password) as pdf:
                out_buf = io.BytesIO()
                pdf.save(out_buf)
        except pikepdf.PasswordError:
            raise HTTPException(status_code=400, detail="Wrong password — galat password hai")

        out_buf.seek(0)
        return StreamingResponse(
            out_buf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=unlocked.pdf"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"PDF unlock error: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
