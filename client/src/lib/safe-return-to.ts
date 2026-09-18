export function safeReturnTo(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback;
  let decoded = candidate;
  try {
    for (let i = 0; i < 3; i += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return fallback;
  }
  if (/[\u0000-\u001f\\]/.test(decoded) || decoded.startsWith("//")) return fallback;
  try {
    const url = new URL(decoded, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}