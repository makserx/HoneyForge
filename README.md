# HoneyForge (Децентрализованная сеть honeypot-ловушек)

**HoneyForge** — централизованная система оркестрации, мониторинга и телеметрии для децентрализованных honeypot-ловушек (Control Matrix + Stealth Agents + Multi-level Decoys).

Разработана для активной киберзащиты (Cyber Deception), обнаружения сканирования периметра, перехвата атак нулевого дня (0-day / CVE эксплойтов), credential stuffing и ботнет-активности без риска компрометации критической инфраструктуры.

---

## Архитектура системы

```
                           [ АТАКУЮЩИЙ / СКАНЕР СЕТИ ]
                                       │
                   ┌───────────────────┴───────────────────┐
                   ▼                                       ▼
     [ Low-Interaction порты ]               [ Medium-Interaction ловушки ]
      - Эмулятор портов и баннеров            - Интерактивный SSH/Telnet Cowrie
      - Порты: 21, 23, 80, 3306, 6379         - Уязвимая HTTP-ловушка (Log4j, Spring)
                   │                                       │
                   └───────────────────┬───────────────────┘
                                       ▼
                      [ СКРЫТЫЙ СЕНСОР: agent.py ]
                       - MASK-4: Маскировка под [systemd-resolved]
                       - MASK-5: Джиттер сетевого маяка ±20%
                       - FR-A4: Локальный SQLite-буфер (оффлайн-устойчивость)
                       - FR-A3: Динамическая синхронизация и hot-reload
                                       │
                      Замаскированная телеметрия (MASK-1 / MASK-2):
                      HTTPS / TLS (Port 443) -> Nginx Reverse-Proxy
                      POST /api/v1/metrics/beacon
                      POST /api/v1/assets/log
                                       │
                                       ▼
                    [ NGINX TLS ШЛЮЗ + СЕРВЕР HONEYFORGE ]
                     - MASK-1: Шифрование канала (TLS 1.2/1.3, Self-Signed SAN)
                     - FR-C5: Авторизация оператора SOC (ADMIN_TOKEN / hf_session)
                     - Control API на Next.js App Router
                     - Онлайн-лента телеметрии атак (SSE)
                     - Конструктор профилей ловушек (FR-C1)
                     - Мониторинг флота ловушек (FR-C2)
                     - Анализ IOC и визуализация угроз
```

---

## Реализованные функциональные требования (MVP)

### 1. Web UI & Control API (Next.js App Router)
- **FR-C1 (Конструктор профилей ловушек)**:
  - Создание и редактирование профилей приманок (Low, Medium, High).
  - Матрица портов и сервисов с настройкой кастомных баннеров (SSH, FTP, HTTP, MySQL, Redis, Telnet, RTSP).
  - Настройка параметров скрытности агента: интервал опроса, процент джиттера, имя маскируемого системного процесса.
  - Быстрая загрузка пресетов: *Linux Edge Bastion*, *IoT Camera & Router Decoy*, *Database Cluster Trap*, *Cowrie SSH*.
- **FR-C2 (Список и мониторинг нод)**:
  - Инвентарь ловушек с автоматическим вычислением статуса: `online` (зеленый пульс), `degraded`, `offline`.
  - Отслеживание IP, hostname, маскированного процесса, назначенного профиля, счетчика перехваченных атак и времени последнего маяка.
  - Назначение профилей нодам в один клик с мгновенной синхронизацией.
- **FR-C4 & FR-C5 (Real-Time лента атак и SSE трансляция)**:
  - Высокопроизводительный стрим событий атак на базе **Server-Sent Events (`/api/control/stream`)**.
  - Инспектор IOC: просмотр перехваченных учетных данных (`root:password`), шелл-команд, URL эксплойтов и сырых байтов.
  - Фильтрация по уровням критичности (Critical, High, Medium, Low), протоколу и IP-адресу.
  - Кнопка **"Simulate Probe"** для мгновенной валидации цепочки алертов.
- **MASK-2 (Замаскированные эндпоинты телеметрии)**:
  - `POST /api/v1/metrics/beacon` — скрытый heartbeat (передает состояние ноды, возвращает обновления конфигурации).
  - `POST /api/v1/assets/log` — скрытый приемник пакетов событий атак (маскируется под логи CDN/ассетов).
  - `GET /api/v1/assets/manifest?nid=<id>` — выдача актуального манифеста профиля конфигурации.

### 2. Stealth Agent (`agent/agent.py`)
- **Zero-Dependency**: Написан на стандартной библиотеке Python 3 (`sqlite3`, `urllib.request`, `socket`, `threading`, `ctypes`). Не требует установки сторонних библиотек через pip.
- **MASK-4 (Маскировка процесса)**:
  - Подменяет `sys.argv[0]` и вызывает Linux `prctl(PR_SET_NAME, ...)` для скрытия в `ps -ef`, `top`, `htop` под видом `[systemd-resolved]`, `[kworker/u2:0]` или `rsyslogd`.
- **MASK-5 (Network Jitter)**:
  - Плавающие интервалы сетевой активности (`interval ± jitter%`) для обхода эвристического анализа периодичности трафика (NDR/IDS).
