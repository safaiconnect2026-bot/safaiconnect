import React, { useState, useEffect } from 'react';
import {
  Users, UserCheck, Phone, MapPin, Eye, X, Loader2, Edit, Search,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
  collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useCascadingLocation } from '../../../hooks/useCascadingLocation';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone?: string;
  assignedZone?: string;
  zoneId?: string;
  wardId?: string;
  cityId?: string;
  wardName?: string;
  workerType?: string;
  role: string;
  status?: string;
}

interface ZonalWorkersTabProps {
  zoneId: string;
  cityId?: string;
}

const ZonalWorkersTab: React.FC<ZonalWorkersTabProps> = ({ zoneId }) => {
  const { t } = useLanguage();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayAttendance, setTodayAttendance] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Detail modal
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerStats, setWorkerStats] = useState<{ assigned: number; completed: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Edit modal
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', workerType: '', zoneId: '', wardId: '', cityId: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const location = useCascadingLocation();

  // Fetch workers in this zone (real-time)
  useEffect(() => {
    if (!zoneId) return;
    const q = query(
      collection(db, 'users'),
      where('role', 'in', ['Worker', 'worker']),
      where('zoneId', '==', zoneId),
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Worker[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Worker));
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setWorkers(list);
      setLoading(false);
    });
    return () => unsub();
  }, [zoneId]);

  // Today's attendance
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set<string>();
      snap.forEach((d) => ids.add(d.data().workerId));
      setTodayAttendance(ids);
    });
    return () => unsub();
  }, []);

  const handleViewDetails = async (worker: Worker) => {
    setSelectedWorker(worker);
    setLoadingStats(true);
    try {
      const q = query(collection(db, 'assignments'), where('workerId', '==', worker.id));
      const snap = await getDocs(q);
      let assigned = 0;
      let completed = 0;
      snap.forEach((d) => {
        assigned++;
        if (d.data().workerStatus === 'COMPLETED' || d.data().workerStatus === 'VERIFIED') completed++;
      });
      setWorkerStats({ assigned, completed });
    } catch (e) {
      console.error('Failed to load worker stats:', e);
      setWorkerStats({ assigned: 0, completed: 0 });
    } finally { setLoadingStats(false); }
  };

  const handleEditWorker = (worker: Worker) => {
    setEditWorker(worker);
    setEditForm({
      name: worker.name || '',
      phone: worker.phone || '',
      workerType: worker.workerType || '',
      zoneId: worker.zoneId || '',
      wardId: worker.wardId || '',
      cityId: worker.cityId || '',
    });
    if (worker.cityId) location.setSelectedCityId(worker.cityId);
    if (worker.zoneId) location.setSelectedZoneId(worker.zoneId);
  };

  const handleSaveEdit = async () => {
    if (!editWorker) return;
    setSavingEdit(true);
    try {
      const selectedZone = location.zones.find((z) => z.id === (editForm.zoneId || location.selectedZoneId));
      const selectedWard = location.wards.find((w) => w.id === (editForm.wardId || location.selectedWardId));
      await updateDoc(doc(db, 'users', editWorker.id), {
        name: editForm.name,
        phone: editForm.phone,
        workerType: editForm.workerType,
        zoneId: editForm.zoneId || location.selectedZoneId || editWorker.zoneId,
        wardId: editForm.wardId || location.selectedWardId || editWorker.wardId,
        cityId: editForm.cityId || location.selectedCityId || editWorker.cityId,
        assignedZone: selectedZone?.name || editWorker.assignedZone,
        wardName: selectedWard?.name || editWorker.wardName,
        updatedAt: serverTimestamp(),
      });
      setEditWorker(null);
    } catch (e) {
      console.error('Failed to save worker:', e);
    } finally { setSavingEdit(false); }
  };

  const filteredWorkers = workers.filter((w) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.name?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q) ||
      w.phone?.toLowerCase().includes(q) ||
      w.wardName?.toLowerCase().includes(q)
    );
  });

  const activeCount = workers.filter((w) => todayAttendance.has(w.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('zone_workers') || 'Zone Workers'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('zone_workers_subtitle') || 'Workers assigned to your zone'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('total_workers') || 'Total Workers'} value={workers.length} icon={<Users className="w-6 h-6" />} color="blue" />
        <StatCard title={t('present_today') || 'Present Today'} value={activeCount} icon={<UserCheck className="w-6 h-6" />} color="green" />
        <StatCard title={t('absent') || 'Absent'} value={workers.length - activeCount} icon={<Users className="w-6 h-6" />} color="red" />
        <StatCard title={t('attendance_rate') || 'Attendance Rate'} value={workers.length ? `${Math.round((activeCount / workers.length) * 100)}%` : '0%'} icon={<UserCheck className="w-6 h-6" />} color="purple" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('search_workers') || 'Search workers...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
      </div>

      {/* Workers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Users className="w-12 h-12 mb-3 text-gray-300" />
            <p>{t('no_workers') || 'No workers found.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('worker') || 'Worker'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('ward') || 'Ward'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('type') || 'Type'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('contact') || 'Contact'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('attendance') || 'Today'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{worker.name}</div>
                      <div className="text-xs text-gray-500">{worker.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {worker.wardName || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{worker.workerType || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {worker.phone ? (
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {worker.phone}</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full ${todayAttendance.has(worker.id) ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {todayAttendance.has(worker.id) ? (t('present') || 'Present') : (t('absent') || 'Absent')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleViewDetails(worker)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditWorker(worker)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Worker Details Modal */}
      {selectedWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('worker_details') || 'Worker Details'}</h3>
              <button onClick={() => { setSelectedWorker(null); setWorkerStats(null); }} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">{t('name') || 'Name'}</div>
                <div className="text-gray-900 dark:text-white font-medium">{selectedWorker.name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">{t('email') || 'Email'}</div>
                <div className="text-gray-700 dark:text-gray-300">{selectedWorker.email}</div>
              </div>
              {selectedWorker.phone && (
                <div>
                  <div className="text-xs text-gray-500 uppercase font-semibold mb-1">{t('phone') || 'Phone'}</div>
                  <div className="text-gray-700 dark:text-gray-300">{selectedWorker.phone}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 uppercase font-semibold mb-1">{t('ward') || 'Ward'}</div>
                <div className="text-gray-700 dark:text-gray-300">{selectedWorker.wardName || '—'}</div>
              </div>
              {loadingStats ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-green-500" /></div>
              ) : workerStats && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                    <div className="text-2xl font-bold text-blue-600">{workerStats.assigned}</div>
                    <div className="text-xs text-blue-700 dark:text-blue-400">{t('assigned') || 'Assigned'}</div>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                    <div className="text-2xl font-bold text-green-600">{workerStats.completed}</div>
                    <div className="text-xs text-green-700 dark:text-green-400">{t('completed') || 'Completed'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {editWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('edit_worker') || 'Edit Worker'}</h3>
              <button onClick={() => setEditWorker(null)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('name') || 'Name'}</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('phone') || 'Phone'}</label>
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('worker_type') || 'Worker Type'}</label>
                <input value={editForm.workerType} onChange={(e) => setEditForm({ ...editForm, workerType: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
              </div>
              {/* Ward selection */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('ward') || 'Ward'}</label>
                <select
                  value={editForm.wardId || location.selectedWardId || ''}
                  onChange={(e) => { setEditForm({ ...editForm, wardId: e.target.value }); location.setSelectedWardId(e.target.value); }}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">{t('select_ward') || 'Select Ward'}</option>
                  {location.wards.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setEditWorker(null)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">
                {t('cancel') || 'Cancel'}
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('save') || 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZonalWorkersTab;
