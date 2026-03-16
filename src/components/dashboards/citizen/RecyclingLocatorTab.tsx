import { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone, Clock, Filter, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

interface Facility {
  id: string;
  name: string;
  address: string;
  type: FacilityType;
  accepts: WasteCategory[];
  distance?: number; // km
  phone?: string;
  hours?: string;
  lat: number;
  lng: number;
}

type FacilityType = 'Recycling Centre' | 'E-Waste Drop-off' | 'Hazardous Waste' | 'Composting' | 'Collection Point';
type WasteCategory = 'Dry Waste' | 'Wet Waste' | 'E-Waste' | 'Hazardous Waste' | 'Sanitary Waste';

const CATEGORY_META: Record<WasteCategory, { color: string; bg: string; text: string }> = {
  'Dry Waste':      { color: '#3B82F6', bg: 'bg-blue-100',   text: 'text-blue-700'   },
  'Wet Waste':      { color: '#22C55E', bg: 'bg-green-100',  text: 'text-green-700'  },
  'E-Waste':        { color: '#F59E0B', bg: 'bg-amber-100',  text: 'text-amber-700'  },
  'Hazardous Waste':{ color: '#EF4444', bg: 'bg-red-100',    text: 'text-red-700'    },
  'Sanitary Waste': { color: '#6B7280', bg: 'bg-gray-100',   text: 'text-gray-700'   },
};

const TYPE_ICON: Record<FacilityType, string> = {
  'Recycling Centre':  '♻️',
  'E-Waste Drop-off':  '🔋',
  'Hazardous Waste':   '☣️',
  'Composting':        '🌱',
  'Collection Point':  '📦',
};

// Haversine distance in km
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Sample facilities — in production these would come from Firestore or a Places API
const SAMPLE_FACILITIES: Facility[] = [
  {
    id: '1',
    name: 'City Recycling Centre',
    address: 'Sector 12, Near Bus Stand',
    type: 'Recycling Centre',
    accepts: ['Dry Waste'],
    phone: '+91-9800000001',
    hours: 'Mon–Sat 8 AM – 6 PM',
    lat: 0, lng: 0,
  },
  {
    id: '2',
    name: 'E-Waste Collection Hub',
    address: 'Industrial Area, Phase 2',
    type: 'E-Waste Drop-off',
    accepts: ['E-Waste'],
    phone: '+91-9800000002',
    hours: 'Mon–Fri 9 AM – 5 PM',
    lat: 0.002, lng: 0.003,
  },
  {
    id: '3',
    name: 'Hazardous Waste Facility',
    address: 'GIDC Estate, Plot 44',
    type: 'Hazardous Waste',
    accepts: ['Hazardous Waste'],
    phone: '+91-9800000003',
    hours: 'Tue & Thu 10 AM – 4 PM',
    lat: -0.003, lng: 0.005,
  },
  {
    id: '4',
    name: 'Community Compost Pit',
    address: 'Green Park, Gate 2',
    type: 'Composting',
    accepts: ['Wet Waste'],
    hours: 'Daily 6 AM – 8 PM',
    lat: 0.001, lng: -0.002,
  },
  {
    id: '5',
    name: 'Municipal Collection Point',
    address: 'Main Market, Stall No. 3',
    type: 'Collection Point',
    accepts: ['Dry Waste', 'Wet Waste', 'Sanitary Waste'],
    hours: 'Daily 7 AM – 7 PM',
    lat: -0.001, lng: 0.001,
  },
];

const ALL_CATEGORIES: WasteCategory[] = ['Dry Waste', 'Wet Waste', 'E-Waste', 'Hazardous Waste', 'Sanitary Waste'];

export default function RecyclingLocatorTab() {
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locError, setLocError] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<WasteCategory | 'All'>('All');
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  const getLocation = async () => {
    setLocLoading(true);
    setLocError('');
    try {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.requestPermissions();
        const pos = await Geolocation.getCurrentPosition({ timeout: 8000 });
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } else {
        if (!navigator.geolocation) {
          setLocError('Geolocation not supported by your browser.');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => setLocError('Could not get your location. Showing sample facilities nearby.'),
          { timeout: 8000 }
        );
      }
    } catch {
      setLocError('Could not get your location. Showing sample facilities nearby.');
    } finally {
      setLocLoading(false);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  const facilities: Facility[] = SAMPLE_FACILITIES.map((f) => ({
    ...f,
    // If user location available, offset sample coords from user; else use raw offsets
    lat: userLoc ? userLoc.lat + f.lat : f.lat,
    lng: userLoc ? userLoc.lng + f.lng : f.lng,
    distance: userLoc
      ? distanceKm(userLoc.lat, userLoc.lng, userLoc.lat + f.lat, userLoc.lng + f.lng)
      : undefined,
  })).sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

  const filtered = selectedCategory === 'All'
    ? facilities
    : facilities.filter((f) => f.accepts.includes(selectedCategory as WasteCategory));

  const openMaps = (f: Facility) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${f.lat},${f.lng}`;
    window.open(url, '_blank');
  };

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-in fade-in duration-300">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MapPin className="w-7 h-7 text-emerald-600" />
          Recycling Locator
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Find nearby recycling centres, e-waste drop-offs, and collection points.
        </p>
      </div>

      {/* Location bar */}
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
        {locLoading ? (
          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin flex-shrink-0" />
        ) : userLoc ? (
          <Navigation className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        )}
        <span className="text-sm flex-1 text-gray-700">
          {locLoading
            ? 'Getting your location…'
            : userLoc
            ? 'Using your current location'
            : locError || 'Location unavailable'}
        </span>
        {!locLoading && !userLoc && (
          <button
            type="button"
            onClick={getLocation}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            Retry
          </button>
        )}
      </div>

      {/* Category filter */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Filter by waste type
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              selectedCategory === 'All'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
            }`}
          >
            All
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = selectedCategory === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  active
                    ? `${meta.bg} ${meta.text} border-current`
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Facility list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          No facilities found for this category.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              onClick={() => setSelectedFacility(selectedFacility?.id === f.id ? null : f)}
              className="w-full text-left bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{TYPE_ICON[f.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate">{f.name}</p>
                    {f.distance !== undefined && (
                      <span className="text-xs font-semibold text-emerald-600 flex-shrink-0">
                        {f.distance < 1
                          ? `${Math.round(f.distance * 1000)} m`
                          : `${f.distance.toFixed(1)} km`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{f.address}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.accepts.map((cat) => (
                      <span
                        key={cat}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_META[cat].bg} ${CATEGORY_META[cat].text}`}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {selectedFacility?.id === f.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  {f.hours && (
                    <p className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {f.hours}
                    </p>
                  )}
                  {f.phone && (
                    <a
                      href={`tel:${f.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 text-sm text-emerald-600 font-medium hover:underline"
                    >
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      {f.phone}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openMaps(f); }}
                    className="flex items-center gap-2 text-sm text-blue-600 font-medium hover:underline"
                  >
                    <ExternalLink className="w-4 h-4 flex-shrink-0" />
                    Open in Google Maps
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Facility Types</p>
        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          {(Object.entries(TYPE_ICON) as [FacilityType, string][]).map(([type, emoji]) => (
            <div key={type} className="flex items-center gap-2 text-sm text-gray-700">
              <span>{emoji}</span>
              <span className="text-xs">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
