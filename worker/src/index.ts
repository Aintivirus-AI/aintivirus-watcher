/**
 * watcher-backend — the Worker in front of the VisitorRoom Durable Object.
 *
 * Everything stateful (sockets, history, chat) lives in the single DO room;
 * this layer routes, enforces CORS, and answers /api/analyze directly since
 * the analysis is a pure function with no shared state.
 */
import {
  generateLocalAnalysis,
  UserDataForAnalysis,
} from '../../server/analysis';
import { VisitorRoom } from './room';

export { VisitorRoom };

interface Env {
  ROOM: DurableObjectNamespace;
}

const ALLOWED_ORIGINS = new Set([
  'https://watcher.stuffmonger.com',
  'https://aintivirus-watcher.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5211',
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'null',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // One global room. The id is fixed so every visitor lands together.
    const room = env.ROOM.get(env.ROOM.idFromName('global'));

    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      return room.fetch(request);
    }

    if (url.pathname === '/api/analyze' && request.method === 'POST') {
      return handleAnalyze(request);
    }

    if (
      url.pathname === '/api/visitors/history' ||
      url.pathname === '/api/visitors/stats' ||
      url.pathname === '/health'
    ) {
      const response = await room.fetch(request);
      const withCors = new Response(response.body, response);
      for (const [k, v] of Object.entries(corsHeaders(request))) {
        withCors.headers.set(k, v);
      }
      return withCors;
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleAnalyze(request: Request): Promise<Response> {
  const headers = {
    'content-type': 'application/json',
    ...corsHeaders(request),
  };
  let userData: UserDataForAnalysis;
  try {
    userData = (await request.json()) as UserDataForAnalysis;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON' }),
      { status: 400, headers },
    );
  }

  if (
    !userData ||
    typeof userData !== 'object' ||
    !userData.hardware ||
    !userData.network ||
    !userData.browser ||
    !userData.fingerprints ||
    !userData.behavioral ||
    !userData.botDetection
  ) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid request data' }),
      { status: 400, headers },
    );
  }

  const analysis = generateLocalAnalysis(userData);
  return new Response(
    JSON.stringify({ success: true, analysis, fallback: false }),
    { status: 200, headers },
  );
}
