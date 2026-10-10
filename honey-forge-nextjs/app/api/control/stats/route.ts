import { NextResponse } from 'next/server';
import { getStats } from '@/lib/storage';

export async function GET() {
  try {
    const stats = getStats();
    return NextResponse.json(stats, { status: 200 });
  } catch (err: unknown) {
    console.error('[Control API] Error fetching system stats:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve stats' },
      { status: 500 }
    );
  }
}