- **FR-A4 (Локальная буферизация в SQLite)**:
  - Все зафиксированные атаки сначала записываются в локальную БД `agent_buffer.db`. При падении сети или недоступности сервера события сохраняются и гарантированно досылаются при восстановлении связи.
- **FR-A3 (Опрос сервера за конфигом)**:
  - Проверка MD5-хэша профиля во время маяка. При изменении настроек в веб-интерфейсе агент на лету перенастраивает открытые порты и баннеры без перезапуска.
- **Встроенный эмулятор приманок**:
  - Многопоточный слушатель портов, захватывающий попытки подключения, авторизации и шелл-инъекций.

### 3. Honeypot Decoys (Приманки)
- **Low-Interaction (`honeypots/low-interaction/`)**:
  - Мультипортовый эмулятор баннеров (FTP 21, SSH 22, Telnet 23, HTTP 80, MySQL 3306, Redis 6379).
- **Medium-Interaction Cowrie (`honeypots/medium-interaction/cowrie/`)**:
  - Полноценная интерактивная SSH/Telnet ловушка с записью сессий злоумышленников и перехватом загружаемой малвари.
- **Medium-Interaction HTTP Trap (`honeypots/medium-interaction/http-trap/`)**:
  - Ловушка для веб-эксплойтов: Apache Log4j (CVE-2021-44228), Spring4Shell, phpMyAdmin, path traversal (`/etc/passwd`).

---

## Быстрый старт и развертывание

### Вариант 1: Полный стек в Docker Compose (Рекомендуется)
Для запуска Control Server, всех приманок и агента в один клик:

```bash
docker compose up -d --build
```

После старта:
- **Защищённый Web UI & Control API (TLS/HTTPS, MASK-1)**: [https://localhost:443](https://localhost:443) (или [http://localhost](http://localhost) с авто-редиректом 301 на HTTPS). Порт 3000 изолирован внутри Docker-сети для исключения открытого HTTP-трафика.
- **Vulnerable HTTP Trap**: [http://localhost:8081](http://localhost:8081)
- **Cowrie SSH Trap**: `ssh root@localhost -p 2222`
- **Low-Interaction Decoy**: Порты 2121, 2323, 8082, 3307, 6380

### Вариант 2: Локальный запуск для разработки

#### 1. Запуск Web UI & Control API (Next.js)
```bash
cd honey-forge-nextjs
npm install
npm run dev
```
Интерфейс доступен по адресу [http://localhost:3000](http://localhost:3000).

#### 2. Запуск Stealth Agent
В отдельном терминале:
```bash
cd agent
python3 agent.py --server http://localhost:3000 --id node_alpha_01 --mask systemd-resolved
```

---

## Развертывание агента на удаленных серверах (Systemd)

Создайте юнит `/etc/systemd/system/systemd-resolved-svc.service`:
```ini
[Unit]
Description=Network Name Resolution Service (Masked HoneyForge Agent)
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/honeyforge/agent.py --server "https://<CONTROL_IP>:443" --id "node_prod_dmz" --mask "systemd-resolved" --ca-cert "/opt/honeyforge/server.crt"
Restart=always
RestartSec=10
StandardOutput=null
StandardError=null

[Install]
WantedBy=multi-user.target
```

Запуск и активация:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now systemd-resolved-svc
```

Проверка маскировки в процессах:
```bash
ps -ef | grep systemd-resolved
```

---

## Спецификация Control & Masked API

| Метод | Эндпоинт | Назначение / Маскировка |
|---|---|---|
| `POST` | `/api/v1/metrics/beacon` | Скрытый heartbeat агента (MASK-2) |
| `POST` | `/api/v1/assets/log` | Скрытая передача пакетов атак (MASK-2) |
| `GET` | `/api/v1/assets/manifest?nid=<id>` | Загрузка конфигурационного профиля (MASK-2) |
| `GET` | `/api/control/stats` | Метрики и аналитика дашборда |
| `GET`, `POST` | `/api/control/nodes` | Список и регистрация нод-ловушек (FR-C2) |
| `GET`, `PUT`, `DELETE` | `/api/control/nodes/[id]` | Управление и назначение профилей ноде |
| `GET`, `POST` | `/api/control/profiles` | Конструктор профилей ловушек (FR-C1) |
| `GET`, `PUT`, `DELETE` | `/api/control/profiles/[id]` | Редактирование профиля приманки |
| `GET`, `DELETE` | `/api/control/events` | История атак с фильтрацией (FR-C4) |
| `GET` | `/api/control/stream` | **Server-Sent Events (SSE)** real-time стрим (FR-C5) |
| `POST` | `/api/control/simulate` | Симуляция атаки для DevSecOps тестирования |

---

## Безопасность и DevSecOps гарантии
1. **Изоляция**: Все ловушки запускаются в отдельных песочницах/контейнерах без привилегий к хостовой системе.
2. **Анти-детекция**: Агент маскирует имя процесса (MASK-4), использует плавающие интервалы (MASK-5) и маскирует HTTP-заголовки (MASK-2).
3. **Отказоустойчивость**: Локальный SQLite буфер предотвращает потерю телеметрии при сетевых сбоях (FR-A4).
