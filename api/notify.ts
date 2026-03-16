import type { VercelRequest, VercelResponse } from '@vercel/node';

interface NotifyBody {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tokens, title, body, data } = req.body as NotifyBody;
  if (!tokens?.length || !title || !body) {
    return res.status(400).json({ error: 'Missing tokens, title, or body' });
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured' });
  }

  try {
    // Lazy dynamic import of firebase-admin to prevent Vite bundling it
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    if (!getApps().length) {
      initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
    }

    const messaging = getMessaging();

    // Send in batches of 500 (FCM multicast limit)
    let totalSuccess = 0, totalFailure = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: data ?? {},
        webpush: {
          notification: {
            title,
            body,
            icon: '/pwa-192x192.png',
          },
        },
      });
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }

    return res.status(200).json({ successCount: totalSuccess, failureCount: totalFailure });
  } catch (err) {
    console.error('[notify] Error:', err);
    return res.status(500).json({ error: 'Failed to send notification' });
  }
}
