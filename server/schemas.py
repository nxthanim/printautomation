from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class RegisterRequest(BaseModel):
    client_name: str = Field(..., min_length=1, max_length=255)
    printers: list[str] = Field(..., min_length=1)
    api_token: str = Field(..., min_length=8, max_length=255)


class RegisterResponse(BaseModel):
    client_id: str
    message: str


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=255)
    customer_tin: Optional[str] = Field(None, max_length=50)
    customer_registration: Optional[str] = Field(None, max_length=50)
    customer_phone: Optional[str] = Field(None, max_length=50)


class OrderResponse(BaseModel):
    id: UUID
    customer_name: str
    customer_tin: Optional[str] = None
    customer_registration: Optional[str] = None
    customer_phone: Optional[str] = None
    status: str
    created_at: datetime


class JobPendingResponse(BaseModel):
    job_id: UUID
    order_id: UUID
    printer_name: str
    printer_id: UUID
    pdf_url: str
    client_id: UUID
    created_at: datetime


class JobStatusUpdate(BaseModel):
    job_id: UUID
    status: str = Field(..., pattern=r"^(pending|downloading|printing|completed|failed)$")
    message: Optional[str] = Field(None, max_length=1000)


class JobStatusResponse(BaseModel):
    success: bool


class ReceiptResponse(BaseModel):
    order_id: UUID
    download_url: str


class PrinterStatusResponse(BaseModel):
    printer_id: UUID
    name: str
    status: str
    active_jobs: int
    last_heartbeat: Optional[datetime] = None
    client_name: Optional[str] = None


class DashboardData(BaseModel):
    printers: list[PrinterStatusResponse]
    pending_orders: int
    active_jobs: int
