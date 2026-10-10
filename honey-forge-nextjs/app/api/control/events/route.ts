import { NextRequest, NextResponse } from 'next/server';
import { getEvents, clearEvents } from '@/lib/storage';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const severity = searchParams.get('severity') || undefined;
    const agentId = searchParams.get('agentId') || undefined;
    const search = searchParams.get('search') || undefined;

    const { events, total } = getEvents({
      limit: Math.min(Math.max(limit, 1), 500),
      offset: Math.max(offset, 0),
      severity,
      agentId,
      search,
    });

    return NextResponse.json(
      {
        events,
        total,
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error('[Control API] Error fetching attack events:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve events' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearEvents();
    return NextResponse.json({ message: 'Event logs purged' }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error clearing events:', err);
    return NextResponse.json(
      { error: 'Failed to clear events' },
      { status: 500 }
    );
  }
}
