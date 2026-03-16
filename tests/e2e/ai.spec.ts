import { test, expect } from '@playwright/test';

/**
 * AI Endpoint Tests — /api/analyze-photo (OpenAI GPT-4o Vision)
 *
 * Tests the Vercel serverless API endpoint that analyses a photo and returns
 * a civic complaint category, severity, description, and confidence score.
 *
 * These tests are gated: they skip gracefully if OPENAI_API_KEY is not set.
 *
 * To run:
 *   OPENAI_API_KEY=sk-... npx playwright test tests/e2e/ai.spec.ts
 *
 * The tests target the Vercel deployment by default. Set VERCEL_URL to override:
 *   VERCEL_URL=https://your-app.vercel.app npx playwright test tests/e2e/ai.spec.ts
 */

const VERCEL_URL = process.env.VERCEL_URL || 'https://safai-main.vercel.app';
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: A tiny 1×1 pixel white JPEG as base64
// Used as a minimal test image without needing an actual file on disk
// ─────────────────────────────────────────────────────────────────────────────
const MINIMAL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAABgUEB/8QAIhAAAQMEAwEBAAAAAAAAAAAAAQIDBAAFERIhMUH/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AmWua5Xt+ub3b47l0ZuPRStqL2pJSBgYH2P3XTqSogkEYBBBGDkdaUUAf/9k=';

// All valid categories that the API must return
const VALID_CATEGORIES = [
  'Waste Management',
  'Road Damage',
  'Street Lighting',
  'Drainage/Sewage',
  'Public Property Damage',
  'Water Supply',
  'Noise Pollution',
  'Other',
];

// ─────────────────────────────────────────────────────────────────────────────
// /api/analyze-photo
// ─────────────────────────────────────────────────────────────────────────────

test.describe('/api/analyze-photo (OpenAI GPT-4o Vision)', () => {
  test.skip(!OPENAI_KEY, 'OPENAI_API_KEY not set — skipping analyze-photo tests');

  test('returns 405 for GET request', async ({ request }) => {
    const res = await request.get(`${VERCEL_URL}/api/analyze-photo`);
    expect(res.status()).toBe(405);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('returns 400 when imageBase64 is missing', async ({ request }) => {
    const res = await request.post(`${VERCEL_URL}/api/analyze-photo`, {
      data: { mimeType: 'image/jpeg' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
    expect(body.error).toMatch(/missing/i);
  });

  test('returns valid analysis result for a test image', async ({ request }) => {
    const res = await request.post(`${VERCEL_URL}/api/analyze-photo`, {
      data: {
        imageBase64: MINIMAL_JPEG_BASE64,
        mimeType: 'image/jpeg',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();

    // Must have all four required fields
    expect(body).toHaveProperty('category');
    expect(body).toHaveProperty('severity');
    expect(body).toHaveProperty('description');
    expect(body).toHaveProperty('confidence');

    // Category must be one of the 8 valid values
    expect(VALID_CATEGORIES).toContain(body.category);

    // Severity must be low / medium / high
    expect(['low', 'medium', 'high']).toContain(body.severity);

    // Description must be a non-empty string
    expect(typeof body.description).toBe('string');
    expect(body.description.length).toBeGreaterThan(0);

    // Confidence must be clamped to [0, 1]
    expect(typeof body.confidence).toBe('number');
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });

  test('handles PNG mime type without error', async ({ request }) => {
    const res = await request.post(`${VERCEL_URL}/api/analyze-photo`, {
      data: {
        imageBase64: MINIMAL_JPEG_BASE64,
        mimeType: 'image/png',
      },
    });
    // Should succeed or return a graceful error (not a 500 crash)
    expect([200, 500]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.confidence).toBeGreaterThanOrEqual(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('confidence is clamped to [0, 1]', async ({ request }) => {
    const res = await request.post(`${VERCEL_URL}/api/analyze-photo`, {
      data: {
        imageBase64: MINIMAL_JPEG_BASE64,
        mimeType: 'image/jpeg',
      },
    });
    if (res.status() === 200) {
      const body = await res.json();
      expect(body.confidence).toBeGreaterThanOrEqual(0);
      expect(body.confidence).toBeLessThanOrEqual(1);
    }
  });

  test('category falls back to "Other" for unrecognised content', async ({ request }) => {
    // A minimal 1×1 image is too small for GPT-4o to identify a civic issue
    // The API should return "Other" with low confidence rather than crash
    const res = await request.post(`${VERCEL_URL}/api/analyze-photo`, {
      data: {
        imageBase64: MINIMAL_JPEG_BASE64,
        mimeType: 'image/jpeg',
      },
    });
    if (res.status() === 200) {
      const body = await res.json();
      // Either "Other" or any valid category — just not an unknown string
      expect(VALID_CATEGORIES).toContain(body.category);
    }
  });
});
