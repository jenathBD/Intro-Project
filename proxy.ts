import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';

// Optimistisk tjek: findes der overhovedet en session-cookie? Ingen database her.
// Den rigtige kontrol sker i lib/session.ts (requireSession).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Alle stier undtagen login, Better Auths API og Next's egne filer
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
};
