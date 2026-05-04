/**
 * After a successful sign-in we need a *hard* navigation, not router.replace.
 * Two reasons: (1) router.replace inside the same React commit as the auth
 * state change can be silently dropped under Cache Components, and (2) a
 * hard navigation guarantees the proxy/middleware reads the freshly-set
 * auth cookie on the next request, eliminating any stale-token race.
 *
 * `?next=` is user-controlled (anyone can craft a /login link) so we must
 * only honour same-origin paths. Reject anything that doesn't start with a
 * single `/`, including protocol-relative `//evil.com` and any URL scheme
 * such as `javascript:` (which `window.location.assign` would still execute
 * in the post-auth origin).
 */
export function safeRedirectTarget(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (raw.length === 0 || raw[0] !== '/') return '/';
  if (raw.length > 1 && raw[1] === '/') return '/'; // protocol-relative
  if (raw[1] === '\\') return '/'; // backslash-confusion
  return raw;
}

export function navigateAfterAuth(target: string) {
  window.location.assign(target);
}
