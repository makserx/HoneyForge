import { NextRequest, NextResponse } from 'next/server';
import { updateNodeHeartbeat } from '@/lib/storage';
import { BeaconPayload, BeaconResponse } from '@/lib/types';

// Маскировочные заголовки ответа для скрытия control plane
const DISGUISE_HEADERS = {
  'Server': 'nginx/1.24.0',
  'X-Telemetry-Ingest': 'v2.1-metrics-collector',
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
    const rawBody = await req.json().catch(() => null);

    if (!rawBody || typeof rawBody !== 'object' || !rawBody.agent_id) {
      return NextResponse.json(
        { status: 'error', acknowledged: false, message: 'Invalid metric payload' },
        { status: 400, headers: DISGUISE_HEADERS }
      );
    }

    // Извлечение IP клиента, если он не указан в полезной нагрузке
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : realIp || rawBody.ip || '127.0.0.1';

    const payload: BeaconPayload = {
      agent_id: String(rawBody.agent_id),
      hostname: String(rawBody.hostname || 'unknown-host'),
      ip: clientIp,
      os: rawBody.os ? String(rawBody.os) : undefined,
      version: rawBody.version ? String(rawBody.version) : undefined,
      mask_process: rawBody.mask_process ? String(rawBody.mask_process) : undefined,
      current_config_hash: rawBody.current_config_hash ? String(rawBody.current_config_hash) : undefined,
      stats: rawBody.stats,
    };

    const { configUpdated, profile } = updateNodeHeartbeat(payload);

    const responseData: BeaconResponse = {
      status: 'ok',
      acknowledged: true,
      server_time: new Date().toISOString(),
      config_update: configUpdated,
      profile: profile,
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: DISGUISE_HEADERS,
    });
  } catch (err: unknown) {
    console.error('[API Beacon] Error processing telemetry beacon:', err);
    return NextResponse.json(
      { status: 'error', acknowledged: false, message: 'Internal processing error' },
      { status: 500, headers: DISGUISE_HEADERS }
    );
  }
}
