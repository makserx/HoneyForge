import { NextRequest, NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'honeyforge-secret-soc-2026';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : authHeader?.trim();

    const cookieToken = req.cookies.get('hf_session')?.value;
    const token = bearer || cookieToken;

    if (token && token === ADMIN_TOKEN) {
      return NextResponse.json({ authenticated: true, role: 'soc_operator' }, { status: 200 });
    }

    return NextResponse.json({ authenticated: false }, { status: 200 });
  } catch (err: unknown) {
    console.error('[Auth API] Error verifying auth:', err);
    return NextResponse.json({ authenticated: false, error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const provided = (body?.token || body?.password || '').trim();

    if (!provided) {
      return NextResponse.json(
        { success: false, error: 'Укажите токен доступа оператора' },
        { status: 400 }
      );
    }

    if (provided !== ADMIN_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Неверный токен доступа оператора SOC' },
        { status: 401 }
      );
    }

    const res = NextResponse.json(
      {
        success: true,
        message: 'Аутентификация оператора SOC успешна',
        role: 'soc_operator',
      },
      { status: 200 }
    );

    res.cookies.set('hf_session', ADMIN_TOKEN, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err: unknown) {
    console.error('[Auth API] Error logging in:', err);
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера при аутентификации' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const res = NextResponse.json(
    { success: true, message: 'Сессия оператора завершена' },
    { status: 200 }
  );

  res.cookies.set('hf_session', '', {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 0,
  });

  return res;
}
