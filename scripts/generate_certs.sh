#!/usr/bin/env bash
# ==============================================================================
# Генератор TLS-сертификатов HoneyForge (MASK-1)
# Создает самоподписанный сертификат RSA 4096 бит с альтернативными именами субъекта (SAN)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CERTS_DIR="${PROJECT_ROOT}/certs"

CRT_FILE="${CERTS_DIR}/server.crt"
KEY_FILE="${CERTS_DIR}/server.key"
DAYS=365

mkdir -p "${CERTS_DIR}"

if [[ -f "${CRT_FILE}" && -f "${KEY_FILE}" && "${1:-}" != "--force" ]]; then
    echo "[+] TLS Certificates already exist at ${CERTS_DIR}:"
    echo "    - Certificate: ${CRT_FILE}"
    echo "    - Private Key: ${KEY_FILE}"
    echo "[*] Use '${0} --force' to regenerate."
    exit 0
fi

echo "[*] Generating HoneyForge Self-Signed TLS Certificate (4096-bit RSA, valid ${DAYS} days)..."

openssl req -x509 -newkey rsa:4096 -sha256 -days "${DAYS}" -nodes \
    -keyout "${KEY_FILE}" \
    -out "${CRT_FILE}" \
    -subj "/C=RU/ST=Moscow/L=Moscow/O=HoneyForge SOC/OU=Decoy Operations/CN=control-server" \
    -addext "subjectAltName=DNS:control-server,DNS:nginx,DNS:localhost,IP:127.0.0.1"

chmod 644 "${CRT_FILE}"
chmod 644 "${KEY_FILE}"

echo "[+] Successfully generated TLS certificates:"
echo "    - Cert: ${CRT_FILE}"
echo "    - Key:  ${KEY_FILE}"
echo "[+] Subject Alternative Names (SAN):"
openssl x509 -in "${CRT_FILE}" -text -noout | grep -A 2 "Subject Alternative Name" || true
