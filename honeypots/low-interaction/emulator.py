#!/usr/bin/env python3
"""
HoneyForge Low-Interaction Multi-Port Banner Emulator
Listens on multiple TCP ports, outputs realistic banners, and logs attempts.
"""

import socket
import threading
import json
import os
import sys
import time
from datetime import datetime

BANNERS_FILE = os.path.join(os.path.dirname(__file__), "banners.json")
EMULATOR_LOG_FILE = os.environ.get("EMULATOR_LOG_FILE", "")

def load_banners():
    if os.path.exists(BANNERS_FILE):
        with open(BANNERS_FILE, "r") as f:
            return json.load(f)
    return {
        "21": {"service": "FTP", "banner": "220 ProFTPD 1.3.5 Server"},
        "22": {"service": "SSH", "banner": "SSH-2.0-OpenSSH_8.4p1"},
        "23": {"service": "TELNET", "banner": "login: "},
        "80": {"service": "HTTP", "banner": "HTTP/1.1 200 OK\r\nServer: Apache\r\n\r\n"},
        "3306": {"service": "MYSQL", "banner": "5.7.35 MySQL Server"},
        "6379": {"service": "REDIS", "banner": "-ERR NOAUTH Authentication required."},
    }

def handle_client(sock, client_ip, client_port, port, service_info):
    try:
        sock.settimeout(5.0)
        banner = service_info.get("banner", "")
        if banner:
            banner_data = banner.replace("\\n", "\n").replace("\\r", "\r")
            if not banner_data.endswith("\n"):
                banner_data += "\r\n"
            sock.sendall(banner_data.encode("utf-8", errors="ignore"))

        data = b""
        try:
            data = sock.recv(2048)
        except Exception:
            pass

        timestamp = datetime.utcnow().isoformat() + "Z"
        raw_payload = data.decode("utf-8", errors="replace").strip()

        log_entry = {
            "timestamp": timestamp,
            "source_ip": client_ip,
            "source_port": client_port,
            "dest_port": int(port),
            "service": service_info.get("service"),
            "payload": raw_payload[:300],
        }

        print(f"[ATTACK] {timestamp} {client_ip}:{client_port} -> Port {port} ({service_info.get('service')}): {raw_payload[:100]}", flush=True)

        if EMULATOR_LOG_FILE:
            try:
                os.makedirs(os.path.dirname(EMULATOR_LOG_FILE), exist_ok=True)
                with open(EMULATOR_LOG_FILE, "a", encoding="utf-8") as lf:
                    lf.write(json.dumps(log_entry) + "\n")
            except Exception as log_err:
                print(f"[ERROR] Warning writing to {EMULATOR_LOG_FILE}: {log_err}", file=sys.stderr, flush=True)

        time.sleep(0.5)
        sock.close()
    except Exception as e:
        try:
            sock.close()
        except Exception:
            pass

def listen_port(port, service_info):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(("0.0.0.0", int(port)))
        s.listen(15)
        print(f"[READY] Emulating {service_info.get('service')} on port {port}", flush=True)

        while True:
            client_sock, (client_ip, client_port) = s.accept()
            threading.Thread(
                target=handle_client,
                args=(client_sock, client_ip, client_port, port, service_info),
                daemon=True,
            ).start()
    except Exception as err:
        print(f"[ERROR] Port {port}: {err}", file=sys.stderr, flush=True)

def main():
    banners = load_banners()
    threads = []
    for port, info in banners.items():
        t = threading.Thread(target=listen_port, args=(port, info), daemon=True)
        t.start()
        threads.append(t)

    print(f"[*] HoneyForge Low-Interaction Emulator running on {len(banners)} ports.", flush=True)
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[*] Stopping emulator.")

if __name__ == "__main__":
    main()
