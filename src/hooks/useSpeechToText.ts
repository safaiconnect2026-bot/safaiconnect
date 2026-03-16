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

// ---------------------------------------------------------------------------
// Minimal inline typings for the Web Speech API.
// The standard lib.dom.d.ts in this TS version does not include these types,
// so we define them locally to avoid any global name conflicts.
// ---------------------------------------------------------------------------
interface SpeechAlternative {
  readonly transcript: string;
}
interface SpeechResult {
  readonly length: number;
  readonly 0: SpeechAlternative;
}
interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}
interface SpeechEvent extends Event {
  readonly results: SpeechResultList;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

interface WindowWithSpeech {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
}
// ---------------------------------------------------------------------------

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Convert a Blob to base64 string (strips data URL prefix) */
  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // result is "data:audio/webm;base64,XXXXX..." — strip the data URL prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  /** Web Speech API fallback — works in Chrome even without a GCP key */
  const fallbackWebSpeech = useCallback(
    (langCode: string) => {
      // Cast through unknown to safely access experimental browser properties
      const w = window as unknown as WindowWithSpeech;
      const API = w.SpeechRecognition ?? w.webkitSpeechRecognition;

      if (!API) {
        setError('Speech recognition is not available. Please type your description.');
        return;
      }

      const rec = new API();
      rec.lang = langCode;
      rec.interimResults = false;
      rec.continuous = false;

      rec.onresult = (event: SpeechEvent) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          parts.push(event.results[i][0].transcript);
        }
        onTranscript(parts.join(''));
      };

      rec.onerror = () =>
        setError('Speech recognition failed. Please type your description.');

      rec.start();
    },
    [onTranscript],
  );

  /** Try Google Cloud via /api/transcribe. Falls back to Web Speech API on any failure. */
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
          return; // success — no fallback needed
        }
        throw new Error(data.error ?? 'Empty transcript from GCP');
      } catch (err) {
        console.warn('[useSpeechToText] GCP transcription failed, falling back to Web Speech API:', err);
        fallbackWebSpeech(langCode);
      }
    },
    [onTranscript, fallbackWebSpeech],
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
