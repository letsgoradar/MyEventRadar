import { URL } from "url";
import { isIP } from "net";

const BLOCKED_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
  /^fd/,
];

const BLOCKED_PROTOCOLS = ["file:", "ftp:", "gopher:", "data:", "javascript:"];

export function isUrlSafe(rawUrl: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);

    if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
      return { safe: false, reason: `Blocked protocol: ${parsed.protocol}` };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, reason: `Only http/https allowed, got: ${parsed.protocol}` };
    }

    const hostname = parsed.hostname;

    if (hostname === "localhost" || hostname === "") {
      return { safe: false, reason: "Localhost access blocked" };
    }

    if (isIP(hostname)) {
      for (const pattern of BLOCKED_IP_RANGES) {
        if (pattern.test(hostname)) {
          return { safe: false, reason: `Private/reserved IP blocked: ${hostname}` };
        }
      }
    }

    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return { safe: false, reason: `Internal hostname blocked: ${hostname}` };
    }

    if (parsed.port && !["80", "443", "8080", "8443"].includes(parsed.port)) {
      return { safe: false, reason: `Unusual port blocked: ${parsed.port}` };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }
}

export function validateExternalUrl(url: string, context: string): void {
  const result = isUrlSafe(url);
  if (!result.safe) {
    console.warn(`[SSRF] Blocked ${context}: ${url} — ${result.reason}`);
    throw new Error(`URL niet toegestaan: ${result.reason}`);
  }
}
