import React, { useState, useEffect } from 'react';
import {
  Users, UserCheck, CheckCircle, Loader2, MapPin,
  X, Mail, Phone, Award, ClipboardList, TrendingUp,
  UserPlus, Edit, Trash2, Info,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useCascadingLocation } from '../../../hooks/useCascadingLocation';

interface AttendanceStatus {
  checkIn?: string;
  checkOut?: string;
}

interface WorkerData {
  id: string;
  name: string;
  email: string;
  assignedZone?: string;
  status?: string;
  phone?: string;
  workerType?: string;
  designation?: string;
  createdAt?: any;
}

interface WorkerStats {
  totalAssigned: number;
  completed: number;
  inProgress: number;
}

const WorkersTab: React.FC = () => {
  const [workers, setWorkers] = useState<WorkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<WorkerData | null>(null);
  const [workerStats, setWorkerStats] = useState<WorkerStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [editWorker, setEditWorker] = useState<WorkerData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WorkerData | null>(null);
  const [showAddInfo, setShowAddInfo] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', assignedZone: '', workerType: '', phone: '', zoneId: '', wardId: '', cityId: '' });
  const location = useCascadingLocation();
  const [savingEdit, setSavingEdit] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    // Query for both capitalized and lowercase role values to catch all workers
    const q1 = query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']));
    const unsubscribe = onSnapshot(q1, (snapshot) => {
      const fetched: WorkerData[] = [];
      snapshot.forEach((docSnap) => {
        fetched.push({ id: docSnap.id, ...docSnap.data() } as WorkerData);
      });
      setWorkers(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for today's attendance
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const q = query(collection(db, 'attendance'), where('date', '==', today));
    const unsub = onSnapshot(q, (snapshot) => {
      const map: Record<string, AttendanceStatus> = {};
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.workerId) {
          map[data.workerId] = { checkIn: data.checkIn, checkOut: data.checkOut };
        }
      });
      setTodayAttendance(map);
    });
    return () => unsub();
  }, []);

  const openDetails = async (worker: WorkerData) => {
    setSelectedWorker(worker);
    setWorkerStats(null);
    setLoadingStats(true);
    try {
      const q = query(collection(db, 'assignments'), where('workerId', '==', worker.id));
      const snap = await getDocs(q);
      const all = snap.docs.map(d => d.data());
      setWorkerStats({
        totalAssigned: all.length,
        completed: all.filter(a => a.workerStatus === 'COMPLETED').length,
        inProgress: all.filter(a => a.workerStatus === 'IN_PROGRESS').length,
      });
    } catch {
      setWorkerStats({ totalAssigned: 0, completed: 0, inProgress: 0 });
    } finally {
      setLoadingStats(false);
    }
  };

  const uniqueZones = new Set(workers.map(w => w.assignedZone).filter(Boolean)).size;
  const activeNow = Object.values(todayAttendance).filter(a => a.checkIn && !a.checkOut).length;

  const handleEditWorker = (worker: WorkerData) => {
    const wd = worker as any;
    setEditForm({ name: worker.name, assignedZone: worker.assignedZone || '', workerType: worker.workerType || '', phone: worker.phone || '', zoneId: wd.zoneId || '', wardId: wd.wardId || '', cityId: wd.cityId || '' });
    // Pre-select cascading dropdowns if worker already has location IDs
    if (wd.cityId) location.setSelectedCityId(wd.cityId);
    if (wd.zoneId) setTimeout(() => location.setSelectedZoneId(wd.zoneId), 300);
    setEditWorker(worker);
  };

  const handleSaveEdit = async () => {
    if (!editWorker) return;
    setSavingEdit(true);
    try {
      // Build zone display name from selected zone
      const selectedZone = location.zones.find(z => z.id === location.selectedZoneId);
      const selectedWard = location.wards.find(w => w.id === location.selectedWardId);
      const zoneName = selectedZone ? selectedZone.name : editForm.assignedZone;
      await updateDoc(doc(db, 'users', editWorker.id), {
        name: editForm.name,
        assignedZone: zoneName,
        cityId: location.selectedCityId || '',
        zoneId: location.selectedZoneId || '',
        wardId: location.selectedWardId || '',
        wardName: selectedWard?.name || '',
        workerType: editForm.workerType,
        phone: editForm.phone,
        updatedAt: serverTimestamp(),
      });
      setEditWorker(null);
    } catch (err) {
      console.error('Error updating worker:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteWorker = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'users', confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing worker:', err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Worker Management</h2>
        <p className="text-gray-600">Monitor and manage the field workforce</p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowAddInfo(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
        >
          <UserPlus className="w-5 h-5" />
          Add Worker
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Workers"
          value={loading ? '...' : workers.length.toString()}
          icon={<Users className="w-6 h-6" />}
          trend={{ value: 'Live', isPositive: true }}
          color="blue"
        />
        <StatCard
          title="On Duty Now"
          value={loading ? '...' : activeNow.toString()}
          icon={<UserCheck className="w-6 h-6" />}
          trend={{ value: 'Checked in today', isPositive: activeNow > 0 }}
          color="green"
        />
        <StatCard
          title="Zones Covered"
          value={loading ? '...' : (uniqueZones > 0 ? uniqueZones.toString() : '—')}
          icon={<MapPin className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Status"
          value="Live"
          icon={<CheckCircle className="w-6 h-6" />}
          color="yellow"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Worker Roster</h3>
          <div className="text-sm text-gray-500">{workers.length} registered workers</div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <Users className="w-12 h-12 mb-3 text-gray-200" />
            <p>No workers have been registered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Worker</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {workers.map((worker) => (
                  <tr key={worker.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold border border-emerald-100 flex-shrink-0">
                          {worker.name?.charAt(0).toUpperCase() || 'W'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{worker.name || 'Unnamed Worker'}</p>
                          <p className="text-xs text-gray-400 font-mono">{worker.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {worker.assignedZone || <span className="text-gray-400">Unassigned</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {worker.workerType || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{worker.email}</div>
                      {worker.phone && <div className="text-xs text-gray-400">{worker.phone}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(() => {
                        const att = todayAttendance[worker.id];
                        if (att?.checkIn && !att?.checkOut) {
                          return (
                            <span className="inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-green-100 text-green-700 tracking-wider">
                              On Duty
                            </span>
                          );
                        } else if (att?.checkIn && att?.checkOut) {
                          return (
                            <span className="inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-700 tracking-wider">
                              Shift Done
                            </span>
                          );
                        } else {
                          return (
                            <span className="inline-flex px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-500 tracking-wider">
                              Off Duty
                            </span>
                          );
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditWorker(worker)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors p-1.5 hover:bg-blue-50 rounded-lg"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(worker)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDetails(worker)}
                          className="text-emerald-600 hover:text-emerald-900 text-sm font-semibold transition-colors hover:underline"
                        >
                          View Details
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

      {/* ── Worker Details Modal ─────────────────────────────────────────────── */}
      {selectedWorker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedWorker(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-t-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-2xl border-2 border-white/40">
                    {selectedWorker.name?.charAt(0).toUpperCase() || 'W'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedWorker.name || 'Unnamed Worker'}</h3>
                    <p className="text-emerald-100 text-sm">{selectedWorker.workerType || 'Field Worker'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedWorker(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Task Statistics */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Task Statistics
                </h4>
                {loadingStats ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  </div>
                ) : workerStats ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                        <p className="text-2xl font-black text-blue-700">{workerStats.totalAssigned}</p>
                        <p className="text-xs text-blue-600 font-medium mt-0.5">Total Tasks</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center border border-green-100">
                        <p className="text-2xl font-black text-green-700">{workerStats.completed}</p>
                        <p className="text-xs text-green-600 font-medium mt-0.5">Completed</p>
                      </div>
                      <div className="bg-yellow-50 rounded-xl p-3 text-center border border-yellow-100">
                        <p className="text-2xl font-black text-yellow-700">{workerStats.inProgress}</p>
                        <p className="text-xs text-yellow-600 font-medium mt-0.5">In Progress</p>
                      </div>
                    </div>
                    {workerStats.totalAssigned > 0 && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Completion Rate</span>
                          <span className="font-medium text-gray-700">
                            {Math.round((workerStats.completed / workerStats.totalAssigned) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full transition-all duration-700"
                            style={{ width: `${Math.round((workerStats.completed / workerStats.totalAssigned) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </div>

              {/* Profile Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Profile Information</h4>
                <div className="space-y-2">
                  {[
                    { icon: <Mail className="w-4 h-4" />, label: 'Email', value: selectedWorker.email },
                    { icon: <Phone className="w-4 h-4" />, label: 'Phone', value: selectedWorker.phone || 'Not provided' },
                    { icon: <MapPin className="w-4 h-4" />, label: 'Assigned Zone', value: selectedWorker.assignedZone || 'Not assigned' },
                    { icon: <Award className="w-4 h-4" />, label: 'Designation', value: selectedWorker.designation || 'Field Worker' },
                    { icon: <ClipboardList className="w-4 h-4" />, label: 'Worker Type', value: selectedWorker.workerType || 'Collector' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                      <div className="text-gray-400 flex-shrink-0">{row.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 font-medium">{row.label}</p>
                        <p className="text-sm font-medium text-gray-900 truncate">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Worker ID */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Worker UID</p>
                <p className="text-sm font-mono text-gray-600 break-all">{selectedWorker.id}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <button
                onClick={() => setSelectedWorker(null)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Worker Info Modal ────────────────────────────────────────── */}
      {showAddInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowAddInfo(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Add New Worker</h3>
              <button onClick={() => setShowAddInfo(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
                <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">How to onboard a new Worker</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-700">
                    <li>Have the worker create an account via the <strong>Sign Up</strong> page and select "Worker" as their role</li>
                    <li>Once registered, they will automatically appear here in the Worker Roster</li>
                    <li>You can then edit their zone assignment and worker type</li>
                    <li>Their attendance and tasks will be tracked from day one</li>
                  </ol>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setShowAddInfo(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors">Got it</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Worker Modal ───────────────────────────────────────────── */}
      {editWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setEditWorker(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Edit Worker — {editWorker.name}</h3>
              <button onClick={() => setEditWorker(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Full Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">City</label>
                <select value={location.selectedCityId} onChange={e => location.setSelectedCityId(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
                  <option value="">Select City</option>
                  {location.cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Zone</label>
                <select value={location.selectedZoneId} onChange={e => location.setSelectedZoneId(e.target.value)} disabled={!location.selectedCityId} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">Select Zone</option>
                  {location.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Ward</label>
                <select value={location.selectedWardId} onChange={e => location.setSelectedWardId(e.target.value)} disabled={!location.selectedZoneId} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">Select Ward</option>
                  {location.wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Worker Type</label>
                <select value={editForm.workerType} onChange={e => setEditForm(f => ({ ...f, workerType: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
                  <option value="">Select type</option>
                  {['Driver', 'Collector', 'Supervisor', 'Team Lead'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Phone</label>
                <input type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="+91 9000000000" />
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setEditWorker(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="px-6 py-2 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2">
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Worker Confirmation ──────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Remove Worker</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to remove <strong>{confirmDelete.name}</strong> from the system? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setConfirmDelete(null)} className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteWorker} className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkersTab;
