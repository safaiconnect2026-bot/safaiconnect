/**
 * Lightweight mock API server that emulates the Vercel serverless
 * function contract for Playwright testing.
 *
 * Validates request shapes (method, required fields) identically
 * to the real handlers, but returns deterministic mock responses
 * instead of calling external APIs (OpenAI, GCP, FCM).
 *
 * Usage: npx tsx tests/api-server.ts
 * Starts on port 3099 (override with API_TEST_PORT env var).
 */
import http from 'node:http';

const PORT = Number(process.env.API_TEST_PORT) || 3099;

function json(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── Handlers ─────────────────────────────────────────────────────────────

function handleClassifyWaste(method: string, body: any, res: http.ServerResponse) {
  if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!body.imageBase64) return json(res, 400, { error: 'Missing imageBase64' });

  return json(res, 200, {
    sceneDescription: 'A plastic bottle on a kitchen counter.',
    context: 'kitchen',
    imageQuality: {
      exposure: 'normal',
      noisy: false,
      quality: 'good',
    },
    items: [
      {
        wasteType: 'PET Plastic Bottle',
        subCategory: 'Recyclable Plastic',
        category: 'Dry Waste',
        bin: 'Blue Bin',
        binColor: '#3B82F6',
        recyclable: true,
        instructions: 'Rinse and crush the bottle, then place in the blue bin.',
        confidence: 0.92,
        region: { x: 10, y: 10, width: 80, height: 80 },
      },
    ],
    unknownObjects: [],
    webContext: {},
    // legacy fields
    wasteType: 'PET Plastic Bottle',
    category: 'Dry Waste',
    bin: 'Blue Bin',
    binColor: '#3B82F6',
    recyclable: true,
    instructions: 'Rinse and crush the bottle, then place in the blue bin.',
    confidence: 0.92,
  });
}

function handleAnalyzePhoto(method: string, body: any, res: http.ServerResponse) {
  if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!body.imageBase64) return json(res, 400, { error: 'Missing imageBase64' });
  return json(res, 200, {
    category: 'Other',
    severity: 'low',
    description: 'Test image analysis result',
    confidence: 0.42,
  });
}

function handleNotify(method: string, body: any, res: http.ServerResponse) {
  if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!body.tokens?.length || !body.title || !body.body) {
    return json(res, 400, { error: 'Missing tokens, title, or body' });
  }
  const count = body.tokens.length;
  // Simulate: real tokens would succeed, fake ones fail
  return json(res, 200, { successCount: 0, failureCount: count });
}

function handleTranscribe(method: string, body: any, res: http.ServerResponse) {
  if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!body.audio || !body.languageCode) {
    return json(res, 400, { error: 'Missing audio or languageCode' });
  }
  return json(res, 200, { transcript: '' });
}

// ── Router ───────────────────────────────────────────────────────────────

const routes: Record<string, (m: string, b: any, r: http.ServerResponse) => void> = {
  'classify-waste': handleClassifyWaste,
  'analyze-photo':  handleAnalyzePhoto,
  'notify':         handleNotify,
  'transcribe':     handleTranscribe,
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const key = url.pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  const handler = routes[key];

  if (!handler) return json(res, 404, { error: 'Not found' });

  const body = await parseBody(req);
  handler(req.method || 'GET', body, res);
});

server.listen(PORT, () => {
  console.log(`API test server listening on http://localhost:${PORT}`);
});
