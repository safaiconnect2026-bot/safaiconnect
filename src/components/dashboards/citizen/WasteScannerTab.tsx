import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera, Upload, ScanLine, RotateCcw, Recycle, Trash2, Zap,
  AlertTriangle, CheckCircle, XCircle, Sun, Eye, Globe, Info,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';

// ── Types ─────────────────────────────────────────────────────────────────

interface WasteItem {
  wasteType: string;
  subCategory: string;
  category: 'Dry Waste' | 'Wet Waste' | 'Hazardous Waste' | 'Sanitary Waste' | 'E-Waste' | 'Unknown';
  bin: string;
  binColor: string;
  recyclable: boolean;
  instructions: string;
  confidence: number;
  region: { x: number; y: number; width: number; height: number };
}

interface ImageQuality {
  exposure: 'underexposed' | 'normal' | 'overexposed';
  noisy: boolean;
  quality: 'poor' | 'acceptable' | 'good';
  qualityNote?: string;
}

interface WasteAnalysisResult {
  sceneDescription: string;
  context: string;
  imageQuality: ImageQuality;
  items: WasteItem[];
  unknownObjects: string[];
  webContext?: Record<string, string>;
  // legacy fields
  wasteType: string;
  category: WasteItem['category'];
  bin: string;
  binColor: string;
  recyclable: boolean;
  instructions: string;
  confidence: number;
}

// ── Category meta ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { emoji: string; bg: string; border: string; text: string }> = {
  'Dry Waste':       { emoji: '📦', bg: 'bg-blue-50',   border: 'border-blue-200',  text: 'text-blue-700'  },
  'Wet Waste':       { emoji: '🥬', bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700' },
  'Hazardous Waste': { emoji: '☣️', bg: 'bg-red-50',    border: 'border-red-200',   text: 'text-red-700'   },
  'Sanitary Waste':  { emoji: '🗑️', bg: 'bg-gray-50',   border: 'border-gray-300',  text: 'text-gray-700'  },
  'E-Waste':         { emoji: '🔋', bg: 'bg-amber-50',  border: 'border-amber-200', text: 'text-amber-700' },
  'Unknown':         { emoji: '❓', bg: 'bg-gray-50',   border: 'border-gray-200',  text: 'text-gray-600'  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8)
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle className="w-3.5 h-3.5" /> High confidence
      </span>
    );
  if (confidence >= 0.5)
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
        <Zap className="w-3.5 h-3.5" /> Moderate confidence
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
      <AlertTriangle className="w-3.5 h-3.5" /> Low confidence
    </span>
  );
}

