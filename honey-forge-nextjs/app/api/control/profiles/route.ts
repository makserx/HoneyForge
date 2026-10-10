import { NextRequest, NextResponse } from 'next/server';
import { getProfiles, createProfile } from '@/lib/storage';

export async function GET() {
  try {
    const profiles = getProfiles();
    return NextResponse.json({ profiles, count: profiles.length }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error fetching profiles:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve profiles' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.name || !body.interactionLevel) {
      return NextResponse.json(
        { error: 'Invalid profile data. Name and interactionLevel are required.' },
        { status: 400 }
      );
    }

    const newProfile = createProfile({
      name: String(body.name),
      description: String(body.description || ''),
      interactionLevel: body.interactionLevel,
      honeypotType: body.honeypotType || 'emulator',
      ports: Array.isArray(body.ports) ? body.ports : [22, 80],
      services: Array.isArray(body.services) ? body.services : [],
      agentConfig: body.agentConfig || {
        beaconIntervalSeconds: 15,
        jitterPercent: 20,
        maskProcessName: 'systemd-resolved',
        bufferLimit: 5000,
        logRotationMb: 25,
      },
    });

    return NextResponse.json({ profile: newProfile, message: 'Profile created' }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Control API] Error creating profile:', err);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
