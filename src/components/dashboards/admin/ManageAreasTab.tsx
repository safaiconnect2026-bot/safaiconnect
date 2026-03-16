import React, { useState, useEffect } from 'react';
import {
  Plus, Edit, X, Loader2, ChevronRight,
  Map, LayoutGrid, CheckCircle,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  collection, onSnapshot, doc, setDoc, updateDoc, serverTimestamp,
  query, where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLanguage } from '../../../contexts/LanguageContext';

interface Zone { id: string; name: string; cityId: string; isActive?: boolean; }
interface Ward { id: string; name: string; zoneId: string; cityId: string; isActive?: boolean; }

interface ManageAreasTabProps {
  /** The cityId the admin is assigned to (optional — shows all cities if absent). */
  cityId?: string;
}

const ManageAreasTab: React.FC<ManageAreasTabProps> = ({ cityId }) => {
  const { t } = useLanguage();
  const [zones, setZones] = useState<Zone[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [modal, setModal] = useState<{
    type: 'zone' | 'ward';
    mode: 'add' | 'edit';
    data?: any;
  } | null>(null);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Live listeners
  useEffect(() => {
    const zoneQuery = cityId
      ? query(collection(db, 'zones'), where('cityId', '==', cityId))
      : collection(db, 'zones');

    const u1 = onSnapshot(zoneQuery, (snap) => {
      const list: Zone[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Zone));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setZones(list);
      setLoading(false);
    });

    const wardQuery = cityId
      ? query(collection(db, 'wards'), where('cityId', '==', cityId))
      : collection(db, 'wards');

    const u2 = onSnapshot(wardQuery, (snap) => {
      const list: Ward[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Ward));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setWards(list);
    });

    return () => { u1(); u2(); };
  }, [cityId]);

  const activeZones = zones.filter(z => z.isActive !== false);
  const inactiveZones = zones.filter(z => z.isActive === false);
  const filteredWards = selectedZoneId ? wards.filter(w => w.zoneId === selectedZoneId) : [];
  const selectedZone = zones.find(z => z.id === selectedZoneId);

  const openModal = (type: 'zone' | 'ward', mode: 'add' | 'edit', data?: any) => {
    setModal({ type, mode, data });
    setFormName(mode === 'edit' ? data?.name || '' : '');
  };

  const generateId = (prefix: string, name: string) =>
    `${prefix}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`;

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      if (modal?.type === 'zone') {
        if (modal.mode === 'add') {
          const id = generateId('zone', formName);
          await setDoc(doc(db, 'zones', id), {
            name: formName.trim(),
            cityId: cityId || '',
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'zones', modal.data.id), {
            name: formName.trim(),
            updatedAt: serverTimestamp(),
          });
        }
      } else if (modal?.type === 'ward') {
        if (modal.mode === 'add') {
          const id = generateId('ward', formName);
          await setDoc(doc(db, 'wards', id), {
            name: formName.trim(),
            zoneId: selectedZoneId,
            cityId: cityId || '',
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'wards', modal.data.id), {
            name: formName.trim(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      showToast(`${modal?.type === 'zone' ? 'Zone' : 'Ward'} ${modal?.mode === 'add' ? 'added' : 'updated'} successfully.`);
      setModal(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to save.', false);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (type: 'zone' | 'ward', id: string, currentlyActive: boolean) => {
    try {
      const col = type === 'zone' ? 'zones' : 'wards';
      await updateDoc(doc(db, col, id), { isActive: !currentlyActive, updatedAt: serverTimestamp() });
      // Deactivating a zone also deactivates its wards
      if (type === 'zone' && currentlyActive) {
        const childWards = wards.filter(w => w.zoneId === id);
        for (const w of childWards) {
          await updateDoc(doc(db, 'wards', w.id), { isActive: false, updatedAt: serverTimestamp() });
        }
      }
      showToast(`${type === 'zone' ? 'Zone' : 'Ward'} ${!currentlyActive ? 'activated' : 'deactivated'}.`);
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
        <h2 className="text-3xl font-bold text-gray-900 mb-1">{t('manage_areas') || 'Manage Areas'}</h2>
        <p className="text-gray-500">Add, edit, or deactivate zones and wards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <div className="rounded-2xl p-5 border bg-emerald-50 text-emerald-700 border-emerald-100 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><Map className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : activeZones.length}</div>
            <div className="text-sm font-medium opacity-80">Active Zones</div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-purple-50 text-purple-700 border-purple-100 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><LayoutGrid className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : wards.filter(w => w.isActive !== false).length}</div>
            <div className="text-sm font-medium opacity-80">Active Wards</div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-gray-50 text-gray-600 border-gray-200 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><Map className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : inactiveZones.length}</div>
            <div className="text-sm font-medium opacity-80">Inactive Zones</div>
          </div>
        </div>
        <div className="rounded-2xl p-5 border bg-gray-50 text-gray-600 border-gray-200 flex items-center gap-4">
          <div className="p-2 rounded-xl bg-white/60"><LayoutGrid className="w-5 h-5" /></div>
          <div>
            <div className="text-2xl font-bold">{loading ? '...' : wards.filter(w => w.isActive === false).length}</div>
            <div className="text-sm font-medium opacity-80">Inactive Wards</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Zones */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Map className="w-4 h-4 text-emerald-600" /> Zones
              </h3>
              <button onClick={() => openModal('zone', 'add')} className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {zones.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No zones found</div>
              ) : zones.map(zone => (
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
                    <p className="text-xs text-gray-500">{wards.filter(w => w.zoneId === zone.id && w.isActive !== false).length} active wards</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); toggleActive('zone', zone.id, zone.isActive !== false); }} className="p-1 hover:bg-gray-200 rounded" title={zone.isActive !== false ? 'Deactivate' : 'Activate'}>
                      {zone.isActive !== false ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openModal('zone', 'edit', zone); }} className="p-1 hover:bg-gray-200 rounded">
                      <Edit className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Wards */}
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
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
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
    </div>
  );
};

export default ManageAreasTab;
