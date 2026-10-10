#!/usr/bin/env python3
"""
HoneyForge Stealth Agent (agent.py)
Autonomous lightweight honeypot sensor with process masking, network jitter,
local SQLite buffering, and disguised telemetry transmission.

Requirements: Python 3.8+ (Zero external pip dependencies - Standard Library only)
"""

import os
import sys
import time
import json
import socket
import sqlite3
import random
import hashlib
import platform
import argparse
import logging
import threading
import signal
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime

# Default configuration parameters
DEFAULT_SERVER = "http://localhost:3000"
DEFAULT_MASK_NAME = "systemd-resolved"
DEFAULT_BEACON_INTERVAL = 15
DEFAULT_JITTER_PERCENT = 20
DEFAULT_BUFFER_LIMIT = 5000

# Setup basic logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("HoneyForgeAgent")


class ProcessMasker:
    """Masks process title and command line to prevent detection via ps/top/tasklist (MASK-4)."""

    @staticmethod
    def apply_mask(name: str):
        try:
            # 1. Modify sys.argv[0]
            sys.argv[0] = f"[{name}]"

            # 2. Linux prctl process name change
            if platform.system() == "Linux":
                try:
                    import ctypes
                    libc = ctypes.CDLL("libc.so.6")
                    # PR_SET_NAME = 15
                    pr_set_name = 15
                    name_bytes = name.encode("utf-8")[:15]
                    libc.prctl(pr_set_name, ctypes.c_char_p(name_bytes), 0, 0, 0)
                    logger.info(f"[MASK-4] Linux process title masked as: '{name}'")
                except Exception as e:
                    logger.debug(f"[MASK-4] prctl call skipped: {e}")

            # 3. Optional setproctitle if installed
            try:
                import setproctitle
                setproctitle.setproctitle(f"[{name}]")
            except ImportError:
                pass

            logger.info(f"[MASK-4] Stealth disguise active: '{name}'")
        except Exception as err:
            logger.warning(f"[MASK-4] Process masking warning: {err}")


class LocalBuffer:
    """Stores and buffers attack events locally in SQLite when offline (FR-A4)."""

    def __init__(self, db_path: str = "agent_buffer.db"):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS events_buffer (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT,
                    source_ip TEXT,
                    source_port INTEGER,
                    dest_port INTEGER,
                    protocol TEXT,
                    honeypot_type TEXT,
                    event_type TEXT,
                    severity TEXT,
                    details_json TEXT,
                    synced INTEGER DEFAULT 0
                )
                """
            )
            conn.commit()

    def insert_event(self, event: dict):
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT OR REPLACE INTO events_buffer
                (id, timestamp, source_ip, source_port, dest_port, protocol,
                 honeypot_type, event_type, severity, details_json, synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                """,
                (
                    event.get("id", f"evt_{int(time.time() * 1000)}_{random.randint(100, 999)}"),
                    event.get("timestamp", datetime.utcnow().isoformat() + "Z"),
                    event.get("source_ip", "0.0.0.0"),
                    event.get("source_port", 0),
                    event.get("dest_port", 80),
                    event.get("protocol", "TCP"),
                    event.get("honeypot_type", "emulator"),
                    event.get("event_type", "probe"),
                    event.get("severity", "medium"),
                    json.dumps(event.get("details", {})),
                ),
            )
            conn.commit()

    def get_unsynced(self, limit: int = 50) -> list:
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, timestamp, source_ip, source_port, dest_port,
                       protocol, honeypot_type, event_type, severity, details_json
                FROM events_buffer
                WHERE synced = 0
                ORDER BY timestamp ASC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            events = []
            for r in rows:
                events.append({
                    "id": r[0],
                    "timestamp": r[1],
                    "source_ip": r[2],
                    "source_port": r[3],
                    "dest_port": r[4],
                    "protocol": r[5],
                    "honeypot_type": r[6],
                    "event_type": r[7],
                    "severity": r[8],
                    "details": json.loads(r[9]) if r[9] else {},
                })
            return events

    def mark_synced(self, ids: list):
        if not ids:
            return
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            placeholders = ",".join("?" for _ in ids)
            cursor.execute(
                f"UPDATE events_buffer SET synced = 1 WHERE id IN ({placeholders})",
                ids,
            )
            # Prune old synced events exceeding 5000 records
            cursor.execute("DELETE FROM events_buffer WHERE synced = 1 AND id NOT IN (SELECT id FROM events_buffer ORDER BY timestamp DESC LIMIT 2000)")
            conn.commit()

    def count_unsynced(self) -> int:
        with self._lock, sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM events_buffer WHERE synced = 0")
            row = cursor.fetchone()
            return row[0] if row else 0


