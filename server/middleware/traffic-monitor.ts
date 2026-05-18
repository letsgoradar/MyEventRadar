import type { Request, Response, NextFunction } from "express";

interface TrafficWindow {
  count: number;
  uniqueIps: Set<string>;
  startTime: number;
  endpointCounts: Map<string, number>;
}

interface AlertRecord {
  level: "warning" | "critical" | "circuit_breaker_on" | "circuit_breaker_off";
  timestamp: Date;
  requestsPerMin: number;
  uniqueIps: number;
  topEndpoints: { endpoint: string; count: number }[];
}

const WARN_THRESHOLD = 1500;   // ~30 simultaneous users loading the SPA
const CRITICAL_THRESHOLD = 4000; // genuine spike / potential attack
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

let currentMinuteWindow: TrafficWindow = createWindow();
let currentHourWindow: TrafficWindow = createWindow();
let circuitBreakerActive = false;
let circuitBreakerActivatedAt: number | null = null;
let circuitBreakerManualOverride: boolean | null = null;
let lastAlertTime: number = 0;
let alertHistory: AlertRecord[] = [];

function createWindow(): TrafficWindow {
  return {
    count: 0,
    uniqueIps: new Set(),
    startTime: Date.now(),
    endpointCounts: new Map(),
  };
}

function rotateWindowIfNeeded(window: TrafficWindow, intervalMs: number): TrafficWindow {
  if (Date.now() - window.startTime > intervalMs) {
    return createWindow();
  }
  return window;
}

function getTopEndpoints(window: TrafficWindow, limit = 5): { endpoint: string; count: number }[] {
  return Array.from(window.endpointCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([endpoint, count]) => ({ endpoint, count }));
}

function simplifyEndpoint(path: string): string {
  return path.replace(/\/\d+/g, "/:id").replace(/\/[a-f0-9]{32,}/g, "/:token");
}

function addAlert(level: AlertRecord["level"], requestsPerMin: number, uniqueIps: number, topEndpoints: { endpoint: string; count: number }[]) {
  const record: AlertRecord = {
    level,
    timestamp: new Date(),
    requestsPerMin,
    uniqueIps,
    topEndpoints,
  };
  alertHistory.unshift(record);
  if (alertHistory.length > 20) alertHistory.pop();
  return record;
}

async function sendAlert(level: "warning" | "critical", stats: { requestsPerMin: number; uniqueIps: number; topEndpoints: { endpoint: string; count: number }[] }) {
  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) return;
  lastAlertTime = now;

  addAlert(level, stats.requestsPerMin, stats.uniqueIps, stats.topEndpoints);

  try {
    const { sendTrafficAlertEmail } = await import("../services/email-service");
    await sendTrafficAlertEmail(level, stats);
  } catch (e) {
    console.error("[Traffic Monitor] Failed to send alert email:", e);
  }
}

async function sendCircuitBreakerEmail(activated: boolean, stats: { requestsPerMin: number; uniqueIps: number; topEndpoints: { endpoint: string; count: number }[] }) {
  const level = activated ? "circuit_breaker_on" : "circuit_breaker_off";
  addAlert(level, stats.requestsPerMin, stats.uniqueIps, stats.topEndpoints);

  try {
    const { sendTrafficAlertEmail } = await import("../services/email-service");
    await sendTrafficAlertEmail(level, stats);
  } catch (e) {
    console.error("[Traffic Monitor] Failed to send circuit breaker email:", e);
  }
}

function activateCircuitBreaker(stats: { requestsPerMin: number; uniqueIps: number; topEndpoints: { endpoint: string; count: number }[] }) {
  if (circuitBreakerActive) return;
  circuitBreakerActive = true;
  circuitBreakerActivatedAt = Date.now();
  console.warn(`[Traffic Monitor] CIRCUIT BREAKER ACTIVATED — ${stats.requestsPerMin} req/min from ${stats.uniqueIps} IPs`);
  sendCircuitBreakerEmail(true, stats);
}

function deactivateCircuitBreaker() {
  if (!circuitBreakerActive) return;
  circuitBreakerActive = false;
  const stats = { requestsPerMin: currentMinuteWindow.count, uniqueIps: currentMinuteWindow.uniqueIps.size, topEndpoints: getTopEndpoints(currentMinuteWindow) };
  console.log("[Traffic Monitor] Circuit breaker deactivated — traffic returned to normal");
  circuitBreakerActivatedAt = null;
  sendCircuitBreakerEmail(false, stats);
}

