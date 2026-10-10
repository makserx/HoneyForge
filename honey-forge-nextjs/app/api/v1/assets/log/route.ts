import { NextRequest, NextResponse } from 'next/server';
import { recordEvents, getNode } from '@/lib/storage';
import { LogBatchPayload, AttackEvent } from '@/lib/types';
import crypto from 'crypto';

const DISGUISE_HEADERS = {
  'Server': 'nginx/1.24.0',
  'X-Asset-Pipeline': 'cdn-log-worker-prod',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: DISGUISE_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = (await req.json().catch(() => null)) as LogBatchPayload | null;

    if (!rawBody || typeof rawBody !== 'object' || !Array.isArray(rawBody.events)) {
      return NextResponse.json(
        { status: 'error', message: 'Malformed asset log payload' },
        { status: 400, headers: DISGUISE_HEADERS }
      );
    }

    const agentId = rawBody.agent_id || 'unknown_node';
    const node = getNode(agentId);
    const agentName = node ? node.name : `Node-${agentId.slice(-4)}`;

    const eventsToSave = rawBody.events.map((rawEvt) => {
      const sanitized: Omit<AttackEvent, 'id'> = {
        agentId: agentId,
        agentName: agentName,
        timestamp: rawEvt.timestamp || new Date().toISOString(),
        sourceIp: String(rawEvt.source_ip || '0.0.0.0'),
        sourcePort: Number(rawEvt.source_port) || 0,
        destPort: Number(rawEvt.dest_port) || 80,
        protocol: String(rawEvt.protocol || 'TCP').toUpperCase(),
        honeypotType: String(rawEvt.honeypot_type || (node?.profileId.includes('cowrie') ? 'cowrie' : 'emulator')),
        eventType: rawEvt.event_type || 'probe',
        severity: rawEvt.severity || 'medium',
        details: rawEvt.details || {},
      };
      return sanitized;
    });

    const recorded = recordEvents(eventsToSave);
    const syncId = `sync_${crypto.randomBytes(4).toString('hex')}`;

    return NextResponse.json(
      {
        status: 'accepted',
        sync_id: syncId,
        processed: recorded.length,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: DISGUISE_HEADERS,
      }
    );
  } catch (err: unknown) {
    console.error('[API Log] Error processing asset logs:', err);
    return NextResponse.json(
      { status: 'error', message: 'Failed to ingest log stream' },
      { status: 500, headers: DISGUISE_HEADERS }
    );
  }
}
