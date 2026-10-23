import os
import time
import uuid

from dotenv import load_dotenv

load_dotenv()

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from agent import research, to_structured
from pdf_builder import build_pdf

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
os.makedirs("reports", exist_ok=True)

# In-memory job store (cleared when the server restarts)
JOBS = {}
MAX_JOBS = 50


class Req(BaseModel):
    company: str


def friendly_error(e: Exception) -> str:
    text = str(e)
    low = text.lower()
    if "rate_limit" in low or "429" in low or "413" in low:
        return "Groq rate limit reached. Wait a minute and try again."
    return text[:300] or "The agent failed."


def run_job(job_id: str, company: str):
    job = JOBS[job_id]
    started = time.time()

    def emit(kind: str, text: str):
        job["events"].append({"t": int(time.time() - started), "kind": kind, "text": text})

    def should_stop() -> bool:
        return job["cancelled"]

    try:
        emit("info", f"Starting research on {company}")
        notes = research(company, emit=emit, should_stop=should_stop)
        emit("write", "Structuring the findings into a report")
        report = to_structured(notes)
        emit("pdf", "Building the PDF")
        rid = uuid.uuid4().hex
        build_pdf(report, f"reports/{rid}.pdf")
        job["report_id"] = rid
        job["download_url"] = f"http://localhost:8000/download/{rid}"
        job["status"] = "done"
        emit("done", "Report ready")
    except Exception as e:
        if job["cancelled"]:
            job["status"] = "cancelled"
            emit("info", "Cancelled")
        else:
            job["status"] = "error"
            job["error"] = friendly_error(e)
            emit("error", job["error"])


@app.post("/research")
def start_research(req: Req, background: BackgroundTasks):
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {
        "status": "running",
        "events": [],
        "error": None,
        "report_id": None,
        "download_url": None,
        "cancelled": False,
    }
    # keep the store small
    while len(JOBS) > MAX_JOBS:
        JOBS.pop(next(iter(JOBS)))
    background.add_task(run_job, job_id, req.company)
    return {"job_id": job_id}


@app.get("/status/{job_id}")
def job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    return {k: v for k, v in job.items() if k != "cancelled"}


@app.post("/cancel/{job_id}")
def cancel_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    job["cancelled"] = True
    return {"ok": True}


@app.get("/download/{rid}")
def download(rid: str):
    path = f"reports/{rid}.pdf"
    if not rid.isalnum() or not os.path.exists(path):
        raise HTTPException(404, "Not found")
    return FileResponse(path, media_type="application/pdf", filename="company_report.pdf")