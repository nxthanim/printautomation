import os
import uuid
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db, init_db
from models import Client, Printer, Order, JobAssignment, JobLog, JobStatus, OrderStatus, PrinterStatus
from schemas import (
    RegisterRequest, RegisterResponse, OrderResponse,
    JobPendingResponse, JobStatusUpdate, JobStatusResponse,
    PrinterStatusResponse, DashboardData,
)
from load_balancer import load_balancer
from tasks import generate_receipt, send_email_notification

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("print_automation.server")

security = HTTPBearer(auto_error=False)

web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.pdf_storage, exist_ok=True)
    os.makedirs(settings.receipt_storage, exist_ok=True)
    await init_db()
    logger.info("Server started: pdf_storage=%s, receipt_storage=%s", settings.pdf_storage, settings.receipt_storage)
    yield
    logger.info("Server shutting down")


app = FastAPI(
    title="Print Automation Server",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

if os.path.isdir(web_dir):
    app.mount("/web", StaticFiles(directory=web_dir, html=True), name="web")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def verify_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Client | None:
    if credentials is None:
        return None
    result = await db.execute(
        select(Client).where(Client.api_token == credentials.credentials)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or expired API token")
    client.last_seen = datetime.now(timezone.utc)
    await db.flush()
    return client


async def require_token(client: Client | None = Depends(verify_token)) -> Client:
    if client is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return client


@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = os.path.join(web_dir, "index.html")
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as f:
            return HTMLResponse(f.read())
    return HTMLResponse("<h1>Print Automation Server</h1><p>Web dashboard not found.</p>")


@app.post("/api/register", response_model=RegisterResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if not req.client_name.strip():
        raise HTTPException(status_code=400, detail="Client name is required")
    if not req.api_token.strip() or len(req.api_token) < 8:
        raise HTTPException(status_code=400, detail="API token must be at least 8 characters")
    existing = await db.execute(
        select(Client).where(Client.api_token == req.api_token)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="API token already in use")

    client = Client(name=req.client_name.strip(), api_token=req.api_token.strip())
    db.add(client)
    await db.flush()

    for printer_name in req.printers:
        if not printer_name.strip():
            continue
        printer = Printer(name=printer_name.strip(), client_id=client.id)
        db.add(printer)

    await db.commit()
    await db.refresh(client)
    logger.info("Client registered: %s (id=%s, printers=%d)", client.name, client.id, len(req.printers))
    return RegisterResponse(client_id=str(client.id), message="Registered successfully")


@app.post("/api/orders", response_model=OrderResponse)
async def create_order(
    customer_name: str = Form(..., min_length=1),
    customer_tin: str = Form(None),
    customer_registration: str = Form(None),
    customer_phone: str = Form(None),
    pdf: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    client: Client = Depends(require_token),
):
    if not pdf.filename or not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a PDF")

    order = Order(
        customer_name=customer_name.strip(),
        customer_tin=customer_tin.strip() if customer_tin else None,
        customer_registration=customer_registration.strip() if customer_registration else None,
        customer_phone=customer_phone.strip() if customer_phone else None,
    )
    db.add(order)
    await db.flush()

    pdf_filename = f"{order.id}.pdf"
    pdf_path = os.path.join(settings.pdf_storage, pdf_filename)
    try:
        content = await pdf.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded PDF is empty")
        with open(pdf_path, "wb") as f:
            f.write(content)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to save PDF for order %s: %s", order.id, e)
        raise HTTPException(status_code=500, detail="Failed to save uploaded PDF")

    order.pdf_path = pdf_path

    printer = await load_balancer.get_least_loaded_printer(db)
    if printer:
        job = JobAssignment(order_id=order.id, printer_id=None, client_id=None)
        db.add(job)
        await db.flush()
        assigned = await load_balancer.assign_job(db, job)
        if assigned:
            order.status = OrderStatus.assigned
        else:
            order.status = OrderStatus.pending
    else:
        order.status = OrderStatus.pending

    await db.commit()
    await db.refresh(order)
    logger.info("Order created: id=%s, customer=%s, status=%s", order.id, order.customer_name, order.status.value)
    return OrderResponse(
        id=order.id,
        customer_name=order.customer_name,
        customer_tin=order.customer_tin,
        customer_registration=order.customer_registration,
        customer_phone=order.customer_phone,
        status=order.status.value,
        created_at=order.created_at,
    )


@app.get("/api/jobs/pending")
async def get_pending_jobs(
    client_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    client: Client = Depends(require_token),
):
    if client.id != client_id:
        raise HTTPException(status_code=403, detail="Client ID does not match authenticated token")

    result = await db.execute(
        select(JobAssignment)
        .where(
            JobAssignment.client_id == client.id,
            JobAssignment.status == JobStatus.pending,
        )
        .order_by(JobAssignment.created_at.asc())
    )
    jobs = result.scalars().all()

    results = []
    for job in jobs:
        printer = await db.get(Printer, job.printer_id)
        results.append(JobPendingResponse(
            job_id=job.id,
            order_id=job.order_id,
            printer_name=printer.name if printer else "unknown",
            printer_id=job.printer_id,
            pdf_url=f"/api/download/{job.order_id}",
            client_id=client.id,
            created_at=job.created_at,
        ))

    return results


@app.get("/api/download/{order_id}")
async def download_pdf(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not order.pdf_path or not os.path.exists(order.pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found for this order")
    return FileResponse(
        order.pdf_path,
        media_type="application/pdf",
        filename=f"{order_id}.pdf",
    )


@app.post("/api/jobs/status", response_model=JobStatusResponse)
async def update_job_status(
    update: JobStatusUpdate,
    db: AsyncSession = Depends(get_db),
    client: Client = Depends(require_token),
):
    job = await db.get(JobAssignment, update.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.client_id != client.id:
        raise HTTPException(status_code=403, detail="This job does not belong to your client")

    old_status = job.status.value
    new_status = update.status
    job.status = JobStatus(new_status)
    job.updated_at = datetime.now(timezone.utc)

    log = JobLog(
        job_id=job.id,
        message=update.message or f"Status changed: {old_status} -> {new_status}",
    )
    db.add(log)

    if new_status == "completed":
        await load_balancer.complete_job(db, job.printer_id)

        order = await db.get(Order, job.order_id)
        if order:
            generate_receipt(
                str(order.id),
                order.customer_name or "",
                order.customer_tin or "",
                order.customer_registration or "",
                order.customer_phone or "",
            )

        remaining = await db.execute(
            select(func.count(JobAssignment.id))
            .where(
                JobAssignment.order_id == job.order_id,
                JobAssignment.status != JobStatus.completed,
            )
        )
        remaining_count = remaining.scalar()
        if remaining_count == 0 and order:
            order.status = OrderStatus.completed
            order.updated_at = datetime.now(timezone.utc)
            logger.info("Order %s completed (all jobs done)", order.id)

    elif new_status == "failed":
        await load_balancer.complete_job(db, job.printer_id)
        order = await db.get(Order, job.order_id)
        if job.retry_count < 3:
            job.retry_count += 1
            job.status = JobStatus.pending
            await load_balancer.assign_job(db, job)
            log2 = JobLog(job_id=job.id, message=f"Auto-retry #{job.retry_count}/3")
            db.add(log2)
            logger.info("Job %s auto-retry #%d", job.id, job.retry_count)
        else:
            if order:
                order.status = OrderStatus.pending
                order.updated_at = datetime.now(timezone.utc)
                send_email_notification(
                    settings.notification_email,
                    f"Job {job.id} failed after 3 retries",
                    f"Order {order.id} for {order.customer_name} failed permanently.",
                )

    await db.commit()
    logger.info("Job %s status: %s -> %s", job.id, old_status, new_status)
    return JobStatusResponse(success=True)


@app.get("/api/receipts/{order_id}")
async def download_receipt(order_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    receipt_path = os.path.join(settings.receipt_storage, f"receipt_{order_id}.xlsx")
    if not os.path.exists(receipt_path):
        raise HTTPException(status_code=404, detail="Receipt not yet generated. Please try again later.")

    return FileResponse(
        receipt_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"receipt_{order_id}.xlsx",
    )


@app.get("/api/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    printers_result = await db.execute(select(Printer).order_by(Printer.name))
    printers = printers_result.scalars().all()

    printer_list = []
    for p in printers:
        client_name = p.client.name if p.client else None
        printer_list.append(PrinterStatusResponse(
            printer_id=p.id,
            name=p.name,
            status=p.status.value,
            active_jobs=p.active_jobs,
            last_heartbeat=p.last_heartbeat,
            client_name=client_name,
        ))

    pending_count_result = await db.execute(
        select(func.count(Order.id)).where(Order.status == OrderStatus.pending)
    )
    pending_orders = pending_count_result.scalar() or 0

    active_count_result = await db.execute(
        select(func.count(JobAssignment.id)).where(
            JobAssignment.status.in_([JobStatus.printing, JobStatus.downloading])
        )
    )
    active_jobs = active_count_result.scalar() or 0

    return DashboardData(
        printers=printer_list,
        pending_orders=pending_orders,
        active_jobs=active_jobs,
    )


@app.get("/api/orders")
async def list_orders(
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Order)
        .order_by(desc(Order.created_at))
        .limit(limit)
    )
    orders = result.scalars().all()

    return [
        OrderResponse(
            id=o.id,
            customer_name=o.customer_name,
            customer_tin=o.customer_tin,
            customer_registration=o.customer_registration,
            customer_phone=o.customer_phone,
            status=o.status.value,
            created_at=o.created_at,
        )
        for o in orders
    ]


@app.post("/api/notifications/email")
async def configure_email(
    to: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    settings.notification_email = to
    return {"success": True, "email": to}


@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=True,
        log_level="info",
    )
