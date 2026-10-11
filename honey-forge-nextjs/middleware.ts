import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'honeyforge-secret-soc-2026';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow the authentication endpoint through
  if (pathname === '/api/control/auth') {
    return NextResponse.next();
  }

  // 2. Protect operator control plane API routes (/api/control/*)
  // Note: Agent telemetry (/api/v1/*) is excluded by matcher and untouched
  if (pathname.startsWith('/api/control')) {
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader?.trim();

    const cookieToken = req.cookies.get('hf_session')?.value;
    const token = bearerToken || cookieToken;

    if (!token || token !== ADMIN_TOKEN) {
      return NextResponse.json(
        {
          error: 'Unauthorized: Требуется токен оператора HoneyForge SOC (FR-C5)',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/control/:path*'],
};
