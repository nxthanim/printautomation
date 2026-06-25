#!/bin/bash
set -euo pipefail

SSL_DIR="/etc/ssl/print-automation"
CA_DIR="${SSL_DIR}/ca"

mkdir -p "$CA_DIR" "$SSL_DIR"

if [ ! -f "$CA_DIR/ca.key" ]; then
    echo "Generating Certificate Authority..."
    openssl genrsa -out "$CA_DIR/ca.key" 4096
    chmod 600 "$CA_DIR/ca.key"
    openssl req -x509 -new -nodes \
        -key "$CA_DIR/ca.key" \
        -sha256 -days 3650 \
        -out "$CA_DIR/ca.crt" \
        -subj "/C=XX/ST=State/L=City/O=PrintAutomation/CN=PrintAutomationCA"
    chmod 644 "$CA_DIR/ca.crt"
    echo "CA certificate generated: $CA_DIR/ca.crt"
else
    echo "CA certificate already exists, skipping generation"
fi

if [ ! -f "$SSL_DIR/server.key" ] || [ ! -f "$SSL_DIR/server.crt" ]; then
    echo "Generating server certificate..."
    openssl genrsa -out "$SSL_DIR/server.key" 2048
    chmod 600 "$SSL_DIR/server.key"

    openssl req -new \
        -key "$SSL_DIR/server.key" \
        -out "$SSL_DIR/server.csr" \
        -subj "/C=XX/ST=State/L=City/O=PrintAutomation/CN=print-automation.local"

    openssl x509 -req \
        -in "$SSL_DIR/server.csr" \
        -CA "$CA_DIR/ca.crt" \
        -CAkey "$CA_DIR/ca.key" \
        -CAcreateserial \
        -out "$SSL_DIR/server.crt" \
        -days 365 \
        -sha256 \
        -extensions v3_req

    chmod 644 "$SSL_DIR/server.crt"
    rm -f "$SSL_DIR/server.csr"
    echo "Server certificate generated: $SSL_DIR/server.crt"
else
    echo "Server certificate already exists, skipping generation"
fi

cp "$CA_DIR/ca.crt" "$SSL_DIR/ca.crt"
chmod 644 "$SSL_DIR/ca.crt"

echo "Certificate generation complete."
echo "  CA certificate: $SSL_DIR/ca.crt"
echo "  Server certificate: $SSL_DIR/server.crt"
echo "  Server key: $SSL_DIR/server.key"
