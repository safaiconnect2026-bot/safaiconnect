import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Loader2, AlertTriangle } from 'lucide-react';

// Leaflet icon fix (same as HeatmapTab)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Task {
  assignmentId: string;
  title: string;
  category: string;
  location: string;
  workerStatus: string;
  lat?: number;
  lng?: number;
}

interface WorkerRouteTabProps {
  tasks: Task[];
}

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Creates a numbered divIcon for tasks
function createNumberedIcon(num: number, color: string) {
  return L.divIcon({
    html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${num}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Fit map to route bounds
const FitBounds: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40], maxZoom: 14 });
    } else if (positions.length === 1) {
      map.setView(positions[0], 14);
    }
  }, [map, positions]);
  return null;
};

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#10b981',
};

const WorkerRouteTab: React.FC<WorkerRouteTabProps> = ({ tasks }) => {
  const [workerPos, setWorkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(true);
  const [locError, setLocError] = useState<string | null>(null);

  // Get worker's current GPS position
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported in this browser.');
      setLocLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setWorkerPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocLoading(false);
      },
      () => {
        setLocError('Location access denied. Showing tasks without distance sorting.');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Tasks with lat/lng, sorted by distance from worker
  const mappableTasks = useMemo(() => {
    const withCoords = tasks.filter(t => t.lat != null && t.lng != null && t.workerStatus !== 'COMPLETED');
    if (!workerPos) return withCoords;
    return [...withCoords].sort((a, b) =>
      haversineKm(workerPos.lat, workerPos.lng, a.lat!, a.lng!) -
      haversineKm(workerPos.lat, workerPos.lng, b.lat!, b.lng!)
    );
  }, [tasks, workerPos]);

  // Polyline: worker → task1 → task2 → ...
  const routePositions = useMemo((): [number, number][] => {
    const pts: [number, number][] = [];
    if (workerPos) pts.push([workerPos.lat, workerPos.lng]);
    mappableTasks.forEach(t => pts.push([t.lat!, t.lng!]));
    return pts;
  }, [workerPos, mappableTasks]);

  const tasksWithoutCoords = tasks.filter(t => (t.lat == null || t.lng == null) && t.workerStatus !== 'COMPLETED');

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Navigation className="w-7 h-7 text-emerald-500" />
          Optimized Route
        </h2>
        <p className="text-gray-500 text-sm">Tasks sorted by distance — nearest first</p>
      </div>

      {locError && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {locError}
        </div>
      )}

      {locLoading ? (
        <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-gray-200">
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Getting your location...</p>
          </div>
        </div>
      ) : mappableTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-2xl border border-gray-200 text-gray-400">
          <MapPin className="w-14 h-14 mb-3 text-gray-200" />
          <p className="font-semibold">No mapped tasks available</p>
          <p className="text-sm mt-1">Tasks need GPS coordinates to appear on the route map</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm" style={{ height: 480 }}>
          <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds positions={routePositions} />

            {/* Worker position */}
            {workerPos && (
              <CircleMarker
                center={[workerPos.lat, workerPos.lng]}
                radius={10}
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9 }}
              >
                <Popup>📍 Your Location</Popup>
              </CircleMarker>
            )}

            {/* Task markers */}
            {mappableTasks.map((task, i) => (
              <Marker
                key={task.assignmentId}
                position={[task.lat!, task.lng!]}
                icon={createNumberedIcon(i + 1, STATUS_COLORS[task.workerStatus] ?? '#6b7280')}
              >
                <Popup>
                  <strong>{i + 1}. {task.title}</strong><br />
                  <span className="text-xs text-gray-500">{task.location}</span><br />
                  {workerPos && (
                    <span className="text-xs font-medium text-blue-600">
                      📍 {haversineKm(workerPos.lat, workerPos.lng, task.lat!, task.lng!).toFixed(1)} km away
                    </span>
                  )}
                </Popup>
              </Marker>
            ))}

            {/* Route polyline */}
            {routePositions.length > 1 && (
              <Polyline
                positions={routePositions}
                pathOptions={{ color: '#10b981', weight: 3, dashArray: '8, 8', opacity: 0.7 }}
              />
            )}
          </MapContainer>
        </div>
      )}

      {/* Ordered task list */}
      {mappableTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900">Route Order</h3>
          {mappableTasks.map((task, i) => (
            <div key={task.assignmentId} className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: STATUS_COLORS[task.workerStatus] ?? '#6b7280' }}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{task.title}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{task.location}</span>
                </p>
              </div>
              {workerPos && task.lat && task.lng && (
                <span className="text-xs font-semibold text-blue-600 flex-shrink-0">
                  {haversineKm(workerPos.lat, workerPos.lng, task.lat, task.lng).toFixed(1)} km
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tasks without coords warning */}
      {tasksWithoutCoords.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          <strong>{tasksWithoutCoords.length} task(s)</strong> are not shown on the map because they don't have GPS coordinates.
          These will appear once citizens submit complaints with location enabled.
        </div>
      )}
    </div>
  );
};

export default WorkerRouteTab;
