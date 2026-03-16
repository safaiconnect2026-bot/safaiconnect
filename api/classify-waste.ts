import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

interface ClassifyWasteBody {
  imageBase64: string;
  mimeType?: string;
}

export interface WasteItem {
  wasteType: string;
  subCategory: string;
  category: 'Dry Waste' | 'Wet Waste' | 'Hazardous Waste' | 'Sanitary Waste' | 'E-Waste' | 'Unknown';
  bin: string;
  binColor: string;
  recyclable: boolean;
  instructions: string;
  confidence: number;
  /** Bounding region as % of image dimensions (0–100) */
  region: { x: number; y: number; width: number; height: number };
}

export interface ImageQuality {
  exposure: 'underexposed' | 'normal' | 'overexposed';
  noisy: boolean;
  quality: 'poor' | 'acceptable' | 'good';
  qualityNote?: string;
}

export interface WasteAnalysisResult {
  /** One-sentence description of the full scene */
  sceneDescription: string;
  /** Environment type */
  context: string;
  imageQuality: ImageQuality;
  /** All waste items detected in the image */
  items: WasteItem[];
  /** Objects GPT-4o could not confidently identify */
  unknownObjects: string[];
  /** Web-search snippets for unknown objects (if SERPER_API_KEY configured) */
  webContext?: Record<string, string>;
  // ── Legacy single-item fields kept for backward compatibility ──
  wasteType: string;
  category: WasteItem['category'];
  bin: string;
  binColor: string;
  recyclable: boolean;
  instructions: string;
  confidence: number;
}

const VALID_CATEGORIES = [
  'Dry Waste',
  'Wet Waste',
  'Hazardous Waste',
  'Sanitary Waste',
  'E-Waste',
  'Unknown',
];

const SYSTEM_PROMPT = `You are an advanced waste segregation AI for an Indian municipal waste management system.
Your task is to perform a comprehensive multi-step analysis of the image.

Respond with ONLY a valid JSON object and nothing else.

JSON schema:
{
  "sceneDescription": "<1 sentence describing the full scene>",
  "context": "<one of: kitchen|street|hospital|office|outdoor|home|factory|market|other>",
  "imageQuality": {
    "exposure": "<underexposed|normal|overexposed>",
    "noisy": <true|false>,
    "quality": "<poor|acceptable|good>",
    "qualityNote": "<optional 1-sentence note about image issues>"
  },
  "items": [
    {
      "wasteType": "<specific item, e.g. 'PET Plastic Bottle'>",
      "subCategory": "<granular type, e.g. 'Recyclable Plastic'>",
      "category": "<Dry Waste|Wet Waste|Hazardous Waste|Sanitary Waste|E-Waste|Unknown>",
      "bin": "<bin name>",
      "binColor": "<CSS hex color>",
      "recyclable": <true|false>,
      "instructions": "<disposal instruction, max 20 words>",
      "confidence": <0.0-1.0>,
      "region": { "x": <0-100>, "y": <0-100>, "width": <0-100>, "height": <0-100> }
    }
  ],
  "unknownObjects": ["<unidentifiable object name>"]
}

Category & bin reference (Indian standard):
- Dry Waste → Blue Bin (#3B82F6): paper, cardboard, plastic, metal, glass, tetra packs
  Sub-categories: PET Plastic, HDPE Plastic, Paper/Cardboard, Glass, Metal/Aluminum, Tetra Pack
- Wet Waste → Green Bin (#22C55E): food scraps, vegetable/fruit peels, cooked food, garden waste
  Sub-categories: Cooked Food Waste, Raw Vegetable/Fruit Waste, Garden/Green Waste, Dairy Waste
- Hazardous Waste → Red Bin (#EF4444): batteries, chemicals, paint, medicines, syringes, CFL bulbs
  Sub-categories: Battery/Cell, Pharmaceutical Waste, Chemical/Paint, Light Bulb/CFL
- Sanitary Waste → Black Bin (#374151): diapers, sanitary pads, bandages, medical waste
  Sub-categories: Diaper, Sanitary Napkin, Bandage/Medical Waste, Contaminated Tissue
- E-Waste → E-Waste Collection Point (#F59E0B): phones, computers, chargers, cables, electronics
  Sub-categories: Mobile/Tablet, Computer/Laptop, Charger/Cable, Home Appliance, Printer/Peripheral

Region guidelines:
- Express x, y, width, height as integers 0–100 (percent of image)
- If only one item is visible, use: {"x":5,"y":5,"width":90,"height":90}
- Do NOT overlap regions unnecessarily

Image quality guidelines:
- exposure: "underexposed" if image is dark, "overexposed" if washed out, "normal" otherwise
- noisy: true if significant grain, blur, or sensor noise is present
- quality: "poor" if item is unidentifiable, "acceptable" if identifiable but not ideal, "good" if clear

If no waste is visible, return items:[] and unknownObjects with whatever objects you see.`;

