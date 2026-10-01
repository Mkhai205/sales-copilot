#!/usr/bin/env node
/**
 * Mock Zalo server for local testing WITHOUT a real Zalo OA or an approved Zalo App.
 *
 * Covers the endpoints Sales Copilot calls:
 *   GET  /v3.0/oa                 → OA info (lifecycle validation)
 *   POST /v3.0/oa/user/info       → sender profile (Contact sync)
 *   POST /v3.0/oa/message/cs      → send CS message (outbound agent/AI replies)
 *   POST /v4/oa/access_token      → OAuth token exchange/refresh (completeness)
 *
 * Usage:
 *   ZALO_MOCK_PORT=8321 node apps/server/scripts/zalo-mock-server.mjs
 * then set in apps/server/.env:
 *   ZALO_OPEN_API_BASE=http://localhost:8321/v3.0
 * and follow docs/guides/zalo-local-testing.md for the full runbook.
 */
import http from 'node:http';

const PORT = Number(process.env.ZALO_MOCK_PORT || 8321);

let csCounter = 0;

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function sendJson(res, body, status = 200) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const body = await readBody(req);
  const accessToken = req.headers['access_token'];

  console.log(`[zalo-mock] ${req.method} ${url.pathname} (access_token: ${accessToken || '—'})`);
  if (body) {
    console.log(`[zalo-mock]   body: ${body.slice(0, 500)}`);
  }

  // OA info — used by ZaloLifecycleService validation
  if (req.method === 'GET' && url.pathname === '/v3.0/oa') {
    return sendJson(res, {
      oa_id: 'mock_oa_123',
      name: 'Mock Zalo OA',
      description: 'Local mock for testing',
      avatar: 'https://via.placeholder.com/120.png',
    });
  }

  // Sender profile — used by fetchSenderInfo (Contact sync)
  if (req.method === 'POST' && url.pathname === '/v3.0/oa/user/info') {
    let parsed = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      /* ignore */
    }
    const userId = parsed.user_id || 'unknown_user';
    return sendJson(res, {
      error: 0,
      user_id: userId,
      display_name: `Mock User (${userId.slice(-4)})`,
      avatar: 'https://via.placeholder.com/80.png',
      user_alias: `mock_${userId.slice(-4)}`,
    });
  }

  // Send CS message — used by outbound agent/AI replies
  if (req.method === 'POST' && url.pathname === '/v3.0/oa/message/cs') {
    csCounter += 1;
    let parsed = {};
    try {
      parsed = JSON.parse(body || '{}');
    } catch {
      /* ignore */
    }
    const text = parsed?.message?.text ?? '(no text)';
    console.log(
      `[zalo-mock]   → delivering to user '${parsed?.recipient?.user_id}': ${typeof text === 'string' ? text.slice(0, 120) : JSON.stringify(text).slice(0, 120)}`,
    );
    return sendJson(res, { error: 0, msg_id: `mock_msg_${csCounter}`, message: 'Success (mock)' });
  }

  // OAuth token exchange/refresh — completeness only (local tests use static tokens)
  if (req.method === 'POST' && url.pathname === '/v4/oa/access_token') {
    return sendJson(res, {
      access_token: 'mock_access_token',
      refresh_token: `mock_refresh_${Date.now()}`,
      expires_in: 90000,
    });
  }

  return sendJson(res, { error: -1, message: `Mock has no route for ${req.method} ${url.pathname}` }, 404);
});

server.listen(PORT, () => {
  console.log(`[zalo-mock] Mock Zalo server listening on http://localhost:${PORT}`);
  console.log(`[zalo-mock] Set ZALO_OPEN_API_BASE=http://localhost:${PORT}/v3.0 in apps/server/.env`);
});
