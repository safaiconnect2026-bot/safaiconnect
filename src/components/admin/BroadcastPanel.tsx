import React, { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { sendPushNotification } from '../../lib/fcm';
import { Megaphone, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

type Audience = 'Citizens' | 'Workers' | 'All';

const BroadcastPanel: React.FC = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('All');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: number; fail: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Please enter both title and message.');
      return;
    }
    setSending(true);
    setResult(null);
    setError(null);

    try {
      let q;
      if (audience === 'Citizens') {
        q = query(collection(db, 'users'), where('role', 'in', ['Citizen', 'citizen', 'Green-Champion', 'green-champion']));
      } else if (audience === 'Workers') {
        q = query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']));
      } else {
        q = query(collection(db, 'users'));
      }

      const snap = await getDocs(q);
      const tokens: string[] = [];
      snap.forEach(d => {
        const token = d.data().fcmToken as string | undefined;
        if (token) tokens.push(token);
      });

      if (!tokens.length) {
        setError(`No registered devices found for audience: ${audience}. Users must log in with notification permission granted.`);
        setSending(false);
        return;
      }

      await sendPushNotification(tokens, title.trim(), body.trim(), { broadcast: 'true', audience });
      setResult({ success: tokens.length, fail: 0 });
      setTitle('');
      setBody('');
    } catch (err) {
      console.error('[BroadcastPanel] Error:', err);
      setError('Failed to send broadcast. Check your FIREBASE_SERVICE_ACCOUNT_JSON Vercel env var.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-bold text-gray-900">City-Wide Broadcast</h3>
      </div>
      <p className="text-sm text-gray-500">Send a push notification to all registered devices instantly.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Audience</label>
          <div className="flex gap-2 flex-wrap">
            {(['All', 'Citizens', 'Workers'] as Audience[]).map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  audience === a
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notification Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={100}
            placeholder="e.g. City Cleanup Drive Tomorrow"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="e.g. Join us Saturday 9am at City Park for the annual cleanliness drive."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
          />
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {result && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Broadcast sent to <strong>{result.success} device(s)</strong> successfully!
          </div>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
          {sending ? 'Sending...' : `Send to ${audience}`}
        </button>
      </div>
    </div>
  );
};

export default BroadcastPanel;
