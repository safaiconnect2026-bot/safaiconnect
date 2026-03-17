import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';

export interface GeoResult {
  lat: number;
  lng: number;
  accuracy: number;           // metres
  city: string | null;
  district: string | null;
  state: string | null;
  formattedAddress: string | null;
}

export type LocationStatus = 'idle' | 'requesting' | 'tracking' | 'error';

interface UseRealTimeLocationOptions {
  /** Called every time position updates AND geocoding completes */
  onUpdate?: (result: GeoResult) => void;
  /** Minimum metres device must move before triggering a new geocode call (default 30) */
  geocodeThresholdMetres?: number;
}

/** Haversine distance in metres */
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1), dLng = toR(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useRealTimeLocation(options: UseRealTimeLocationOptions = {}) {
  const { onUpdate, geocodeThresholdMetres = 30 } = options;

  const [status, setStatus]   = useState<LocationStatus>('idle');
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<GeoResult | null>(null);

  const watchIdRef   = useRef<number | null>(null);
  const lastLatRef   = useRef<number | null>(null);
  const lastLngRef   = useRef<number | null>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const onUpdateRef  = useRef(onUpdate);

  // Keep onUpdateRef current so the closure in handlePosition doesn't go stale
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  const geocode = useCallback(async (lat: number, lng: number, accuracy: number) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`, {
        signal: abortRef.current.signal,
      });

      let geo: GeoResult;

      if (res.ok) {
        const data = await res.json();
        geo = { lat, lng, accuracy, ...data };
      } else {
        // Server-side error — emit raw coords so ward detection can still run
        geo = { lat, lng, accuracy, city: null, district: null, state: null, formattedAddress: null };
        console.warn('[useRealTimeLocation] geocode API error:', res.status);
      }

      setResult(geo);
      onUpdateRef.current?.(geo);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('[useRealTimeLocation] geocode fetch failed:', err.message);
        // Fallback — still call onUpdate with raw coords
        const geo: GeoResult = {
          lat, lng, accuracy,
          city: null, district: null, state: null, formattedAddress: null,
        };
        setResult(geo);
        onUpdateRef.current?.(geo);
      }
    }
  }, []);

  const handlePosition = useCallback((lat: number, lng: number, accuracy: number) => {
    setStatus('tracking');
    setError(null);

    const prevLat = lastLatRef.current;
    const prevLng = lastLngRef.current;
    const firstFix = prevLat === null || prevLng === null;
    const moved = firstFix || haversineM(prevLat!, prevLng!, lat, lng) >= geocodeThresholdMetres;

    if (moved) {
      lastLatRef.current = lat;
      lastLngRef.current = lng;
      geocode(lat, lng, accuracy);
    }
  }, [geocode, geocodeThresholdMetres]);

  const start = useCallback(async () => {
    setStatus('requesting');
    setError(null);
    lastLatRef.current = null;
    lastLngRef.current = null;

    if (Capacitor.isNativePlatform()) {
      // ── Native (Android/iOS) ─────────────────────────────────────────────
      try {
        const perm = await CapGeolocation.checkPermissions();
        if (perm.location !== 'granted') {
          await CapGeolocation.requestPermissions();
        }

        // Capacitor doesn't expose watchPosition natively in the same way,
        // so we poll at 5-second intervals using getCurrentPosition.
        const poll = async () => {
          try {
            const pos = await CapGeolocation.getCurrentPosition({ enableHighAccuracy: true });
            handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
          } catch { /* swallow individual poll errors */ }
        };

        await poll(); // immediate first fix
        const id = window.setInterval(poll, 5_000);
        // Store interval id as a negative number to distinguish from browser watchId
        watchIdRef.current = -id;
      } catch (e: any) {
        setStatus('error');
        setError('Location permission denied. Please allow it in your device settings.');
      }
    } else {
      // ── Web ──────────────────────────────────────────────────────────────
      if (!navigator.geolocation) {
        setStatus('error');
        setError('Geolocation is not supported by this browser.');
        return;
      }

      const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 };

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          const msgs: Record<number, string> = {
            1: 'Location permission denied. Please allow location access in browser settings.',
            2: 'Location unavailable. Check your GPS or network connection.',
            3: 'Location request timed out. Try again.',
          };
          setStatus('error');
          setError(msgs[err.code] ?? 'Unknown location error.');
        },
        opts,
      );
    }
  }, [handlePosition]);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      if (watchIdRef.current < 0) {
        // Capacitor poll interval
        clearInterval(-watchIdRef.current);
      } else {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    }
    abortRef.current?.abort();
    setStatus('idle');
    setResult(null);
    lastLatRef.current = null;
    lastLngRef.current = null;
  }, []);

  // Auto-stop on unmount
  useEffect(() => () => {
    if (watchIdRef.current !== null) {
      if (watchIdRef.current < 0) clearInterval(-watchIdRef.current);
      else navigator.geolocation.clearWatch(watchIdRef.current);
    }
    abortRef.current?.abort();
  }, []);

  return { status, error, result, start, stop };
}