const ALLOWED_PATHS_DURING_CIRCUIT_BREAK = [
  "/api/health",
  "/api/auth/login",
  "/api/auth/me",
  "/api/admin/circuit-breaker",
  "/api/admin/traffic-status",
];

function isAllowedDuringCircuitBreak(path: string): boolean {
  if (!path.startsWith("/api")) return true;
  return ALLOWED_PATHS_DURING_CIRCUIT_BREAK.some(p => path.startsWith(p));
}

export function trafficMonitor(req: Request, res: Response, next: NextFunction) {
  currentMinuteWindow = rotateWindowIfNeeded(currentMinuteWindow, 60 * 1000);
  currentHourWindow = rotateWindowIfNeeded(currentHourWindow, 60 * 60 * 1000);

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const endpoint = simplifyEndpoint(req.path);

  currentMinuteWindow.count++;
  currentMinuteWindow.uniqueIps.add(ip);
  currentMinuteWindow.endpointCounts.set(endpoint, (currentMinuteWindow.endpointCounts.get(endpoint) || 0) + 1);

  currentHourWindow.count++;
  currentHourWindow.uniqueIps.add(ip);
  currentHourWindow.endpointCounts.set(endpoint, (currentHourWindow.endpointCounts.get(endpoint) || 0) + 1);

  if (circuitBreakerManualOverride !== null) {
    if (circuitBreakerManualOverride && !isAllowedDuringCircuitBreak(req.path)) {
      return res.status(503).json({ error: "Service tijdelijk gepauzeerd door beheerder." });
    }
    if (!circuitBreakerManualOverride) {
      return next();
    }
  }

  if (circuitBreakerActive && circuitBreakerActivatedAt) {
    if (Date.now() - circuitBreakerActivatedAt > CIRCUIT_BREAKER_COOLDOWN_MS) {
      deactivateCircuitBreaker();
    } else if (!isAllowedDuringCircuitBreak(req.path)) {
      return res.status(503).json({
        error: "Service tijdelijk gepauzeerd vanwege ongewoon hoog verkeer. Probeer het over enkele minuten opnieuw.",
        retryAfter: Math.ceil((CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - circuitBreakerActivatedAt)) / 1000),
      });
    }
  }

  const reqPerMin = currentMinuteWindow.count;
  const stats = {
    requestsPerMin: reqPerMin,
    uniqueIps: currentMinuteWindow.uniqueIps.size,
    topEndpoints: getTopEndpoints(currentMinuteWindow),
  };

  if (reqPerMin >= CRITICAL_THRESHOLD) {
    activateCircuitBreaker(stats);
  } else if (reqPerMin >= WARN_THRESHOLD) {
    sendAlert("warning", stats);
  }

  next();
}

export function getTrafficStatus() {
  currentMinuteWindow = rotateWindowIfNeeded(currentMinuteWindow, 60 * 1000);
  currentHourWindow = rotateWindowIfNeeded(currentHourWindow, 60 * 60 * 1000);

  return {
    requestsPerMinute: currentMinuteWindow.count,
    requestsPerHour: currentHourWindow.count,
    uniqueIpsMinute: currentMinuteWindow.uniqueIps.size,
    uniqueIpsHour: currentHourWindow.uniqueIps.size,
    topEndpointsMinute: getTopEndpoints(currentMinuteWindow),
    topEndpointsHour: getTopEndpoints(currentHourWindow, 10),
    circuitBreaker: {
      active: circuitBreakerManualOverride !== null ? circuitBreakerManualOverride : circuitBreakerActive,
      manualOverride: circuitBreakerManualOverride,
      activatedAt: circuitBreakerActivatedAt ? new Date(circuitBreakerActivatedAt).toISOString() : null,
      cooldownRemainingSeconds: circuitBreakerActive && circuitBreakerActivatedAt
        ? Math.max(0, Math.ceil((CIRCUIT_BREAKER_COOLDOWN_MS - (Date.now() - circuitBreakerActivatedAt)) / 1000))
        : 0,
    },
    thresholds: {
      warning: WARN_THRESHOLD,
      critical: CRITICAL_THRESHOLD,
    },
    alertHistory: alertHistory.slice(0, 10),
  };
}

export function setCircuitBreakerManualOverride(enabled: boolean | null) {
  circuitBreakerManualOverride = enabled;
  if (enabled === false || enabled === null) {
    circuitBreakerActive = false;
    circuitBreakerActivatedAt = null;
  }
  if (enabled === true) {
    circuitBreakerActivatedAt = Date.now();
  }
  console.log(`[Traffic Monitor] Circuit breaker manual override: ${enabled === null ? "auto" : enabled ? "ON" : "OFF"}`);
}
