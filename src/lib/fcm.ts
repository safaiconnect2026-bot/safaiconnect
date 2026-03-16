import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { getMessagingInstance, db } from './firebase';

/**
 * Request browser notification permission, get FCM token, save to Firestore.
 * Call once per login session.
 */
export async function requestAndSaveFCMToken(userId: string): Promise<string | null> {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.info('[FCM] Notification permission denied.');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY not set — skipping FCM token request.');
      return null;
    }

    const token = await getToken(messaging, { vapidKey });
    if (token) {
      await updateDoc(doc(db, 'users', userId), { fcmToken: token });
      console.info('[FCM] Token saved for user', userId);
    }
    return token ?? null;
  } catch (err) {
    console.warn('[FCM] Token request failed:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages (app is open).
 * Returns an unsubscribe function.
 */
export function setupForegroundMessageListener(
  onNotification: (title: string, body: string) => void
): () => void {
  // Kick off async init; attach listener once ready
  getMessagingInstance().then(messaging => {
    if (!messaging) return;
    try {
      onMessage(messaging, payload => {
        const title = payload.notification?.title ?? 'Safai Connect';
        const body = payload.notification?.body ?? '';
        onNotification(title, body);
      });
    } catch (err) {
      console.warn('[FCM] Foreground listener failed:', err);
    }
  });
  return () => {};
}

/**
 * Send a push notification via our /api/notify serverless proxy.
 * tokens: FCM token strings to send to.
 */
export async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const validTokens = tokens.filter(Boolean);
  if (!validTokens.length) return;
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: validTokens, title, body, data: data ?? {} }),
    });
  } catch (err) {
    console.warn('[FCM] sendPushNotification failed:', err);
  }
}
