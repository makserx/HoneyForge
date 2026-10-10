import { NextRequest, NextResponse } from 'next/server';
import { getNode, getProfile, getProfiles } from '@/lib/storage';
import crypto from 'crypto';

const DISGUISE_HEADERS = {
  'Server': 'nginx/1.24.0',
  'X-Manifest-Version': '2026.10-rev3',
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const agentId = searchParams.get('aid') || searchParams.get('nid');

    let profile = undefined;
    if (agentId) {
      const node = getNode(agentId);
      if (node) {
        profile = getProfile(node.profileId);
      }
    }

    if (!profile) {
      // Default fallback profile
      const all = getProfiles();
      profile = all[0];
    }

    const configHash = crypto
      .createHash('md5')
      .update(JSON.stringify(profile))
      .digest('hex');

    return NextResponse.json(
      {
        manifest_id: profile.id,
        hash: configHash,
        profile: profile,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: DISGUISE_HEADERS,
      }
    );
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest === 'NEXT_PRERENDER_INTERRUPTED') {
      throw err;
    }
    console.error('[API Manifest] Error fetching manifest config:', err);
    return NextResponse.json(
      { error: 'Manifest not found' },
      { status: 404, headers: DISGUISE_HEADERS }
    );
  }
}
