import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }

  try {
    // Nominatim (OpenStreetMap) — free reverse geocoding, no API key required
    const upstream = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { 'User-Agent': 'SafaiConnect/1.0' } }
    );

    if (!upstream.ok) {
      console.error('[geocode] Nominatim error:', upstream.status);
      return res.status(502).json({ error: 'Nominatim error', message: `HTTP ${upstream.status}` });
    }

    const data = await upstream.json() as any;
    const addr = data.address ?? {};

    return res.status(200).json({
      city:             addr.city ?? addr.town ?? addr.county ?? null,
      district:         addr.suburb ?? addr.neighbourhood ?? addr.village ?? null,
      state:            addr.state ?? null,
      formattedAddress: data.display_name ?? null,
    });
  } catch (err) {
    console.error('[geocode] Fetch error:', err);
    return res.status(500).json({ error: 'Internal geocoding error' });
  }
}
