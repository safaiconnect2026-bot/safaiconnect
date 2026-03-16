import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

interface AnalyzePhotoBody {
  imageBase64: string;
  mimeType?: string;
}

interface AnalysisResult {
  category: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  confidence: number;
}

const CATEGORIES = [
  'Waste Management',
  'Road Damage',
  'Street Lighting',
  'Drainage/Sewage',
  'Public Property Damage',
  'Water Supply',
  'Noise Pollution',
  'Other',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mimeType = 'image/jpeg' } = req.body as AnalyzePhotoBody;
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });

  const client = new OpenAI({ apiKey });

  const prompt = `You are analyzing a photo submitted to a civic complaint app in India.
Look at this image and respond with ONLY valid JSON and nothing else.
JSON format: { "category": "<category>", "severity": "low|medium|high", "description": "<one sentence, max 15 words>", "confidence": <0.0-1.0> }
Valid categories: ${CATEGORIES.join(', ')}
Choose the most appropriate category based on what you see.
If the image is unclear or not a civic issue, use "Other" with low confidence.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'low', // cheaper + fast enough for classification
              },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    const clean = text.replace(/```json?|```/g, '').trim();
    const parsed = JSON.parse(clean) as AnalysisResult;

    // Validate and sanitise
    if (!CATEGORIES.includes(parsed.category)) parsed.category = 'Other';
    if (!['low', 'medium', 'high'].includes(parsed.severity)) parsed.severity = 'medium';
    parsed.confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5));

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('[analyze-photo] Error:', err);
    return res.status(500).json({ error: 'Photo analysis failed' });
  }
}
