import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Enum, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base


class PrinterStatus(str, enum.Enum):
    idle = "idle"
    busy = "busy"
    offline = "offline"


class JobStatus(str, enum.Enum):
    pending = "pending"
    downloading = "downloading"
    printing = "printing"
    completed = "completed"
    failed = "failed"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    assigned = "assigned"
    completed = "completed"
    cancelled = "cancelled"


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    api_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    printers: Mapped[list["Printer"]] = relationship(back_populates="client", cascade="all, delete-orphan")
    job_assignments: Mapped[list["JobAssignment"]] = relationship(back_populates="client", cascade="all, delete-orphan")


class Printer(Base):
    __tablename__ = "printers"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[PrinterStatus] = mapped_column(Enum(PrinterStatus), default=PrinterStatus.idle, nullable=False)
    active_jobs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_heartbeat: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    client: Mapped["Client"] = relationship(back_populates="printers")
    job_assignments: Mapped[list["JobAssignment"]] = relationship(back_populates="printer")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_tin: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_registration: Mapped[str | None] = mapped_column(String(50), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    receipt_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[OrderStatus] = mapped_column(Enum(OrderStatus), default=OrderStatus.pending, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    jobs: Mapped[list["JobAssignment"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class JobAssignment(Base):
    __tablename__ = "job_assignments"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    printer_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("printers.id", ondelete="SET NULL"), nullable=True)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.pending, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    order: Mapped["Order"] = relationship(back_populates="jobs")
    printer: Mapped["Printer | None"] = relationship(back_populates="job_assignments")
    client: Mapped["Client | None"] = relationship(back_populates="job_assignments")
    logs: Mapped[list["JobLog"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class JobLog(Base):
    __tablename__ = "job_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("job_assignments.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    job: Mapped["JobAssignment"] = relationship(back_populates="logs")