function QualityBadge({ quality }: { quality: ImageQuality }) {
  const exposureLabel =
    quality.exposure === 'underexposed'
      ? 'Too Dark'
      : quality.exposure === 'overexposed'
      ? 'Too Bright'
      : 'Normal Light';

  const qColor =
    quality.quality === 'good'
      ? 'text-green-600 bg-green-50'
      : quality.quality === 'poor'
      ? 'text-red-600 bg-red-50'
      : 'text-amber-600 bg-amber-50';

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${qColor}`}>
      <Sun className="w-3.5 h-3.5 flex-shrink-0" />
      <span>
        {exposureLabel} · {quality.noisy ? 'Noisy' : 'Clear'} · Image {quality.quality}
      </span>
      {quality.qualityNote && (
        <span className="text-gray-500 font-normal"> — {quality.qualityNote}</span>
      )}
    </div>
  );
}

// ── Canvas contour drawing ─────────────────────────────────────────────────

function drawContours(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  items: WasteItem[],
) {
  canvas.width = img.offsetWidth;
  canvas.height = img.offsetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  items.forEach((item) => {
    const { x, y, width, height } = item.region;
    const px = (x / 100) * canvas.width;
    const py = (y / 100) * canvas.height;
    const pw = (width / 100) * canvas.width;
    const ph = (height / 100) * canvas.height;

    // Outer glow
    ctx.shadowColor = item.binColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = item.binColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.shadowBlur = 0;

    // Corner accent marks
    const cs = Math.min(14, pw * 0.15, ph * 0.15);
    ctx.lineWidth = 3;
    ctx.strokeStyle = item.binColor;
    [
      [px, py, cs, 0, 0, cs],
      [px + pw, py, -cs, 0, 0, cs],
      [px, py + ph, cs, 0, 0, -cs],
      [px + pw, py + ph, -cs, 0, 0, -cs],
    ].forEach(([ox, oy, dx1, dy1, dx2, dy2]) => {
      ctx.beginPath();
      ctx.moveTo(ox + dx1, oy + dy1);
      ctx.lineTo(ox, oy);
      ctx.lineTo(ox + dx2, oy + dy2);
      ctx.stroke();
    });

    // Label pill
    const label = item.wasteType.length > 22 ? item.wasteType.slice(0, 20) + '…' : item.wasteType;
    ctx.font = 'bold 11px system-ui, sans-serif';
    const textW = ctx.measureText(label).width;
    const pillW = textW + 12;
    const pillH = 20;
    const pillX = px;
    const pillY = py - pillH - 2 < 0 ? py + 2 : py - pillH - 2;

    ctx.fillStyle = item.binColor;
    const r = 4;
    ctx.beginPath();
    ctx.moveTo(pillX + r, pillY);
    ctx.lineTo(pillX + pillW - r, pillY);
    ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
    ctx.lineTo(pillX + pillW, pillY + pillH - r);
    ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
    ctx.lineTo(pillX + r, pillY + pillH);
    ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
    ctx.lineTo(pillX, pillY + r);
    ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, pillX + 6, pillY + 14);
  });
}

// ── Item card ─────────────────────────────────────────────────────────────

function WasteItemCard({ item, index }: { item: WasteItem; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const meta = CATEGORY_META[item.category] ?? CATEGORY_META['Unknown'];

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${meta.bg} ${meta.border}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full flex-shrink-0" style={{ backgroundColor: item.binColor }} />
          <div>
            <p className="font-bold text-gray-900 text-sm">{item.wasteType}</p>
            <p className="text-xs text-gray-500">{item.subCategory}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text} border ${meta.border}`}>
            {meta.emoji} {item.category}
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/50 pt-3">
          {/* Bin */}
          <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3">
            <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: item.binColor }} />
            <div>
              <p className="text-xs text-gray-500 font-medium">Dispose in</p>
              <p className="font-bold text-gray-900 text-sm">{item.bin}</p>
            </div>
          </div>

          {/* Recyclable + confidence */}
          <div className="flex items-center gap-2">
            {item.recyclable ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <Recycle className="w-4 h-4" /> Recyclable
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-600">
                <Trash2 className="w-4 h-4" /> Not recyclable
              </span>
            )}
            <span className="ml-auto">
              <ConfidenceBadge confidence={item.confidence} />
            </span>
          </div>

          {/* Instructions */}
          <div className="bg-white/70 rounded-xl p-3">
            <p className="text-xs text-gray-500 font-medium mb-1">How to dispose</p>
            <p className="text-sm text-gray-800">{item.instructions}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function WasteScannerTab() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<WasteAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');

  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Redraw contours whenever result or rendered image size changes
  const redrawContours = useCallback(() => {
    if (!result || !imgRef.current || !canvasRef.current) return;
    if (!result.items?.length) return;
    drawContours(canvasRef.current, imgRef.current, result.items);
  }, [result]);

  useEffect(() => {
    redrawContours();
    window.addEventListener('resize', redrawContours);
    return () => window.removeEventListener('resize', redrawContours);
  }, [redrawContours]);

  const processFile = async (file: File) => {
    setError('');
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    setLoadingStep('Describing scene…');

    try {
      const imageBase64 = await toBase64(file);
      const mimeType = file.type || 'image/jpeg';
      const apiBase = (import.meta.env.VITE_API_BASE_URL as string) ?? '';

      setLoadingStep('Detecting waste items…');
      const res = await fetch(`${apiBase}/api/classify-waste`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mimeType }),
      });

      if (!res.ok) {
        let errMsg = `Server error (${res.status})`;
        try {
          const errBody = await res.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      setLoadingStep('Enriching results…');
      const data: WasteAnalysisResult = await res.json();
      setResult(data);
    } catch (err: any) {
      const msg = err?.message ?? '';
      if (msg.includes('OPENAI_API_KEY')) {
        setError('AI service is not configured. Please contact support.');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
        setError('Network error — check your internet connection and try again.');
      } else if (msg.includes('500') || msg.includes('classification failed')) {
        setError('AI classification failed. Try a clearer, well-lit photo focused on the waste item.');
      } else if (msg) {
        setError(`Could not classify: ${msg}`);
      } else {
        setError('Could not classify this image. Try a clearer, well-lit photo.');
      }
      console.error('[WasteScanner]', err);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const openCamera = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Camera,
        });
        if (image.webPath) {
          const blob = await (await fetch(image.webPath)).blob();
          processFile(new File([blob], 'waste.jpg', { type: 'image/jpeg' }));
        }
      } catch { /* user cancelled */ }
    } else {
      cameraRef.current?.click();
    }
  };

  const openGallery = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 80,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Photos,
        });
        if (image.webPath) {
          const blob = await (await fetch(image.webPath)).blob();
          processFile(new File([blob], 'waste.jpg', { type: 'image/jpeg' }));
        }
      } catch { /* user cancelled */ }
    } else {
      galleryRef.current?.click();
    }
  };

  const reset = () => {
    setPreviewUrl(null);
    setResult(null);
    setError('');
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const hasItems = result && result.items && result.items.length > 0;

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ScanLine className="w-7 h-7 text-emerald-600" />
          Waste Scanner
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Take or upload a photo — AI will detect, label, and guide disposal of every waste item in the scene.
        </p>
      </div>

      {/* Capture area or Image + canvas overlay */}
      {!previewUrl ? (
        <div className="border-2 border-dashed border-emerald-200 rounded-2xl p-8 bg-emerald-50 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <Camera className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-700">Scan a waste item or scene</p>
            <p className="text-xs text-gray-500 mt-1">
              Point at any waste — plastic, food, batteries, electronics, mixed bags…
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={openCamera}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors text-sm"
            >
              <Camera className="w-4 h-4" />
              Camera
            </button>
            <button
              onClick={openGallery}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Gallery
            </button>
          </div>
        </div>
      ) : (
        <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-black">
          <img
            ref={imgRef}
            src={previewUrl}
            alt="Waste scan"
            className="w-full max-h-72 object-contain"
            onLoad={redrawContours}
          />
          {/* Canvas for contour overlays */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: '100%' }}
          />
          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-[3px] border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-white text-sm font-medium">{loadingStep || 'Analysing…'}</p>
            </div>
          )}
          <button
            onClick={reset}
            className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow hover:bg-white transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-gray-700" />
          </button>
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Image quality + scene context banner */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm">
            {/* Scene */}
            <div className="flex items-start gap-2">
              <Eye className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{result.sceneDescription}</p>
            </div>
            {result.context && result.context !== 'other' && (
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 capitalize">
                  Environment: <strong className="text-gray-700">{result.context}</strong>
                </span>
              </div>
            )}
            {/* Image quality */}
            <QualityBadge quality={result.imageQuality} />
          </div>

          {/* Unknown objects + web context */}
          {result.unknownObjects?.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Unidentified objects
              </p>
              {result.unknownObjects.map((obj) => (
                <div key={obj} className="space-y-1">
                  <p className="text-sm font-medium text-gray-800">{obj}</p>
                  {result.webContext?.[obj] && (
                    <p className="text-xs text-gray-600 bg-white/70 rounded-lg p-2 leading-relaxed">
                      🔍 {result.webContext[obj]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Items count header */}
          {hasItems && (
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">
                {result.items.length} waste item{result.items.length > 1 ? 's' : ''} detected
              </p>
              <span className="text-xs text-gray-400">Tap each to expand</span>
            </div>
          )}

          {/* Item cards (one per detected item) */}
          {hasItems
            ? result.items.map((item, i) => (
                <WasteItemCard key={i} item={item} index={i} />
              ))
            : result.category !== 'Unknown' && (
                /* Fallback: legacy single-item card for API responses without items array */
                <div className={`rounded-2xl border-2 p-5 space-y-4 ${CATEGORY_META[result.category]?.bg ?? 'bg-gray-50'} ${CATEGORY_META[result.category]?.border ?? 'border-gray-200'}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Identified as</p>
                      <p className="text-xl font-bold text-gray-900 mt-0.5">{result.wasteType}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${CATEGORY_META[result.category]?.bg} ${CATEGORY_META[result.category]?.text} border ${CATEGORY_META[result.category]?.border}`}>
                      {CATEGORY_META[result.category]?.emoji} {result.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 bg-white/70 rounded-xl p-3">
                    <div className="w-10 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: result.binColor }} />
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Dispose in</p>
                      <p className="font-bold text-gray-900">{result.bin}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.recyclable
                      ? <><Recycle className="w-5 h-5 text-green-600" /><span className="text-sm font-semibold text-green-700">Recyclable</span></>
                      : <><Trash2 className="w-5 h-5 text-gray-500" /><span className="text-sm font-semibold text-gray-600">Not recyclable</span></>}
                    <span className="ml-auto"><ConfidenceBadge confidence={result.confidence} /></span>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">How to dispose</p>
                    <p className="text-sm text-gray-800">{result.instructions}</p>
                  </div>
                </div>
              )}

          {/* Scan again */}
          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ScanLine className="w-4 h-4" />
            Scan another item
          </button>
        </div>
      )}

      {/* Bin reference guide (shown only before first scan) */}
      {!result && !loading && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Bin Reference</p>
          <div className="space-y-2">
            {[
              { color: '#3B82F6', label: 'Blue Bin',  desc: 'Dry Waste — plastic, paper, metal, glass' },
              { color: '#22C55E', label: 'Green Bin', desc: 'Wet Waste — food scraps, organic' },
              { color: '#EF4444', label: 'Red Bin',   desc: 'Hazardous — batteries, medicines, chemicals' },
              { color: '#374151', label: 'Black Bin', desc: 'Sanitary — diapers, bandages' },
              { color: '#F59E0B', label: 'E-Waste',   desc: 'Electronics — phones, chargers, cables' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                <span className="text-sm font-semibold text-gray-700 w-24">{b.label}</span>
                <span className="text-xs text-gray-500">{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