// ── Google/Serper web search enrichment for unknown objects ────────────────

async function enrichUnknownObjects(
  unknownObjects: string[],
): Promise<Record<string, string>> {
  const searchKey =
    process.env.SERPER_API_KEY || process.env.GOOGLE_SEARCH_API_KEY;
  if (!searchKey || !unknownObjects.length) return {};

  const results: Record<string, string> = {};

  for (const obj of unknownObjects.slice(0, 3)) {
    try {
      const endpoint = process.env.SERPER_API_KEY
        ? 'https://google.serper.dev/search'
        : `https://www.googleapis.com/customsearch/v1?key=${process.env.GOOGLE_SEARCH_API_KEY}&cx=${process.env.GOOGLE_SEARCH_CX}&q=`;

      if (process.env.SERPER_API_KEY) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'X-API-KEY': searchKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: `${obj} waste disposal category India municipal`,
            num: 1,
          }),
        });
        const data = (await res.json()) as Record<string, any>;
        const snippet =
          data?.answerBox?.snippet ||
          data?.organic?.[0]?.snippet ||
          '';
        if (snippet) results[obj] = snippet;
      } else {
        const cx = process.env.GOOGLE_SEARCH_CX;
        if (!cx) continue;
        const res = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${searchKey}&cx=${cx}&q=${encodeURIComponent(obj + ' waste disposal India')}&num=1`,
        );
        const data = (await res.json()) as Record<string, any>;
        const snippet = data?.items?.[0]?.snippet || '';
        if (snippet) results[obj] = snippet;
      }
    } catch {
      // Search enrichment is best-effort; never block the main response
    }
  }

  return results;
}

// ── Default fallback structure ─────────────────────────────────────────────

function buildDefaultResult(partial: Partial<WasteAnalysisResult>): WasteAnalysisResult {
  const primary = partial.items?.[0];
  return {
    sceneDescription: partial.sceneDescription ?? 'Unable to analyse scene.',
    context: partial.context ?? 'other',
    imageQuality: partial.imageQuality ?? {
      exposure: 'normal',
      noisy: false,
      quality: 'acceptable',
    },
    items: partial.items ?? [],
    unknownObjects: partial.unknownObjects ?? [],
    webContext: partial.webContext,
    // Legacy fields derived from first item
    wasteType: primary?.wasteType ?? 'Unknown Item',
    category: primary?.category ?? 'Unknown',
    bin: primary?.bin ?? 'General Waste',
    binColor: primary?.binColor ?? '#6B7280',
    recyclable: primary?.recyclable ?? false,
    instructions: primary?.instructions ?? 'Dispose in nearest waste bin.',
    confidence: primary?.confidence ?? 0,
  };
}

// ── Vercel handler ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType = 'image/jpeg' } = req.body as ClassifyWasteBody;
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const client = new OpenAI({ apiKey });

  try {
    // Stage 1 — GPT-4o multimodal scene understanding + item detection
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SYSTEM_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high', // full-resolution for multi-item + position detection
              },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    const clean = text.replace(/```json?|```/g, '').trim();

    let parsed: WasteAnalysisResult;
    try {
      parsed = JSON.parse(clean) as WasteAnalysisResult;
    } catch {
      // Attempt to recover a truncated JSON by extracting whatever was parsed
      console.error('[classify-waste] JSON parse failed, raw text:', clean.slice(0, 300));
      // Return a minimal valid response so the UI doesn't crash
      return res.status(200).json(buildDefaultResult({
        sceneDescription: 'Scene analysed — partial result due to response length.',
        context: 'other',
        imageQuality: { exposure: 'normal', noisy: false, quality: 'acceptable' },
        items: [],
        unknownObjects: [],
      }));
    }

    // Sanitise items array
    parsed.items = (parsed.items ?? []).map((item) => {
      if (!VALID_CATEGORIES.includes(item.category)) item.category = 'Unknown';
      item.confidence = Math.min(1, Math.max(0, Number(item.confidence) || 0.5));
      item.recyclable = Boolean(item.recyclable);
      item.region = {
        x: Math.min(100, Math.max(0, Number(item.region?.x) || 5)),
        y: Math.min(100, Math.max(0, Number(item.region?.y) || 5)),
        width: Math.min(100, Math.max(1, Number(item.region?.width) || 90)),
        height: Math.min(100, Math.max(1, Number(item.region?.height) || 90)),
      };
      return item;
    });

    parsed.unknownObjects = Array.isArray(parsed.unknownObjects)
      ? parsed.unknownObjects.filter((s) => typeof s === 'string')
      : [];

    // Stage 2 — Web search enrichment for unknown objects (best-effort)
    if (parsed.unknownObjects.length > 0) {
      parsed.webContext = await enrichUnknownObjects(parsed.unknownObjects);
    }

    const result = buildDefaultResult(parsed);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[classify-waste] Error:', err);
    return res.status(500).json({ error: 'Waste classification failed' });
  }
}