class DecoyListener:
    """Built-in low-interaction socket listener for port and banner emulation."""

    def __init__(self, port: int, service_name: str, banner: str, on_event_callback):
        self.port = port
        self.service_name = service_name
        self.banner = banner
        self.on_event = on_event_callback
        self.running = False
        self.sock = None
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass

    def _listen_loop(self):
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(("0.0.0.0", self.port))
            self.sock.listen(10)
            self.sock.settimeout(2.0)
            logger.info(f"[DecoyTrap] Emulating {self.service_name} on port {self.port}")
        except PermissionError:
            logger.warning(f"[DecoyTrap] Permission denied binding port {self.port}. Run as root or use unprivileged ports (>1024).")
            return
        except Exception as err:
            logger.warning(f"[DecoyTrap] Cannot bind port {self.port}: {err}")
            return

        while self.running:
            try:
                client_sock, (client_ip, client_port) = self.sock.accept()
                threading.Thread(
                    target=self._handle_client,
                    args=(client_sock, client_ip, client_port),
                    daemon=True,
                ).start()
            except socket.timeout:
                continue
            except Exception:
                break

    def _handle_client(self, client_sock, client_ip, client_port):
        try:
            client_sock.settimeout(5.0)

            # Send banner if configured
            if self.banner:
                banner_payload = self.banner.replace("\\n", "\n").replace("\\r", "\r")
                if not banner_payload.endswith("\n"):
                    banner_payload += "\r\n"
                client_sock.sendall(banner_payload.encode("utf-8", errors="ignore"))

            # Capture initial attacker payload (up to 2KB)
            received = b""
            try:
                received = client_sock.recv(2048)
            except Exception:
                pass

            raw_str = received.decode("utf-8", errors="replace").strip()

            # Classify event severity & type based on payload
            event_type = "probe"
            severity = "low"
            details = {"rawData": raw_str[:500]}

            # Analyze payload
            lower_str = raw_str.lower()
            if "root" in lower_str or "admin" in lower_str or "pass" in lower_str or "login" in lower_str:
                event_type = "auth_attempt"
                severity = "high"
                details["payload"] = f"Credential attempt detected: {raw_str[:120]}"
            elif any(k in lower_str for k in ["wget", "curl", "chmod", "sh", "/bin/", "bash", "cat /proc"]):
                event_type = "command_exec"
                severity = "critical"
                details["command"] = raw_str[:250]
                details["payload"] = "Malicious shell payload delivery attempt"
            elif any(k in lower_str for k in ["cve-", "jndi:", "${", "..", "select ", "union"]):
                event_type = "vulnerability_exploit"
                severity = "critical"
                details["payload"] = f"Exploit pattern detected: {raw_str[:200]}"
            elif self.port in [22, 23]:
                event_type = "auth_attempt"
                severity = "high"
                details["payload"] = f"{self.service_name} handshake interaction"
            elif len(received) == 0:
                event_type = "port_scan"
                severity = "low"
                details["payload"] = f"TCP SYN / Port scan connection on port {self.port}"
            else:
                event_type = "probe"
                severity = "medium"
                details["payload"] = f"Interactive probe on {self.service_name}"

            event = {
                "source_ip": client_ip,
                "source_port": client_port,
                "dest_port": self.port,
                "protocol": "TCP",
                "honeypot_type": "emulator",
                "event_type": event_type,
                "severity": severity,
                "details": details,
            }

            self.on_event(event)

            # Close gracefully
            time.sleep(0.5)
            client_sock.close()
        except Exception as e:
            logger.debug(f"[DecoyTrap] Error handling client: {e}")
            try:
                client_sock.close()
            except Exception:
                pass



