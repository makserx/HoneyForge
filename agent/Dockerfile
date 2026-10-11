FROM python:3.11-alpine

WORKDIR /app
COPY agent.py ./

ENV CONTROL_SERVER="https://nginx:443"
ENV AGENT_ID="node_container_01"
ENV MASK_NAME="systemd-resolved"
ENV COWRIE_LOG_PATH=""
ENV HTTP_TRAP_LOG_PATH=""
ENV CA_CERT_PATH="/certs/server.crt"
ENV AGENT_INSECURE_TLS="1"

CMD ["sh", "-c", "python agent.py --server \"$CONTROL_SERVER\" --id \"$AGENT_ID\" --mask \"$MASK_NAME\" ${COWRIE_LOG_PATH:+--cowrie-log \"$COWRIE_LOG_PATH\"} ${HTTP_TRAP_LOG_PATH:+--http-log \"$HTTP_TRAP_LOG_PATH\"} ${CA_CERT_PATH:+--ca-cert \"$CA_CERT_PATH\"}"]
