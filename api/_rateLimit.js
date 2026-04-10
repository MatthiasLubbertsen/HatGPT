import crypto from 'crypto';

const COOKIE_NAME = 'hatgpt_rl';
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 24h
const MAX_TRACKED_EVENTS = 256;

const globalState = globalThis;
if (!globalState.__hatgptRateLimitMemory) {
  globalState.__hatgptRateLimitMemory = {
    byIpAndRoute: new Map(),
  };
}

function nowMs() {
  return Date.now();
}

function getSecret() {
  return process.env.RATE_LIMIT_SECRET || process.env.PUBLIC_API_KEY || 'hatgpt-change-this-secret';
}

function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('base64url');
}

function parseCookies(req) {
  const header = req.headers?.cookie;
  if (!header || typeof header !== 'string') return {};

  const out = {};
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function readSignedSession(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;

  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;

  const payloadB64 = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = sign(payloadB64);
  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.sid !== 'string') return null;
    if (!payload.routes || typeof payload.routes !== 'object') payload.routes = {};
    return payload;
  } catch (_err) {
    return null;
  }
}

function createSession() {
  return {
    sid: crypto.randomUUID(),
    iat: nowMs(),
    routes: {},
  };
}

function serializeSession(session) {
  const payload = JSON.stringify(session);
  const payloadB64 = base64UrlEncode(payload);
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

function appendSetCookie(res, cookieValue) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', cookieValue);
    return;
  }

  if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, cookieValue]);
    return;
  }

  res.setHeader('Set-Cookie', [existing, cookieValue]);
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length) return realIp;
  return req.socket?.remoteAddress || 'unknown';
}

function trimEvents(events, cutoffMs) {
  if (!Array.isArray(events)) return [];
  const trimmed = events.filter((ts) => typeof ts === 'number' && ts >= cutoffMs);
  if (trimmed.length > MAX_TRACKED_EVENTS) {
    return trimmed.slice(trimmed.length - MAX_TRACKED_EVENTS);
  }
  return trimmed;
}

function updateInMemoryIpBucket(ip, routeKey, windowMs, now) {
  const map = globalState.__hatgptRateLimitMemory.byIpAndRoute;
  const key = `${ip}:${routeKey}`;
  const cutoff = now - windowMs;
  const existing = trimEvents(map.get(key), cutoff);
  existing.push(now);
  map.set(key, existing);
  return existing;
}

export function enforceRateLimit(req, res, { routeKey, limit, windowMs }) {
  const now = nowMs();
  const cutoff = now - windowMs;

  const session = readSignedSession(req) || createSession();
  const routeEvents = trimEvents(session.routes[routeKey], cutoff);
  session.routes[routeKey] = routeEvents;

  const ip = getClientIp(req);
  const ipEvents = trimEvents(globalState.__hatgptRateLimitMemory.byIpAndRoute.get(`${ip}:${routeKey}`), cutoff);
  globalState.__hatgptRateLimitMemory.byIpAndRoute.set(`${ip}:${routeKey}`, ipEvents);

  const sessionBlocked = routeEvents.length >= limit;
  const ipBlocked = ipEvents.length >= limit;

  if (sessionBlocked || ipBlocked) {
    const oldestSessionTs = routeEvents[0] || now;
    const oldestIpTs = ipEvents[0] || now;
    const retryAt = Math.min(oldestSessionTs + windowMs, oldestIpTs + windowMs);
    const retryAfterSec = Math.max(1, Math.ceil((retryAt - now) / 1000));

    appendSetCookie(
      res,
      `${COOKIE_NAME}=${serializeSession(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEFAULT_COOKIE_MAX_AGE_SECONDS}`
    );

    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSec,
      windowMs,
    };
  }

  routeEvents.push(now);
  session.routes[routeKey] = routeEvents;
  const ipUpdated = updateInMemoryIpBucket(ip, routeKey, windowMs, now);

  appendSetCookie(
    res,
    `${COOKIE_NAME}=${serializeSession(session)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEFAULT_COOKIE_MAX_AGE_SECONDS}`
  );

  const usage = Math.max(routeEvents.length, ipUpdated.length);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - usage),
    retryAfterSec: 0,
    windowMs,
  };
}