import { test, expect } from '@playwright/test';

/**
 * API Endpoint Tests — All Vercel Serverless Functions
 *
 * Covers:
 *   /api/classify-waste  (OpenAI GPT-4o Vision — multi-item waste detection)
 *   /api/analyze-photo   (OpenAI GPT-4o Vision — civic complaint photo)
 *   /api/notify          (Firebase Cloud Messaging push notifications)
 *   /api/transcribe      (Google Cloud Speech-to-Text)
 *
 * Locally the tests hit a lightweight mock server (tests/api-server.ts)
 * that validates the same request contracts as the real handlers and
 * returns deterministic mock responses.
 *
 * Start the server first:  npx tsx tests/api-server.ts
 * Then run tests:          npx playwright test tests/e2e/api.spec.ts
 *
 * To test against a real deployment instead:
 *   API_TEST_URL=https://your-app.vercel.app npx playwright test tests/e2e/api.spec.ts
 */

const BASE = process.env.API_TEST_URL || `http://localhost:${process.env.API_TEST_PORT || 3099}`;

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Tiny 1×1 white JPEG encoded as base64 — minimal valid image */
const MINIMAL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QAIhAAAQMEAwEBAAAAAAAAAAAAAQIDBAAFERIhMUH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmWua5Xt+ub3b47l0ZuPRStqL2pJSBgYH2P3XTqSogkEYBBBGDkdaUUAf/9k=';

const VALID_WASTE_CATEGORIES = [
  'Dry Waste',
  'Wet Waste',
  'Hazardous Waste',
  'Sanitary Waste',
  'E-Waste',
  'Unknown',
];

const VALID_CIVIC_CATEGORIES = [
  'Waste Management',
  'Road Damage',
  'Street Lighting',
  'Drainage/Sewage',
  'Public Property Damage',
  'Water Supply',
  'Noise Pollution',
  'Other',
];

// Minimal valid WebM-Opus audio — silence, ~0.1s (base64)
const MINIMAL_AUDIO_BASE64 = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOA';

