import { NextRequest, NextResponse } from 'next/server';
import { getProfile, updateProfile, deleteProfile } from '@/lib/storage';

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const profile = getProfile(id);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ profile }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error getting profile:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Missing body' }, { status: 400 });
    }

    const updated = updateProfile(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ profile: updated, message: 'Profile updated' }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error updating profile:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const deleted = deleteProfile(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Profile deleted successfully' }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error deleting profile:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
