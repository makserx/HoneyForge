import { NextRequest, NextResponse } from 'next/server';
import { getNode, deleteNode, assignProfileToNode, upsertNode } from '@/lib/storage';

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const node = getNode(id);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    return NextResponse.json({ node }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error fetching node:', err);
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

    if (body.profileId) {
      const updated = assignProfileToNode(id, body.profileId);
      if (!updated) {
        return NextResponse.json({ error: 'Failed to assign profile' }, { status: 404 });
      }
      return NextResponse.json({ node: updated, message: 'Profile assigned' }, { status: 200 });
    }

    const updated = upsertNode({ ...body, id });
    return NextResponse.json({ node: updated, message: 'Node updated' }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error updating node:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const deleted = deleteNode(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Node deleted successfully' }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error deleting node:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
