import React, { useState, useEffect } from 'react';
import {
  Plus, Edit, Trash2, X, Loader2, ChevronRight,
  Building2, Map, LayoutGrid, CheckCircle, AlertTriangle,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface City { id: string; name: string; state: string; }
interface Zone { id: string; name: string; cityId: string; isActive?: boolean; }
interface Ward { id: string; name: string; zoneId: string; cityId: string; isActive?: boolean; }

const LocationManagementTab: React.FC = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [modal, setModal] = useState<{
    type: 'city' | 'zone' | 'ward';
    mode: 'add' | 'edit';
    data?: any;
  } | null>(null);
  const [formName, setFormName] = useState('');
  const [formState, setFormState] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'city' | 'zone' | 'ward'; id: string; name: string } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Live listeners
  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'cities'), (snap) => {
      const list: City[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as City));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCities(list);
      setLoading(false);
    });
    const u2 = onSnapshot(collection(db, 'zones'), (snap) => {
      const list: Zone[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Zone));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setZones(list);
    });
    const u3 = onSnapshot(collection(db, 'wards'), (snap) => {
      const list: Ward[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ward));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setWards(list);
    });
    return () => { u1(); u2(); u3(); };
  }, []);

  const filteredZones = selectedCityId ? zones.filter(z => z.cityId === selectedCityId) : [];
  const filteredWards = selectedZoneId ? wards.filter(w => w.zoneId === selectedZoneId) : [];
  const selectedCity = cities.find(c => c.id === selectedCityId);
  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const openModal = (type: 'city' | 'zone' | 'ward', mode: 'add' | 'edit', data?: any) => {
    setModal({ type, mode, data });
    setFormName(mode === 'edit' ? data?.name || '' : '');
    setFormState(mode === 'edit' && type === 'city' ? data?.state || '' : '');
  };

  const generateId = (prefix: string, name: string) =>
    `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`;

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (modal?.type === 'city') {
        if (modal.mode === 'add') {
          const id = generateId('city', formName);
          await setDoc(doc(db, 'cities', id), {
            name: formName.trim(),
            state: formState.trim(),
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'cities', modal.data.id), {
            name: formName.trim(),
            state: formState.trim(),
          });
        }
      } else if (modal?.type === 'zone') {
        if (modal.mode === 'add') {
          const id = generateId('zone', formName);
          await setDoc(doc(db, 'zones', id), {
            name: formName.trim(),
            cityId: selectedCityId,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'zones', modal.data.id), { name: formName.trim(), updatedAt: serverTimestamp() });
        }
      } else if (modal?.type === 'ward') {
        if (modal.mode === 'add') {
          const id = generateId('ward', formName);
          await setDoc(doc(db, 'wards', id), {
            name: formName.trim(),
            zoneId: selectedZoneId,
            cityId: selectedCityId,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'wards', modal.data.id), { name: formName.trim(), updatedAt: serverTimestamp() });
        }
      }
      showToast(`${modal?.type} ${modal?.mode === 'add' ? 'added' : 'updated'} successfully.`);
      setModal(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save.', false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      const { type, id } = confirmDelete;

      if (type === 'city') {
        // Delete all child zones and wards
        const childZones = zones.filter(z => z.cityId === id);
        for (const z of childZones) {
          const childWards = wards.filter(w => w.zoneId === z.id);
          for (const w of childWards) await deleteDoc(doc(db, 'wards', w.id));
          await deleteDoc(doc(db, 'zones', z.id));
        }
        await deleteDoc(doc(db, 'cities', id));
        if (selectedCityId === id) { setSelectedCityId(null); setSelectedZoneId(null); }
      } else if (type === 'zone') {
        const childWards = wards.filter(w => w.zoneId === id);
        for (const w of childWards) await deleteDoc(doc(db, 'wards', w.id));
        await deleteDoc(doc(db, 'zones', id));
        if (selectedZoneId === id) setSelectedZoneId(null);
      } else {
        await deleteDoc(doc(db, 'wards', id));
      }

      showToast(`${type} deleted successfully.`);
      setConfirmDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete.', false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (type: 'zone' | 'ward', id: string, currentlyActive: boolean) => {
    try {
      const col = type === 'zone' ? 'zones' : 'wards';
      await updateDoc(doc(db, col, id), { isActive: !currentlyActive, updatedAt: serverTimestamp() });
      if (type === 'zone' && !currentlyActive === false) {
        // Deactivating a zone — also deactivate its wards
        const childWards = wards.filter(w => w.zoneId === id);
        for (const w of childWards) {
          await updateDoc(doc(db, 'wards', w.id), { isActive: false, updatedAt: serverTimestamp() });
        }
      }
      showToast(`${type} ${!currentlyActive ? 'activated' : 'deactivated'}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle status.', false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 min-h-[600px]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all duration-300 ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Location Management</h2>
        <p className="text-gray-500">Manage cities, zones, and wards hierarchy</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl p-5 border bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><Building2 className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : cities.length}</div>
            <div className="text-sm font-medium opacity-80">Cities</div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><Map className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : zones.length}</div>
            <div className="text-sm font-medium opacity-80">Zones</div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-purple-50 text-purple-700 border-purple-100 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><LayoutGrid className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : wards.length}</div>
            <div className="text-sm font-medium opacity-80">Wards</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Cities */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" /> Cities
              </h3>
              <button onClick={() => openModal('city', 'add')} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {cities.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No cities added yet</div>
              ) : cities.map(city => (
                <div
                  key={city.id}
                  className={`px-5 py-3 flex items-center justify-between cursor-pointer transition-colors ${selectedCityId === city.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'}`}
                  onClick={() => { setSelectedCityId(city.id); setSelectedZoneId(null); }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{city.name}</p>
                    <p className="text-xs text-gray-500">{city.state} &middot; {zones.filter(z => z.cityId === city.id).length} zones</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openModal('city', 'edit', city); }} className="p-1 hover:bg-gray-200 rounded">
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'city', id: city.id, name: city.name }); }} className="p-1 hover:bg-red-100 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Zones */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Map className="w-4 h-4 text-emerald-600" /> Zones
                {selectedCity && <span className="text-xs text-gray-400 font-normal ml-1">in {selectedCity.name}</span>}
              </h3>
              {selectedCityId && (
                <button onClick={() => openModal('zone', 'add')} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {!selectedCityId ? (
                <div className="p-8 text-center text-gray-400 text-sm">Select a city to view zones</div>
              ) : filteredZones.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No zones in {selectedCity?.name}</div>
              ) : filteredZones.map(zone => (
                <div
                  key={zone.id}
                  className={`px-5 py-3 flex items-center justify-between cursor-pointer transition-colors ${zone.isActive === false ? 'opacity-60' : ''} ${selectedZoneId === zone.id ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : 'hover:bg-gray-50'}`}
                  onClick={() => setSelectedZoneId(zone.id)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate flex items-center gap-2">
                      {zone.name}
                      {zone.isActive === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">Inactive</span>}
                    </p>
                    <p className="text-xs text-gray-500">{wards.filter(w => w.zoneId === zone.id).length} wards</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleActive('zone', zone.id, zone.isActive !== false); }} className="p-1 hover:bg-gray-200 rounded" title={zone.isActive !== false ? 'Deactivate' : 'Activate'}>
                      {zone.isActive !== false ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openModal('zone', 'edit', zone); }} className="p-1 hover:bg-gray-200 rounded">
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDelete({ type: 'zone', id: zone.id, name: zone.name }); }} className="p-1 hover:bg-red-100 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Wards */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-purple-600" /> Wards
                {selectedZone && <span className="text-xs text-gray-400 font-normal ml-1">in {selectedZone.name}</span>}
              </h3>
              {selectedZoneId && (
                <button onClick={() => openModal('ward', 'add')} className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {!selectedZoneId ? (
                <div className="p-8 text-center text-gray-400 text-sm">Select a zone to view wards</div>
              ) : filteredWards.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No wards in {selectedZone?.name}</div>
              ) : filteredWards.map(ward => (
                <div key={ward.id} className={`px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors ${ward.isActive === false ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate flex items-center gap-2">
                      {ward.name}
                      {ward.isActive === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-semibold">Inactive</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive('ward', ward.id, ward.isActive !== false)} className="p-1 hover:bg-gray-200 rounded" title={ward.isActive !== false ? 'Deactivate' : 'Activate'}>
                      {ward.isActive !== false ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={() => openModal('ward', 'edit', ward)} className="p-1 hover:bg-gray-200 rounded">
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button onClick={() => setConfirmDelete({ type: 'ward', id: ward.id, name: ward.name })} className="p-1 hover:bg-red-100 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 capitalize">{modal.mode} {modal.type}</h3>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-gray-200 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 capitalize">{modal.type} Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder={`Enter ${modal.type} name`}
                  autoFocus
                />
              </div>
              {modal.type === 'city' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="Enter state name"
                  />
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {modal.mode === 'add' ? 'Add' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 bg-red-50 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-gray-900">Confirm Delete</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600">
                Are you sure you want to delete <strong>{confirmDelete.name}</strong>?
                {confirmDelete.type === 'city' && ' All zones and wards in this city will also be deleted.'}
                {confirmDelete.type === 'zone' && ' All wards in this zone will also be deleted.'}
              </p>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagementTab;
