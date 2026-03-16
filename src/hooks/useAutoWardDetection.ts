import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface WardWithCoords {
  id: string;
  name: string;
  zoneId: string;
  cityId: string;
  lat?: number;
  lng?: number;
}

interface ZoneInfo {
  id: string;
  name: string;
  cityId: string;
}

interface CityInfo {
  id: string;
  name: string;
}

export interface DetectedLocation {
  wardId: string;
  wardName: string;
  zoneId: string;
  zoneName: string;
  cityId: string;
  cityName: string;
  distanceKm: number | null; // null when matched by city name only
}

/** Haversine distance in km between two lat/lng points */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Given GPS coordinates, finds the nearest ward from Firestore.
 * Primary: match by ward center-point coordinates (Haversine).
 * Fallback: match city by name from Nominatim reverse-geocode response,
 *           then pick the first ward in the first zone of that city.
 */
export function useAutoWardDetection() {
  const [allWards, setAllWards] = useState<WardWithCoords[]>([]);
  const [zones, setZones] = useState<Map<string, ZoneInfo>>(new Map());
  const [cities, setCities] = useState<Map<string, CityInfo>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<DetectedLocation | null>(null);

  // Store pending coordinates so we can retry when data finishes loading
  const pendingRef = useRef<{ lat: number; lng: number; cityHint?: string } | null>(null);

  // Load all wards, zones, and cities once
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [wardsSnap, zonesSnap, citiesSnap] = await Promise.all([
        getDocs(collection(db, 'wards')),
        getDocs(collection(db, 'zones')),
        getDocs(collection(db, 'cities')),
      ]);

      if (cancelled) return;

      const wardList: WardWithCoords[] = [];
      wardsSnap.forEach((d) => {
        const data = d.data();
        if (data.isActive !== false) {
          wardList.push({
            id: d.id,
            name: data.name,
            zoneId: data.zoneId,
            cityId: data.cityId,
            lat: data.lat ?? undefined,
            lng: data.lng ?? undefined,
          });
        }
      });

      const zoneMap = new Map<string, ZoneInfo>();
      zonesSnap.forEach((d) => {
        const data = d.data();
        zoneMap.set(d.id, { id: d.id, name: data.name, cityId: data.cityId });
      });

      const cityMap = new Map<string, CityInfo>();
      citiesSnap.forEach((d) => {
        const data = d.data();
        cityMap.set(d.id, { id: d.id, name: data.name });
      });

      setAllWards(wardList);
      setZones(zoneMap);
      setCities(cityMap);
      setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // When data finishes loading, retry if there are pending coordinates
  useEffect(() => {
    if (loaded && pendingRef.current && !detected) {
      const { lat, lng, cityHint } = pendingRef.current;
      runDetection(lat, lng, cityHint);
      pendingRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  /** Core detection logic */
  const runDetection = useCallback(
    (lat: number, lng: number, cityHint?: string): DetectedLocation | null => {
      setDetecting(true);

      // --- Strategy 1: Find nearest ward by coordinates ---
      const wardsWithCoords = allWards.filter((w) => w.lat != null && w.lng != null);
      if (wardsWithCoords.length > 0) {
        let nearest: WardWithCoords | null = null;
        let minDist = Infinity;

        for (const ward of wardsWithCoords) {
          const dist = haversineKm(lat, lng, ward.lat!, ward.lng!);
          if (dist < minDist) {
            minDist = dist;
            nearest = ward;
          }
        }

        if (nearest) {
          const zone = zones.get(nearest.zoneId);
          const city = cities.get(nearest.cityId);
          const result: DetectedLocation = {
            wardId: nearest.id,
            wardName: nearest.name,
            zoneId: nearest.zoneId,
            zoneName: zone?.name || '',
            cityId: nearest.cityId,
            cityName: city?.name || '',
            distanceKm: Math.round(minDist * 100) / 100,
          };
          setDetected(result);
          setDetecting(false);
          return result;
        }
      }

      // --- Strategy 2: Match city by name from Nominatim hint, pick first zone/ward ---
      if (cityHint) {
        const hint = cityHint.toLowerCase().trim();
        let matchedCityId: string | null = null;

        for (const [cid, city] of cities) {
          if (hint.includes(city.name.toLowerCase())) {
            matchedCityId = cid;
            break;
          }
        }

        if (matchedCityId) {
          // Find zones in this city, then find the first ward in the first zone
          const cityZones = Array.from(zones.values()).filter((z) => z.cityId === matchedCityId);
          if (cityZones.length > 0) {
            const firstZone = cityZones[0];
            const zoneWards = allWards.filter((w) => w.zoneId === firstZone.id);
            if (zoneWards.length > 0) {
              const ward = zoneWards[0];
              const city = cities.get(matchedCityId)!;
              const result: DetectedLocation = {
                wardId: ward.id,
                wardName: ward.name,
                zoneId: firstZone.id,
                zoneName: firstZone.name,
                cityId: matchedCityId,
                cityName: city.name,
                distanceKm: null,
              };
              setDetected(result);
              setDetecting(false);
              return result;
            }
          }
        }
      }

      setDetecting(false);
      return null;
    },
    [allWards, zones, cities],
  );

  /** Public API: detect ward from GPS coordinates + optional city name hint */
  const detectWard = useCallback(
    (lat: number, lng: number, cityHint?: string): DetectedLocation | null => {
      if (!loaded) {
        // Data not ready yet — store for retry
        pendingRef.current = { lat, lng, cityHint };
        setDetecting(true);
        return null;
      }
      return runDetection(lat, lng, cityHint);
    },
    [loaded, runDetection],
  );

  return { detectWard, detected, detecting, loaded, clearDetected: () => setDetected(null) };
}
