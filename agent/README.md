# HoneyForge Stealth Honeypot Agent (`agent.py`)

Autonomous, lightweight, zero-dependency stealth sensor for decentralized honeypot nodes.

---

## Key Features & Capabilities

- **Zero External Dependencies**: Built entirely using the Python 3 standard library (`sqlite3`, `urllib.request`, `socket`, `threading`, `ctypes`). No `pip install` required.
- **Process Title Masking (MASK-4)**: Modifies `sys.argv[0]` and calls Linux `prctl(PR_SET_NAME, ...)` to disguise itself in process monitors (`ps -ef`, `top`, `htop`) under innocuous system daemon names such as `systemd-resolved`, `kworker/u2:0`, or `rsyslogd`.
- **Network Jitter (MASK-5)**: Randomizes heartbeat intervals (`interval ± jitter%`) to prevent behavioral detection and network correlation by intrusion detection systems (IDS/NDR).
- **Disguised Telemetry Endpoints (MASK-2)**: Heartbeats are disguised as `POST /api/v1/metrics/beacon`, and attack ingestion as `POST /api/v1/assets/log` to blend in with legitimate telemetry.
- **Local SQLite Buffering (FR-A4)**: Intercepted attacks are committed to `agent_buffer.db`. If the control server or network is unreachable, events remain buffered safely and are drained upon reconnect.
- **Dynamic Configuration Sync (FR-A3)**: The agent continuously polls the control server. When an administrator re-assigns or modifies a honeypot profile in HoneyForge UI, the agent pulls the new profile and live-reloads open emulation ports and banners without restarting.
- **Built-in Port & Banner Emulator**: Listens on configured TCP ports, outputs customizable banners, captures attacker payloads/credentials/shell commands, and tags event severity.

---

## Quick Start

### 1. Launch Agent Interactively
```bash
python3 agent.py --server http://192.168.1.100:3000 --id node_dmz_01 --mask systemd-resolved
```

### 2. Disguised Background Service (Linux Systemd)
Create `/etc/systemd/system/systemd-resolved-svc.service`:
```ini
[Unit]
Description=Network Name Resolution Service (Masked HoneyForge Agent)
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/honeyforge/agent.py --server "http://192.168.1.100:3000" --id "node_dmz_01" --mask "systemd-resolved"
Restart=always
RestartSec=10
StandardOutput=null
StandardError=null

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now systemd-resolved-svc
```

### 3. Verify Process Masking
```bash
ps -ef | grep systemd-resolved
```
The agent process appears masked, hiding the Python script name and its command line arguments.
