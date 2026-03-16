# AI Voice-to-Text & Language Switcher Mobile Visibility Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the browser-only Web Speech API mic with a MediaRecorder→Google Cloud Speech-to-Text pipeline (toggle mode, 30s auto-stop, full 9-language support) exposed via a Vercel serverless proxy; also show the 2-letter language code on mobile in LanguageSwitcher so all users can switch languages easily.

**Architecture:**
Citizen taps mic → MediaRecorder captures audio → on stop, sends base64 blob to `/api/transcribe` (Vercel serverless) → serverless function calls Google Cloud Speech-to-Text REST API with GOOGLE_CLOUD_API_KEY env var → transcript returned and appended to description textarea. If Google Cloud fails, the hook transparently falls back to the browser's Web Speech API so the feature still works.

**Tech Stack:** React 18 + TypeScript, MediaRecorder API, Google Cloud Speech-to-Text v1 REST, Vercel serverless (`@vercel/node`), Tailwind CSS.

---

### Task 1: Show language code on mobile in LanguageSwitcher

**Files:**
- Modify: `src/components/common/LanguageSwitcher.tsx:42`

**Step 1: Open the file and find the button label span**

File path: `src/components/common/LanguageSwitcher.tsx`
Current line 42:
```tsx
<span className="hidden sm:inline">{current.nativeLabel}</span>
```

**Step 2: Replace that single span with two spans (native label for sm+, 2-letter code for xs)**

Replace line 42 with:
```tsx
<span className="hidden sm:inline">{current.nativeLabel}</span>
<span className="sm:hidden text-xs font-bold uppercase text-green-600">{current.code}</span>
```

Result: On mobile (< 640px) the button shows Globe + `EN` / `HI` / `UR` etc. On sm+ it shows Globe + native label as before.

**Step 3: Verify the file looks correct**

The full button block should be:
```tsx
<button
    onClick={() => setIsOpen((o) => !o)}
    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors text-sm font-medium"
    aria-label="Switch language"
>
    <Globe className="w-4 h-4 text-green-600" />
    <span className="hidden sm:inline">{current.nativeLabel}</span>
    <span className="sm:hidden text-xs font-bold uppercase text-green-600">{current.code}</span>
</button>
```

**Step 4: Commit**

```bash
git add src/components/common/LanguageSwitcher.tsx
git commit -m "feat: show 2-letter language code on mobile in LanguageSwitcher"
```

---

### Task 2: Create Vercel serverless transcription proxy

**Files:**
- Create: `api/transcribe.ts`

