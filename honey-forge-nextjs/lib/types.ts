export type InteractionLevel = 'low' | 'medium' | 'high';

export type NodeStatus = 'online' | 'offline' | 'degraded';

export type EventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type EventType =
  | 'port_scan'
  | 'auth_attempt'
  | 'command_exec'
  | 'payload_delivery'
  | 'probe'
  | 'vulnerability_exploit';

export interface HoneypotService {
  port: number;
  service: string;
  banner: string;
  enabled: boolean;
}

export interface AgentStealthConfig {
  beaconIntervalSeconds: number;
  jitterPercent: number; // e.g. 20 means +/- 20%
  maskProcessName: string; // e.g. "systemd-resolved" or "[kworker/u2:0]"
  bufferLimit: number; // max events in SQLite buffer
  logRotationMb: number;
}

export interface DecoyCredential {
  username: string;
  password: string;
  role?: string;
}

export interface HoneypotProfile {
  id: string;
  name: string;
  description: string;
  interactionLevel: InteractionLevel;
  honeypotType: 'emulator' | 'cowrie' | 'http_trap' | 'custom';
  ports: number[];
  services: HoneypotService[];
  decoyCredentials?: DecoyCredential[];
  agentConfig: AgentStealthConfig;
  createdAt: string;
  updatedAt: string;
}

export interface NodeStats {
  totalEvents: number;
  lastEventAt?: string;
  uptimeSeconds: number;
  cpuPercent?: number;
  memoryMb?: number;
}

export interface HoneypotNode {
  id: string;
  name: string;
  hostname: string;
  ip: string;
  status: NodeStatus;
  lastSeen: string;
  profileId: string;
  profileName: string;
  version: string;
  maskProcess: string;
  os: string;
  jitterSeconds: number;
  stats: NodeStats;
  tags: string[];
  registeredAt: string;
}

export interface AttackEventDetails {
  username?: string;
  password?: string;
  command?: string;
  payload?: string;
  url?: string;
  method?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  rawData?: string;
  matchedSignature?: string;
}

export interface AttackEvent {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  sourceIp: string;
  sourcePort: number;
  destPort: number;
  protocol: string; // TCP, UDP, HTTP, SSH, etc.
  honeypotType: string;
  eventType: EventType;
  severity: EventSeverity;
  details: AttackEventDetails;
  country?: string;
  city?: string;
  asn?: string;
}

export interface BeaconPayload {
  agent_id: string;
  hostname: string;
  ip?: string;
  os?: string;
  version?: string;
  mask_process?: string;
  current_config_hash?: string;
  stats?: {
    total_events?: number;
    uptime_seconds?: number;
    cpu_percent?: number;
    memory_mb?: number;
  };
}

export interface BeaconResponse {
  status: 'ok' | 'error';
  acknowledged: boolean;
  server_time: string;
  config_update?: boolean;
  profile?: HoneypotProfile;
  message?: string;
}

export interface LogBatchPayload {
  batch_id: string;
  agent_id: string;
  timestamp: string;
  count: number;
  events: Array<{
    id?: string;
    timestamp?: string;
    source_ip: string;
    source_port: number;
    dest_port: number;
    protocol?: string;
    honeypot_type?: string;
    event_type?: EventType;
    severity?: EventSeverity;
    details?: AttackEventDetails;
  }>;
}

export interface SystemStats {
  totalNodes: number;
  onlineNodes: number;
  offlineNodes: number;
  totalProfiles: number;
  totalEvents: number;
  eventsLast24h: number;
  criticalEvents: number;
  topProtocols: Array<{ protocol: string; count: number }>;
  topAttackerIps: Array<{ ip: string; count: number; country?: string }>;
  recentVelocity: Array<{ time: string; count: number }>;
}
