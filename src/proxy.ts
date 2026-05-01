import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from '@convex-dev/auth/nextjs/server';

const isLoginPage = createRouteMatcher(['/login']);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  // Only gate page navigations (GETs). POSTs are either:
  //   • the /api/auth handshake (proxied by the middleware itself),
  //   • Convex Auth's `invalidateCache` Server Action that fires on token
  //     state changes (POSTs to the current URL — redirecting it breaks the
  //     Server-Action RSC stream and hangs the client-side `await signIn`).
  // Letting non-GETs fall through fixes both.
  if (request.method !== 'GET') return;

  const isAuthenticated = await convexAuth.isAuthenticated();

  if (isLoginPage(request) && isAuthenticated) {
    return nextjsMiddlewareRedirect(request, '/');
  }
  if (!isLoginPage(request) && !isAuthenticated) {
    const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return nextjsMiddlewareRedirect(request, `/login?next=${next}`);
  }
});

export const config = {
  // Run on every path except Next internals and static assets. /api/auth is
  // intentionally INCLUDED so the middleware can proxy it to the Convex
  // backend.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.[a-z0-9]+$).*)'],
};