**Step 1: Create the file with full implementation**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface TranscribeBody {
  audio: string;       // base64-encoded audio
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
        ?.flatMap((r) => r.alternatives.map((a) => a.transcript))
        .join(' ')
        .trim() ?? '';

    return res.status(200).json({ transcript });
  } catch (err) {
    console.error('[transcribe] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal transcription error' });
  }
}
```

**Step 2: Verify @vercel/node types are installed**

Run:
```bash
npm list @vercel/node
```
Expected: shows a version. If missing run: `npm install --save-dev @vercel/node`

**Step 3: Commit**

```bash
git add api/transcribe.ts
git commit -m "feat: add Vercel serverless transcription proxy for Google Cloud Speech-to-Text"
```

---

### Task 3: Create useSpeechToText hook

**Files:**
- Create: `src/hooks/useSpeechToText.ts`

**Step 1: Create the hooks directory if needed**

```bash
mkdir -p "D:\HP Shared\All Freelance Projects\safai-main\src\hooks"
```

**Step 2: Create the file with full implementation**

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

// BCP-47 language codes for Google Cloud Speech-to-Text — all 9 app languages
const GCP_LANG_CODES: Record<string, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  bn: 'bn-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ur: 'ur-PK',
};

const AUTO_STOP_MS = 30_000; // 30 seconds

export interface UseSpeechToTextReturn {
  isListening: boolean;
  startStop: () => void;
  error: string | null;
}

export function useSpeechToText(
  language: string,
  onTranscript: (text: string) => void,
): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearAutoStop();
      stopStream();
    };
  }, []);

  const clearAutoStop = () => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  /** Convert a Blob to base64 string */
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // result is "data:audio/webm;base64,XXXXX..." — strip the prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  /** Try Google Cloud via our /api/transcribe proxy. Falls back to Web Speech API on failure. */
  const transcribeBlob = useCallback(
    async (audioBlob: Blob, langCode: string) => {
      try {
        const base64 = await blobToBase64(audioBlob);

        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audio: base64, languageCode: langCode }),
        });

        if (!res.ok) throw new Error(`/api/transcribe returned ${res.status}`);

        const data = (await res.json()) as { transcript?: string; error?: string };
        if (data.transcript) {
          onTranscript(data.transcript);
          return; // success — do not fall back
        }
        throw new Error(data.error ?? 'Empty transcript from GCP');
      } catch (err) {
        console.warn('[useSpeechToText] GCP failed, falling back to Web Speech API:', err);
        fallbackWebSpeech(langCode);
      }
    },
    [onTranscript],
  );

  /** Web Speech API fallback — works in Chrome even without GCP key */
  const fallbackWebSpeech = useCallback(
    (langCode: string) => {
      const API =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognition }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition }).webkitSpeechRecognition;

      if (!API) {
        setError('Speech recognition is not available. Please type your description.');
        return;
      }

      const rec = new API();
      rec.lang = langCode;
      rec.interimResults = false;
      rec.continuous = false;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        onTranscript(transcript);
      };

      rec.onerror = () =>
        setError('Speech recognition failed. Please type your description.');

      rec.start();
    },
    [onTranscript],
  );

  const stopRecording = useCallback(() => {
    clearAutoStop();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop(); // triggers onstop → transcribeBlob
    } else {
      setIsListening(false);
      stopStream();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access denied. Please allow microphone access and try again.');
      return;
    }
    streamRef.current = stream;

    // Prefer webm/opus; fall back to ogg/opus (Firefox)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/ogg;codecs=opus';

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      setIsListening(false);
      stopStream();
      if (chunksRef.current.length === 0) return;
      const audioBlob = new Blob(chunksRef.current, { type: mimeType });
      const langCode = GCP_LANG_CODES[language] ?? 'en-IN';
      await transcribeBlob(audioBlob, langCode);
    };

    recorder.start();
    setIsListening(true);

    // Auto-stop after 30 seconds
    autoStopTimerRef.current = setTimeout(() => {
      stopRecording();
    }, AUTO_STOP_MS);
  }, [language, transcribeBlob, stopRecording]);

  const startStop = useCallback(() => {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  return { isListening, startStop, error };
}
```

**Step 3: Commit**

```bash
git add src/hooks/useSpeechToText.ts
git commit -m "feat: add useSpeechToText hook with MediaRecorder + GCP + Web Speech fallback"
```

---

### Task 4: Wire useSpeechToText into CitizenDashboard

**Files:**
- Modify: `src/components/dashboards/CitizenDashboard.tsx`

There are 4 surgical edits:

**Step 1: Remove the ISpeechRecognition type shim (lines 47–65)**

Remove this entire block from CitizenDashboard.tsx:
```typescript
// Self-contained Speech Recognition type shim (avoids needing @types/dom-speech-recognition)
interface ISpeechRecognitionResult { readonly length: number;[index: number]: { transcript: string } }
interface ISpeechRecognitionEvent { readonly results: ISpeechRecognitionResult[] }
interface ISpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}
```

**Step 2: Add hook import at the top of the file (after the other imports)**

After `import { useLanguage } from '../../contexts/LanguageContext';` add:
```typescript
import { useSpeechToText } from '../../hooks/useSpeechToText';
```

**Step 3: Replace the isListening state + recognitionRef with the hook**

Remove these two lines:
```typescript
const [isListening, setIsListening] = useState(false);
```
```typescript
const recognitionRef = useRef<ISpeechRecognition | null>(null);
```

