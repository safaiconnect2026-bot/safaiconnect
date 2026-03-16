import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TranscribeBody {
  audio: string;        // base64-encoded audio blob
  languageCode: string; // BCP-47 e.g. "hi-IN"
}

interface GCPSpeechResponse {
  results?: Array<{
    alternatives: Array<{ transcript: string; confidence: number }>;
  }>;
  error?: { code: number; message: string; status: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audio, languageCode } = req.body as TranscribeBody;

  if (!audio || !languageCode) {
    return res.status(400).json({ error: 'Missing audio or languageCode' });
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_CLOUD_API_KEY is not configured on this server.' });
  }

  const gcpUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;

  const gcpBody = {
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 48000,
      languageCode,
      alternativeLanguageCodes: ['en-IN'],
      model: 'default',
      enableAutomaticPunctuation: true,
    },
    audio: {
      content: audio, // base64
    },
  };

  try {
    const gcpRes = await fetch(gcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gcpBody),
    });

    const data = (await gcpRes.json()) as GCPSpeechResponse;

    if (!gcpRes.ok || data.error) {
      console.error('[transcribe] GCP error:', data.error ?? gcpRes.status);
      return res.status(gcpRes.status).json({ error: data.error?.message ?? 'GCP request failed' });
    }

    const transcript =
      data.results
        ?.flatMap((r) => r.alternatives?.map((a) => a.transcript) ?? [])
        .join(' ')
        .trim() ?? '';

    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('[transcribe] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal transcription error' });
  }
}