// ═══════════════════════════════════════════════════════════════════════════
// 1. /api/classify-waste  (multi-item waste detection + image diagnosis)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('/api/classify-waste', () => {
  test('rejects GET with 405', async ({ request }) => {
    const res = await request.get(`${BASE}/api/classify-waste`);
    expect(res.status()).toBe(405);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/method not allowed/i);
  });

  test('rejects POST without imageBase64 with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { mimeType: 'image/jpeg' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/missing/i);
  });

  test('rejects POST with empty body with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 200 with valid imageBase64', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    expect(res.status()).toBe(200);
  });

  test('response contains all required top-level fields', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    const body = await res.json();

    // New fields
    expect(body).toHaveProperty('sceneDescription');
    expect(body).toHaveProperty('context');
    expect(body).toHaveProperty('imageQuality');
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('unknownObjects');

    // Legacy backward-compat fields
    expect(body).toHaveProperty('wasteType');
    expect(body).toHaveProperty('category');
    expect(body).toHaveProperty('bin');
    expect(body).toHaveProperty('binColor');
    expect(body).toHaveProperty('recyclable');
    expect(body).toHaveProperty('instructions');
    expect(body).toHaveProperty('confidence');
  });

  test('imageQuality object has required fields with valid values', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    const body = await res.json();
    const q = body.imageQuality;

    expect(q).toHaveProperty('exposure');
    expect(q).toHaveProperty('noisy');
    expect(q).toHaveProperty('quality');

    expect(['underexposed', 'normal', 'overexposed']).toContain(q.exposure);
    expect(typeof q.noisy).toBe('boolean');
    expect(['poor', 'acceptable', 'good']).toContain(q.quality);
  });

  test('items is an array', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('each item has required fields with valid values', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    const body = await res.json();

    for (const item of body.items) {
      expect(item).toHaveProperty('wasteType');
      expect(item).toHaveProperty('subCategory');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('bin');
      expect(item).toHaveProperty('binColor');
      expect(item).toHaveProperty('recyclable');
      expect(item).toHaveProperty('instructions');
      expect(item).toHaveProperty('confidence');
      expect(item).toHaveProperty('region');

      expect(VALID_WASTE_CATEGORIES).toContain(item.category);
      expect(typeof item.recyclable).toBe('boolean');
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('each item region contains x, y, width, height clamped to 0–100', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    const body = await res.json();

    for (const item of body.items) {
      const r = item.region;
      expect(r).toHaveProperty('x');
      expect(r).toHaveProperty('y');
      expect(r).toHaveProperty('width');
      expect(r).toHaveProperty('height');

      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThanOrEqual(100);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThanOrEqual(100);
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.width).toBeLessThanOrEqual(100);
      expect(r.height).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeLessThanOrEqual(100);
    }
  });

  test('unknownObjects is an array of strings', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    const body = await res.json();
    expect(Array.isArray(body.unknownObjects)).toBe(true);
    for (const obj of body.unknownObjects) {
      expect(typeof obj).toBe('string');
    }
  });

  test('legacy category field is always a valid waste category', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    const body = await res.json();
    expect(VALID_WASTE_CATEGORIES).toContain(body.category);
  });

  test('legacy confidence is clamped to [0, 1]', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    const body = await res.json();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  test('defaults mimeType to image/jpeg when omitted', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(VALID_WASTE_CATEGORIES).toContain(body.category);
  });

  test('sceneDescription is a non-empty string', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    const body = await res.json();
    expect(typeof body.sceneDescription).toBe('string');
    expect(body.sceneDescription.length).toBeGreaterThan(0);
  });

  test('context is a non-empty string', async ({ request }) => {
    const res = await request.post(`${BASE}/api/classify-waste`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    const body = await res.json();
    expect(typeof body.context).toBe('string');
    expect(body.context.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. /api/analyze-photo
// ═══════════════════════════════════════════════════════════════════════════

test.describe('/api/analyze-photo', () => {
  test('rejects GET with 405', async ({ request }) => {
    const res = await request.get(`${BASE}/api/analyze-photo`);
    expect(res.status()).toBe(405);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/method not allowed/i);
  });

  test('rejects POST without imageBase64 with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/analyze-photo`, {
      data: { mimeType: 'image/jpeg' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/missing/i);
  });

  test('rejects POST with empty body with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/analyze-photo`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns valid analysis for a JPEG image', async ({ request }) => {
    const res = await request.post(`${BASE}/api/analyze-photo`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64, mimeType: 'image/jpeg' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty('category');
    expect(body).toHaveProperty('severity');
    expect(body).toHaveProperty('description');
    expect(body).toHaveProperty('confidence');

    expect(VALID_CIVIC_CATEGORIES).toContain(body.category);
    expect(['low', 'medium', 'high']).toContain(body.severity);
    expect(typeof body.description).toBe('string');
    expect(body.description.length).toBeGreaterThan(0);
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  test('defaults mimeType to image/jpeg when omitted', async ({ request }) => {
    const res = await request.post(`${BASE}/api/analyze-photo`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(VALID_CIVIC_CATEGORIES).toContain(body.category);
  });

  test('confidence is clamped to [0, 1]', async ({ request }) => {
    const res = await request.post(`${BASE}/api/analyze-photo`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  test('returns a valid category (never an unknown string)', async ({ request }) => {
    const res = await request.post(`${BASE}/api/analyze-photo`, {
      data: { imageBase64: MINIMAL_JPEG_BASE64 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(VALID_CIVIC_CATEGORIES).toContain(body.category);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. /api/notify
// ═══════════════════════════════════════════════════════════════════════════

test.describe('/api/notify', () => {
  test('rejects GET with 405', async ({ request }) => {
    const res = await request.get(`${BASE}/api/notify`);
    expect(res.status()).toBe(405);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/method not allowed/i);
  });

  test('rejects POST with empty body with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/missing/i);
  });

  test('rejects POST with missing title with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: { tokens: ['fake-token'], body: 'test body' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects POST with missing body field with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: { tokens: ['fake-token'], title: 'test title' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects POST with empty tokens array with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: { tokens: [], title: 'test', body: 'test' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects POST with missing tokens with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: { title: 'test', body: 'test' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('sends notification and returns success/failure counts', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: {
        tokens: ['invalid-fcm-token-for-testing'],
        title: 'Playwright Test',
        body: 'This is an automated test notification',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('successCount');
    expect(body).toHaveProperty('failureCount');
    expect(typeof body.successCount).toBe('number');
    expect(typeof body.failureCount).toBe('number');
  });

  test('handles batch of multiple tokens', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notify`, {
      data: {
        tokens: ['fake-token-1', 'fake-token-2', 'fake-token-3'],
        title: 'Batch Test',
        body: 'Testing multiple tokens',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.successCount + body.failureCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. /api/transcribe
// ═══════════════════════════════════════════════════════════════════════════

test.describe('/api/transcribe', () => {
  test('rejects GET with 405', async ({ request }) => {
    const res = await request.get(`${BASE}/api/transcribe`);
    expect(res.status()).toBe(405);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/method not allowed/i);
  });

  test('rejects POST with empty body with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transcribe`, {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/missing/i);
  });

  test('rejects POST with missing audio with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transcribe`, {
      data: { languageCode: 'hi-IN' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects POST with missing languageCode with 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transcribe`, {
      data: { audio: MINIMAL_AUDIO_BASE64 },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns transcript field for valid audio', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transcribe`, {
      data: {
        audio: MINIMAL_AUDIO_BASE64,
        languageCode: 'en-IN',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('transcript');
    expect(typeof body.transcript).toBe('string');
  });

  test('supports hi-IN language code', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transcribe`, {
      data: {
        audio: MINIMAL_AUDIO_BASE64,
        languageCode: 'hi-IN',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('transcript');
  });

  test('supports mr-IN language code', async ({ request }) => {
    const res = await request.post(`${BASE}/api/transcribe`, {
      data: {
        audio: MINIMAL_AUDIO_BASE64,
        languageCode: 'mr-IN',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('transcript');
  });
});