And add the hook call right after `const { t, language } = useLanguage();`:
```typescript
const { isListening, startStop: toggleMic, error: speechError } = useSpeechToText(language, (transcript) => {
  setDescription((prev) => prev ? `${prev} ${transcript}` : transcript);
});
```

Note: we append to existing description text rather than replacing, so typing + voice can be mixed.

**Step 4: Remove the old toggleMic function (lines ~360–395)**

Remove this entire function:
```typescript
// ----------- Voice – Microphone for Report Issue -----------
const toggleMic = () => {
  const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    toastInfo('Speech recognition is not supported in this browser. Please use Chrome.');
    return;
  }

  if (isListening) {
    recognitionRef.current?.stop();
    setIsListening(false);
    return;
  }

  const recognition = new SpeechRecognitionAPI();
  recognition.lang =
    language === 'ur' ? 'ur-PK' : language === 'sd' ? 'sd' : 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event: ISpeechRecognitionEvent) => {
    const transcript = event.results
      .map((r) => r[0].transcript)
      .join('');
    setDescription(transcript);
  };

  recognition.onend = () => setIsListening(false);
  recognition.onerror = () => setIsListening(false);

  recognitionRef.current = recognition;
  recognition.start();
  setIsListening(true);
};
```

The new `toggleMic` is now just `startStop` aliased from the hook (step 3 above), so all existing JSX that calls `toggleMic()` and reads `isListening` continues to work without touching the UI code.

**Step 5: Show speechError below the mic button if present**

Find the mic button in the JSX (search for `onClick={toggleMic}` or `isListening`). After the mic button, add an error display:
```tsx
{speechError && (
  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
    <AlertTriangle className="w-3 h-3" />
    {speechError}
  </p>
)}
```

AlertTriangle is already imported at line 22.

**Step 6: Run TypeScript build to verify zero errors**

```bash
cd "D:\HP Shared\All Freelance Projects\safai-main"
npm run build
```

Expected: `✓ built in Xs` — zero errors. If there are type errors, fix them before committing.

**Step 7: Commit**

```bash
git add src/components/dashboards/CitizenDashboard.tsx
git commit -m "feat: replace Web Speech API mic with useSpeechToText hook (GCP + fallback)"
```

---

## User Manual Steps After Implementation

These are things only the user can do:

### 1. Enable Google Cloud Speech-to-Text API
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select or create a project
3. Enable **Cloud Speech-to-Text API** (search for it in the API Library)
4. Go to **APIs & Services → Credentials**
5. Click **Create Credentials → API Key**
6. Restrict the key to: **Cloud Speech-to-Text API** only
7. Copy the key

### 2. Add env var locally
Create `.env` (or `.env.local`) at project root:
```
GOOGLE_CLOUD_API_KEY=YOUR_KEY_HERE
```
This is only used by the Vercel serverless function (`api/transcribe.ts`) — NOT by Vite, so no `VITE_` prefix needed.

### 3. Add env var in Vercel
- Go to Vercel dashboard → your project → Settings → Environment Variables
- Add: `GOOGLE_CLOUD_API_KEY` = your key
- Set to all environments (Production + Preview + Development)

### 4. Deploy
```bash
vercel --prod
```

### 5. Testing the mic feature
1. Open the app → Citizen dashboard → Report Issue tab
2. Tap the mic icon — it turns red/active
3. Speak a complaint description (in any of the 9 supported languages)
4. Tap mic again to stop (or wait 30 seconds for auto-stop)
5. The transcript appears in the description field
6. If GOOGLE_CLOUD_API_KEY is not set, the fallback (Chrome Web Speech API) kicks in automatically — feature still works in Chrome

---

## Summary of All Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `src/components/common/LanguageSwitcher.tsx` | Modified | Show 2-letter code on mobile |
| `api/transcribe.ts` | Created | Vercel serverless → Google Cloud proxy |
| `src/hooks/useSpeechToText.ts` | Created | MediaRecorder + GCP + fallback hook |
| `src/components/dashboards/CitizenDashboard.tsx` | Modified | Wire hook, remove old Web Speech code |