class CowrieLogTailer:
    """Tails Cowrie honeypot cowrie.json log, extracts IOCs, and submits to agent buffer."""

    def __init__(self, log_path: str, on_event_callback):
        self.log_path = log_path
        self.on_event = on_event_callback
        self.running = False
        self.thread = None

    def start(self):
        if not self.log_path:
            return
        self.running = True
        self.thread = threading.Thread(target=self._tail_loop, daemon=True)
        self.thread.start()
        logger.info(f"[CowrieTailer] Monitoring Cowrie log stream: {self.log_path}")

    def stop(self):
        self.running = False

    def _tail_loop(self):
        offset = 0
        while self.running:
            if not os.path.exists(self.log_path):
                time.sleep(0.5)
                continue

            try:
                current_size = os.path.getsize(self.log_path)
                if current_size < offset:
                    offset = 0

                with open(self.log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(offset)
                    lines = f.readlines()
                    offset = f.tell()

                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        record = json.loads(line)
                        event = self._parse_cowrie_event(record)
                        if event:
                            self.on_event(event)
                    except Exception as err:
                        logger.debug(f"[CowrieTailer] JSON parse error: {err}")

            except Exception as e:
                logger.debug(f"[CowrieTailer] Error reading log file: {e}")

            time.sleep(1.0)

    def _parse_cowrie_event(self, rec: dict):
        event_id = rec.get("eventid", "")
        src_ip = rec.get("src_ip", "0.0.0.0")
        src_port = rec.get("src_port", 0)
        dst_port = rec.get("dst_port", 2222)
        protocol = "SSH" if dst_port in (22, 2222) else "TELNET"
        timestamp = rec.get("timestamp", datetime.utcnow().isoformat() + "Z")

        if event_id in ("cowrie.login.success", "cowrie.login.failed"):
            is_success = (event_id == "cowrie.login.success")
            username = rec.get("username", "")
            password = rec.get("password", "")
            return {
                "id": f"evt_cowrie_{rec.get('session', '')}_{int(time.time() * 1000)}",
                "timestamp": timestamp,
                "source_ip": src_ip,
                "source_port": src_port,
                "dest_port": dst_port,
                "protocol": protocol,
                "honeypot_type": "cowrie",
                "event_type": "auth_attempt",
                "severity": "critical" if is_success else "high",
                "details": {
                    "username": username,
                    "password": password,
                    "payload": f"Cowrie {protocol} {'AUTH SUCCESS' if is_success else 'AUTH FAILED'}: {username}:{password}",
                    "rawData": json.dumps(rec),
                },
            }

        elif event_id == "cowrie.command.input":
            command = rec.get("input", "")
            return {
                "id": f"evt_cowrie_cmd_{rec.get('session', '')}_{int(time.time() * 1000)}",
                "timestamp": timestamp,
                "source_ip": src_ip,
                "source_port": src_port,
                "dest_port": dst_port,
                "protocol": protocol,
                "honeypot_type": "cowrie",
                "event_type": "command_exec",
                "severity": "critical",
                "details": {
                    "command": command,
                    "payload": f"Interactive {protocol} shell command: {command[:200]}",
                    "rawData": json.dumps(rec),
                },
            }

        elif event_id in ("cowrie.session.file_download", "cowrie.session.file_upload"):
            url = rec.get("url", "")
            outfile = rec.get("outfile", "")
            shasum = rec.get("shasum", "")
            return {
                "id": f"evt_cowrie_drop_{rec.get('session', '')}_{int(time.time() * 1000)}",
                "timestamp": timestamp,
                "source_ip": src_ip,
                "source_port": src_port,
                "dest_port": dst_port,
                "protocol": protocol,
                "honeypot_type": "cowrie",
                "event_type": "payload_delivery",
                "severity": "critical",
                "details": {
                    "url": url,
                    "payload": f"Malware payload dropper captured (SHA256: {shasum[:16]}...): {url or outfile}",
                    "rawData": json.dumps(rec),
                },
            }

        elif event_id == "cowrie.session.connect":
            return {
                "id": f"evt_cowrie_conn_{rec.get('session', '')}_{int(time.time() * 1000)}",
                "timestamp": timestamp,
                "source_ip": src_ip,
                "source_port": src_port,
                "dest_port": dst_port,
                "protocol": protocol,
                "honeypot_type": "cowrie",
                "event_type": "probe",
                "severity": "medium",
                "details": {
                    "payload": f"Inbound {protocol} connection from {src_ip}",
                    "rawData": json.dumps(rec),
                },
            }

        return None


class GenericJsonLogTailer:
    """Tails generic HoneyForge JSON log files (e.g. HTTP trap, emulator)."""

    def __init__(self, log_path: str, honeypot_type: str, on_event_callback):
        self.log_path = log_path
        self.honeypot_type = honeypot_type
        self.on_event = on_event_callback
        self.running = False
        self.thread = None

    def start(self):
        if not self.log_path:
            return
        self.running = True
        self.thread = threading.Thread(target=self._tail_loop, daemon=True)
        self.thread.start()
        logger.info(f"[LogTailer] Monitoring {self.honeypot_type} log stream: {self.log_path}")

    def stop(self):
        self.running = False

    def _tail_loop(self):
        offset = 0
        while self.running:
            if not os.path.exists(self.log_path):
                time.sleep(0.5)
                continue

            try:
                current_size = os.path.getsize(self.log_path)
                if current_size < offset:
                    offset = 0

                with open(self.log_path, "r", encoding="utf-8", errors="replace") as f:
                    f.seek(offset)
                    lines = f.readlines()
                    offset = f.tell()

                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        event = {
                            "id": data.get("id", f"evt_{int(time.time() * 1000)}_{random.randint(100, 999)}"),
                            "timestamp": data.get("timestamp", datetime.utcnow().isoformat() + "Z"),
                            "source_ip": data.get("source_ip", "0.0.0.0"),
                            "source_port": data.get("source_port", 0),
                            "dest_port": data.get("dest_port", 80),
                            "protocol": data.get("protocol", "HTTP" if self.honeypot_type == "http_trap" else "TCP"),
                            "honeypot_type": data.get("honeypot_type", self.honeypot_type),
                            "event_type": data.get("event_type", "probe"),
                            "severity": data.get("severity", "medium"),
                            "details": data.get("details", {
                                "payload": data.get("payload") or data.get("matched_signature", ""),
                                "url": data.get("url", ""),
                                "method": data.get("method", ""),
                                "userAgent": data.get("user_agent", ""),
                            }),
                        }
                        self.on_event(event)
                    except Exception as err:
                        logger.debug(f"[LogTailer] JSON parse error: {err}")
            except Exception as e:
                logger.debug(f"[LogTailer] Error reading log file: {e}")

            time.sleep(1.0)


class HoneyForgeAgent:
    """Autonomous agent coordinating beacon, buffer, listeners, and config sync."""

    def __init__(
        self,
        server_url: str,
        agent_id: str,
        mask_name: str,
        cowrie_log_path: str = "",
        http_trap_log_path: str = "",
    ):
        self.server_url = server_url.rstrip("/")
        self.agent_id = agent_id
        self.mask_name = mask_name
        self.cowrie_log_path = cowrie_log_path
        self.http_trap_log_path = http_trap_log_path
        self.hostname = socket.gethostname()
        self.os_info = f"{platform.system()} {platform.release()} ({platform.machine()})"
        self.version = "1.2.0"
        self.start_time = time.time()
        self.running = True

        self.buffer = LocalBuffer()
        self.current_profile = None
        self.current_config_hash = ""
        self.active_listeners = []
        self.tailers = []
        self.beacon_interval = DEFAULT_BEACON_INTERVAL
        self.jitter_percent = DEFAULT_JITTER_PERCENT

        # Endpoints disguised as regular web resources (MASK-2)
        self.beacon_url = f"{self.server_url}/api/v1/metrics/beacon"
        self.log_url = f"{self.server_url}/api/v1/assets/log"
        self.manifest_url = f"{self.server_url}/api/v1/assets/manifest"

    def stop(self):
        logger.info("[*] Stopping HoneyForge Stealth Agent...")
        self.running = False
        for listener in self.active_listeners:
            listener.stop()
        for tailer in self.tailers:
            tailer.stop()

    def _interruptible_sleep(self, seconds: float):
        end = time.time() + seconds
        while self.running and time.time() < end:
            time.sleep(min(0.5, max(0.0, end - time.time())))

    def run(self):
        logger.info(f"[*] Starting HoneyForge Stealth Agent [ID: {self.agent_id}]")
        logger.info(f"[*] Target Control Server: {self.server_url}")

        # Apply process title mask (MASK-4)
        ProcessMasker.apply_mask(self.mask_name)

        # Start log tailers if configured
        if self.cowrie_log_path:
            tailer = CowrieLogTailer(self.cowrie_log_path, self.on_attack_detected)
            tailer.start()
            self.tailers.append(tailer)

        if self.http_trap_log_path:
            tailer = GenericJsonLogTailer(self.http_trap_log_path, "http_trap", self.on_attack_detected)
            tailer.start()
            self.tailers.append(tailer)

        # Initial config pull
        self.fetch_initial_config()

        # Start background event draining loop
        drain_thread = threading.Thread(target=self._drain_loop, daemon=True)
        drain_thread.start()

        # Main heartbeat loop with jitter (MASK-5)
        self._beacon_loop()

    def fetch_initial_config(self):
        """Pull initial configuration profile from disguised manifest endpoint (FR-A3)."""
        try:
            url = f"{self.manifest_url}?nid={self.agent_id}"
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if "profile" in data:
                    self.apply_profile(data["profile"], data.get("hash", ""))
        except Exception as e:
            logger.warning(f"[-] Could not pull manifest config ({e}), starting default listeners")
            self._start_default_listeners()

    def apply_profile(self, profile: dict, config_hash: str):
        """Dynamically reconfigures open ports and banners according to server profile."""
        logger.info(f"[+] Applying profile: '{profile.get('name')}' (Level: {profile.get('interactionLevel')})")
        self.current_profile = profile
        self.current_config_hash = config_hash

        # Update stealth settings
        agent_cfg = profile.get("agentConfig", {})
        self.beacon_interval = agent_cfg.get("beaconIntervalSeconds", self.beacon_interval)
        self.jitter_percent = agent_cfg.get("jitterPercent", self.jitter_percent)

        new_mask = agent_cfg.get("maskProcessName")
        if new_mask and new_mask != self.mask_name:
            self.mask_name = new_mask
            ProcessMasker.apply_mask(new_mask)

        # Stop old listeners
        for listener in self.active_listeners:
            listener.stop()
        self.active_listeners.clear()

        # Start new services
        services = profile.get("services", [])
        for srv in services:
            if srv.get("enabled", True):
                listener = DecoyListener(
                    port=srv.get("port"),
                    service_name=srv.get("service", "Custom"),
                    banner=srv.get("banner", ""),
                    on_event_callback=self.on_attack_detected,
                )
                listener.start()
                self.active_listeners.append(listener)

    def _start_default_listeners(self):
        """Fallback emulator if control server is momentarily unreachable."""
        default_services = [
            {"port": 2222, "service": "SSH-Fallback", "banner": "SSH-2.0-OpenSSH_8.4p1"},
            {"port": 8080, "service": "HTTP-Fallback", "banner": "Apache/2.4.51 (Debian)"},
        ]
        for srv in default_services:
            listener = DecoyListener(
                port=srv["port"],
                service_name=srv["service"],
                banner=srv["banner"],
                on_event_callback=self.on_attack_detected,
            )
            listener.start()
            self.active_listeners.append(listener)

    def on_attack_detected(self, event: dict):
        """Callback when an attack or port scan hits one of our listeners."""
        logger.info(
            f"[!] Threat captured from {event.get('source_ip')} -> Port {event.get('dest_port')} "
            f"({event.get('severity').upper()}: {event.get('event_type')})"
        )
        # 1. Immediately store into local SQLite buffer (FR-A4)
        self.buffer.insert_event(event)

    def _drain_loop(self):
        """Periodically flushes buffered events from SQLite to disguised log API."""
        while self.running:
            self._interruptible_sleep(5.0)
            if not self.running:
                break
            unsynced = self.buffer.get_unsynced(limit=30)
            if not unsynced:
                continue

            payload = {
                "batch_id": f"batch_{int(time.time())}",
                "agent_id": self.agent_id,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "count": len(unsynced),
                "events": unsynced,
            }

            try:
                req = urllib.request.Request(
                    self.log_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                        "X-Forwarded-Client": "TelemetrySink/2.1",
                    },
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    if resp.status in (200, 201, 202):
                        synced_ids = [e["id"] for e in unsynced]
                        self.buffer.mark_synced(synced_ids)
                        logger.info(f"[+] Successfully drained {len(synced_ids)} attack events to control server")
            except Exception as err:
                logger.debug(f"[-] Offline or log ingest temporarily unavailable ({err}). Events buffered in SQLite.")

    def _beacon_loop(self):
        """Sends disguised heartbeats with random jitter (MASK-2, MASK-5)."""
        while self.running:
            # Calculate sleep interval with jitter
            jitter_range = self.beacon_interval * (self.jitter_percent / 100.0)
            actual_sleep = self.beacon_interval + random.uniform(-jitter_range, jitter_range)
            actual_sleep = max(3.0, actual_sleep)

            self._interruptible_sleep(actual_sleep)
            if not self.running:
                break

            uptime = int(time.time() - self.start_time)
            unsynced_count = self.buffer.count_unsynced()

            payload = {
                "agent_id": self.agent_id,
                "hostname": self.hostname,
                "os": self.os_info,
                "version": self.version,
                "mask_process": self.mask_name,
                "current_config_hash": self.current_config_hash,
                "stats": {
                    "total_events": unsynced_count,
                    "uptime_seconds": uptime,
                },
            }

            try:
                req = urllib.request.Request(
                    self.beacon_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "TelemetryWorker/3.1 (Debian GNU/Linux)",
                    },
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        res_data = json.loads(resp.read().decode("utf-8"))
                        # Check if server pushed an updated profile
                        if res_data.get("config_update") and res_data.get("profile"):
                            logger.info("[*] Server dispatched new profile update!")
                            new_hash = hashlib.md5(
                                json.dumps(res_data["profile"]).encode("utf-8")
                            ).hexdigest()
                            self.apply_profile(res_data["profile"], new_hash)
            except Exception as err:
                logger.debug(f"[-] Beacon failed: {err}")


def main():
    parser = argparse.ArgumentParser(description="HoneyForge Stealth Honeypot Agent")
    parser.add_argument("--server", default=os.environ.get("CONTROL_SERVER", DEFAULT_SERVER), help="Control server URL (e.g. http://192.168.1.100:3000)")
    parser.add_argument("--id", default=os.environ.get("AGENT_ID", f"node_{socket.gethostname()[:8]}_{random.randint(100, 999)}"), help="Unique agent identifier")
    parser.add_argument("--mask", default=os.environ.get("MASK_NAME", DEFAULT_MASK_NAME), help="Process disguise name (MASK-4)")
    parser.add_argument("--cowrie-log", default=os.environ.get("COWRIE_LOG_PATH", ""), help="Path to Cowrie JSON log file to tail and forward")
    parser.add_argument("--http-log", default=os.environ.get("HTTP_TRAP_LOG_PATH", ""), help="Path to HTTP Trap JSON log file to tail and forward")
    args = parser.parse_args()

    agent = HoneyForgeAgent(
        server_url=args.server,
        agent_id=args.id,
        mask_name=args.mask,
        cowrie_log_path=args.cowrie_log,
        http_trap_log_path=args.http_log,
    )

    def handle_signal(sig, _frame):
        logger.info(f"[*] Signal {sig} received, stopping agent...")
        agent.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    agent.run()


if __name__ == "__main__":
    main()
