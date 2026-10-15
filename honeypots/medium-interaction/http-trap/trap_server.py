#!/usr/bin/env python3
"""
Среднеинтерактивный сервер-ловушка уязвимого HTTP HoneyForge.
Имитирует уязвимое веб-приложение с ложными эндпоинтами для:
- Apache Log4j (CVE-2021-44228)
- Spring Cloud Gateway / Spring4Shell (CVE-2022-22947 / CVE-2022-22965)
- Неаутентифицированной установки phpMyAdmin / Webmin
- Попыток обхода каталогов (Path traversal) и чтения /etc/passwd
- Брутфорса учетных записей WordPress xmlrpc.php и wp-login.php
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import time
import os
import sys
from datetime import datetime

PORT = int(os.environ.get("TRAP_PORT", 8080))
LOG_FILE = os.environ.get("TRAP_LOG_FILE", "")

class TrapHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Подавление стандартных логов доступа сервера в stdout во избежание захламления вывода
        pass

    def do_GET(self):
        self._analyze_request("GET")

    def do_POST(self):
        self._analyze_request("POST")

    def do_HEAD(self):
        self._analyze_request("HEAD")

    def _analyze_request(self, method: str):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8", errors="replace") if content_length > 0 else ""

        client_ip = self.client_address[0]
        client_port = self.client_address[1]
        path = self.path
        user_agent = self.headers.get("User-Agent", "")

        # Проверка специфических сигнатур атак
        severity = "medium"
        event_type = "probe"
        matched = "Generic HTTP Probe"

        lower_path = path.lower()
        lower_body = body.lower()
        raw_combined = f"{path} {body} {user_agent}".lower()

        if "${jndi:" in raw_combined or "ldap://" in raw_combined:
            severity = "critical"
            event_type = "vulnerability_exploit"
            matched = "Apache Log4j RCE (CVE-2021-44228)"
        elif "gateway/routes" in lower_path or "class.module.classloader" in raw_combined:
            severity = "critical"
            event_type = "vulnerability_exploit"
            matched = "Spring Cloud Gateway / Spring4Shell RCE"
        elif any(k in lower_path for k in ["/etc/passwd", "..%2f", "%2e%2e", "/cgi-bin/"]):
            severity = "critical"
            event_type = "vulnerability_exploit"
            matched = "Directory Path Traversal Attempt"
        elif "phpmyadmin" in lower_path or "pma" in lower_path:
            severity = "high"
            event_type = "probe"
            matched = "phpMyAdmin Unauthorized Access Scanner"
        elif "wp-login.php" in lower_path or "xmlrpc.php" in lower_path:
            severity = "high"
            event_type = "auth_attempt"
            matched = "WordPress CMS Credential Brute Force"
        elif "env" in lower_path or "config.json" in lower_path or ".git" in lower_path:
            severity = "medium"
            event_type = "probe"
            matched = "Secret / Environment Variable Discovery Probe"

        timestamp = datetime.utcnow().isoformat() + "Z"
        log_entry = {
            "timestamp": timestamp,
            "source_ip": client_ip,
            "source_port": client_port,
            "dest_port": PORT,
            "method": method,
            "url": path,
            "user_agent": user_agent,
            "severity": severity,
            "event_type": event_type,
            "matched_signature": matched,
            "body_snippet": body[:300],
        }

        print(f"[HTTP-TRAP] {timestamp} {client_ip} -> {method} {path} | {severity.upper()}: {matched}", flush=True)

        if LOG_FILE:
            try:
                os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
                with open(LOG_FILE, "a", encoding="utf-8") as lf:
                    lf.write(json.dumps(log_entry) + "\n")
            except Exception as log_err:
                print(f"[HTTP-TRAP] Warning writing to {LOG_FILE}: {log_err}", file=sys.stderr, flush=True)

        # Эмуляция реалистичных ответов сервера
        if "phpmyadmin" in lower_path:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Server", "Apache/2.4.41 (Ubuntu)")
            self.end_headers()
            self.wfile.write(b"<html><title>phpMyAdmin</title><body><form><h2>phpMyAdmin Login</h2><input name='pma_username'/><input type='password' name='pma_password'/></form></body></html>")
        elif "wp-login" in lower_path:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Server", "nginx/1.18.0")
            self.end_headers()
            self.wfile.write(b"<html><title>Log In &lsaquo; WordPress</title><body><form id='loginform'></form></body></html>")
        elif any(k in lower_path for k in ["/etc/passwd", ".."]):
            self.send_response(403)
            self.send_header("Content-Type", "text/html")
            self.send_header("Server", "Apache/2.4.50")
            self.end_headers()
            self.wfile.write(b"<h1>403 Forbidden</h1><p>Access denied to the requested file resource.</p>")
        else:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Server", "Apache/2.4.51 (Debian)")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","service":"internal-api-gateway","version":"1.4.2"}')

def run():
    server = HTTPServer(("0.0.0.0", PORT), TrapHandler)
    print(f"[*] HoneyForge Vulnerable HTTP Trap active on port {PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Stopping HTTP trap.")

if __name__ == "__main__":
    run()
