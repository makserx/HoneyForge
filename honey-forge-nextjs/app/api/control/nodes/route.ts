import { NextRequest, NextResponse } from 'next/server';
import { getNodes, upsertNode } from '@/lib/storage';

export async function GET() {
  try {
    const nodes = getNodes();
    return NextResponse.json({ nodes, count: nodes.length }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error fetching nodes:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve nodes' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || !body.id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const node = upsertNode(body);
    return NextResponse.json({ node, message: 'Node registered' }, { status: 201 });
  } catch (err: unknown) {
    console.error('[Control API] Error registering node:', err);
    return NextResponse.json(
      { error: 'Failed to register node' },
      { status: 500 }
    );
  }
}
