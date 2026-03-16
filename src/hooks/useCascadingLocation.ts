import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface City {
  id: string;
  name: string;
  state: string;
}

export interface Zone {
  id: string;
  name: string;
  cityId: string;
  isActive?: boolean;
}

export interface Ward {
  id: string;
  name: string;
  zoneId: string;
  cityId: string;
  lat?: number;
  lng?: number;
  isActive?: boolean;
}

/** Returns live lists of cities, zones (filtered by cityId), and wards (filtered by zoneId). */
export function useCascadingLocation() {
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);
  const [loadingZones, setLoadingZones] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedWardId, setSelectedWardId] = useState('');

  // Load all cities once
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cities'), (snap) => {
      const list: City[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as City));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCities(list);
      setLoadingCities(false);
    });
    return () => unsub();
  }, []);

  // Load zones when city changes (only active zones)
  useEffect(() => {
    setZones([]);
    setWards([]);
    setSelectedZoneId('');
    setSelectedWardId('');
    if (!selectedCityId) { setLoadingZones(false); return; }

    setLoadingZones(true);
    const q = query(collection(db, 'zones'), where('cityId', '==', selectedCityId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Zone[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.isActive !== false) list.push({ id: d.id, ...data } as Zone);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setZones(list);
      setLoadingZones(false);
    });
    return () => unsub();
  }, [selectedCityId]);

  // Load wards when zone changes (only active wards)
  useEffect(() => {
    setWards([]);
    setSelectedWardId('');
    if (!selectedZoneId) { setLoadingWards(false); return; }

    setLoadingWards(true);
    const q = query(collection(db, 'wards'), where('zoneId', '==', selectedZoneId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Ward[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.isActive !== false) list.push({ id: d.id, ...data } as Ward);
      });
      list.sort((a, b) => a.name.localeCompare(b.name));
      setWards(list);
      setLoadingWards(false);
    });
    return () => unsub();
  }, [selectedZoneId]);

  return {
    cities, zones, wards,
    loadingCities, loadingZones, loadingWards,
    selectedCityId, selectedZoneId, selectedWardId,
    setSelectedCityId, setSelectedZoneId, setSelectedWardId,
  };
}

/** Standalone loaders — fetch all zones or all wards (for display, not cascading). */
export function useAllZones() {
  const [zones, setZones] = useState<Zone[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'zones'), (snap) => {
      const list: Zone[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Zone));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setZones(list);
    });
    return () => unsub();
  }, []);
  return zones;
}

export function useAllWards() {
  const [wards, setWards] = useState<Ward[]>([]);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'wards'), (snap) => {
      const list: Ward[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ward));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setWards(list);
    });
    return () => unsub();
  }, []);
  return wards;
}
