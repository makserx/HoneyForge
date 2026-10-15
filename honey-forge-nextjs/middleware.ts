import { NextResponse, type NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'honeyforge-secret-soc-2026';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Пропускаем эндпоинт аутентификации
  if (pathname === '/api/control/auth') {
    return NextResponse.next();
  }

  // 2. Защита маршрутов API панели управления оператора (/api/control/*)
  // Примечание: телеметрия агента (/api/v1/*) исключена правилом matcher и не затрагивается
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
