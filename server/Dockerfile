FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

COPY generate_receipt_template.py .
RUN python generate_receipt_template.py

COPY . .

FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    cups-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

WORKDIR /app

COPY --from=builder /build .

RUN mkdir -p /opt/print-automation/storage/pdfs /opt/print-automation/storage/receipts

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
