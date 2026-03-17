import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only GET allowed
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }

  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Geocoding API key not configured on server.' });
  }

  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat},${lng}&key=${apiKey}&language=en` +
    `&result_type=sublocality|locality|administrative_area_level_3`;

  try {
    const upstream = await fetch(url);
    const data = await upstream.json();

    if (data.status !== 'OK') {
      console.error('[geocode] Maps API error:', data.status, data.error_message);
      return res.status(502).json({ error: data.status, message: data.error_message ?? 'Geocoding failed' });
    }

    const components: Array<{ long_name: string; types: string[] }> =
      data.results[0]?.address_components ?? [];

    const get = (type: string) =>
      components.find((c) => c.types.includes(type))?.long_name ?? null;

    return res.status(200).json({
      city:             get('locality') ?? get('administrative_area_level_2'),
      district:         get('administrative_area_level_3') ?? get('sublocality_level_1'),
      state:            get('administrative_area_level_1'),
      formattedAddress: data.results[0]?.formatted_address ?? null,
    });
  } catch (err) {
    console.error('[geocode] Fetch error:', err);
    return res.status(500).json({ error: 'Internal geocoding error' });
  }
}
