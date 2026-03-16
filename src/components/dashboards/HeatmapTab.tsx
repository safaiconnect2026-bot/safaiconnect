import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Map, Loader2, Filter } from 'lucide-react';

// Fix Leaflet default marker icon URLs broken by Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface HeatPoint {
  lat: number;
  lng: number;
  intensity: number;
}

// Inner component that uses useMap() hook
const HeatmapLayer: React.FC<{ points: HeatPoint[] }> = ({ points }) => {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    if (layerRef.current) map.removeLayer(layerRef.current);
    if (!points.length) return;

    const heatData: [number, number, number][] = points.map(p => [p.lat, p.lng, p.intensity]);
    const heat = (L as unknown as { heatLayer: (pts: [number, number, number][], opts: object) => L.Layer })
      .heatLayer(heatData, { radius: 30, blur: 20, maxZoom: 17, max: 1.0 });
    heat.addTo(map);
    layerRef.current = heat;

    // Auto-fit bounds to data
    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    return () => { if (layerRef.current) map.removeLayer(layerRef.current); };
  }, [map, points]);

  return null;
};

// Status intensity weights
const INTENSITY: Record<string, number> = {
  SUBMITTED: 0.5,
  UNDER_REVIEW: 0.65,
  ASSIGNED: 0.8,
  RESOLVED: 0.2,
};

const PERIODS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: 0 },
];

const CATEGORIES = ['All', 'Waste Management', 'Road Damage', 'Street Lighting', 'Drainage/Sewage', 'Public Property Damage', 'Water Supply', 'Noise Pollution', 'Other'];

interface RawComplaint {
  id: string;
  lat?: number;
  lng?: number;
  status?: string;
  category?: string;
  createdAt?: unknown;
}

const HeatmapTab: React.FC = () => {
  const [complaints, setComplaints] = useState<RawComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodIdx, setPeriodIdx] = useState(1);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'complaints'));
    const unsub = onSnapshot(q, snap => {
      const docs: RawComplaint[] = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() } as RawComplaint));
      setComplaints(docs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const heatPoints = useMemo((): HeatPoint[] => {
    const period = PERIODS[periodIdx];
    const cutoff = period.days > 0 ? Date.now() - period.days * 86400_000 : 0;

    return complaints
      .filter(c => {
        if (c.lat == null || c.lng == null) return false;
        if (category !== 'All' && c.category !== category) return false;
        if (cutoff > 0 && c.createdAt) {
          try {
            const ts = c.createdAt as { toMillis?: () => number };
            const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(c.createdAt as string).getTime();
            if (ms < cutoff) return false;
          } catch { return false; }
        }
        return true;
      })
      .map(c => ({
        lat: c.lat!,
        lng: c.lng!,
        intensity: INTENSITY[c.status ?? 'SUBMITTED'] ?? 0.5,
      }));
  }, [complaints, periodIdx, category]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Map className="w-7 h-7 text-emerald-500" />
            Complaint Heatmap
          </h2>
          <p className="text-gray-500 text-sm">Visualise complaint density across the city</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={periodIdx}
            onChange={e => setPeriodIdx(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {PERIODS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4 text-xs flex-wrap">
        {[
          { color: 'bg-blue-500', label: `${heatPoints.length} mapped complaints` },
          { color: 'bg-gray-300', label: `${complaints.length - heatPoints.length} without GPS (not shown)` },
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1">
            <span className={`w-2 h-2 rounded-full ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-gray-200">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
        </div>
      ) : heatPoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <Map className="w-16 h-16 mb-3 text-gray-200" />
          <p className="font-semibold">No location data available</p>
          <p className="text-sm mt-1">Submit complaints with GPS enabled to see the heatmap</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 520 }}>
          <MapContainer
            center={[20.5937, 78.9629]}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <HeatmapLayer points={heatPoints} />
          </MapContainer>
        </div>
      )}

      {/* Heat legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Heat Intensity Guide</p>
        <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
          {Object.entries(INTENSITY).map(([status, val]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `hsl(${120 - val * 120}, 80%, 50%)` }} />
              {status} ({Math.round(val * 100)}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeatmapTab;
