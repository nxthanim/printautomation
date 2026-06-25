import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Printer, JobAssignment, JobStatus, PrinterStatus

logger = logging.getLogger("print_automation.load_balancer")


class LoadBalancer:
    def __init__(self):
        self._cache: dict[str, int] = {}

    async def get_least_loaded_printer(self, db: AsyncSession) -> Optional[Printer]:
        query = (
            select(Printer)
            .where(Printer.status == PrinterStatus.idle)
            .order_by(Printer.active_jobs.asc())
            .limit(1)
        )
        result = await db.execute(query)
        printer = result.scalar_one_or_none()
        if printer:
            return printer

        query = (
            select(Printer)
            .where(Printer.status == PrinterStatus.busy)
            .order_by(Printer.active_jobs.asc())
            .limit(1)
        )
        result = await db.execute(query)
        printer = result.scalar_one_or_none()
        if printer:
            return printer

        query = (
            select(Printer)
            .where(Printer.status == PrinterStatus.offline)
            .order_by(Printer.active_jobs.asc())
            .limit(1)
        )
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def assign_job(self, db: AsyncSession, job: JobAssignment) -> Optional[Printer]:
        printer = await self.get_least_loaded_printer(db)
        if printer is None:
            logger.warning("No available printer found for job assignment")
            return None

        job.printer_id = printer.id
        job.client_id = printer.client_id
        job.status = JobStatus.pending
        printer.active_jobs = (printer.active_jobs or 0) + 1
        if printer.status == PrinterStatus.idle:
            printer.status = PrinterStatus.busy
        logger.info("Assigned job %s to printer %s (active_jobs: %d)", job.id, printer.name, printer.active_jobs)
        return printer

    async def complete_job(self, db: AsyncSession, printer_id: uuid.UUID):
        printer = await db.get(Printer, printer_id)
        if printer is None:
            logger.warning("Printer %s not found for job completion", printer_id)
            return

        printer.active_jobs = max(0, (printer.active_jobs or 0) - 1)
        if printer.active_jobs == 0:
            printer.status = PrinterStatus.idle
        logger.info("Completed job on printer %s (active_jobs: %d)", printer.name, printer.active_jobs)
        await db.flush()

    async def heartbeat(self, db: AsyncSession, printer_id: uuid.UUID):
        printer = await db.get(Printer, printer_id)
        if printer is None:
            logger.warning("Heartbeat for unknown printer %s", printer_id)
            return

        printer.last_heartbeat = datetime.utcnow()
        if printer.status == PrinterStatus.offline:
            printer.status = PrinterStatus.idle
        await db.flush()
        logger.debug("Heartbeat received for printer %s", printer.name)


load_balancer = LoadBalancer()
