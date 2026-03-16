import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Filter, MoreVertical, X, Eye, Ban,
  CheckCircle, Loader2, MapPin, Calendar, Mail, HardHat,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  assignedZone: string;
  workerType: string;
  designation: string;
  wardName: string;
  status: 'Active' | 'Inactive';
  createdAt: any;
}

const WorkerManagementTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const itemsPerPage = 10;

  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Worker[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          name: data.name || 'Unnamed Worker',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          assignedZone: data.assignedZone || '',
          workerType: data.workerType || '',
          designation: data.designation || '',
          wardName: data.wardName || '',
          status: data.status || 'Active',
          createdAt: data.createdAt,
        });
      });
      fetched.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setWorkers(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeActionMenu && !(event.target as Element).closest('.dropdown-container')) {
        setActiveActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeActionMenu]);

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.assignedZone.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'All' || w.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [workers, searchTerm, filterStatus]);

  const totalPages = Math.ceil(filteredWorkers.length / itemsPerPage);
  const currentData = filteredWorkers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeCount = workers.filter(w => w.status === 'Active').length;
  const inactiveCount = workers.filter(w => w.status === 'Inactive').length;

  const handleToggleStatus = async (worker: Worker) => {
    setActiveActionMenu(null);
    const newStatus: 'Active' | 'Inactive' = worker.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateDoc(doc(db, 'users', worker.id), { status: newStatus, updatedAt: serverTimestamp() });
      showToast(`${worker.name} marked as ${newStatus}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update status.', false);
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return 'N/A'; }
  };

  return (
    <div
      className="space-y-8 animate-in fade-in duration-500 min-h-[600px]"
      onClick={() => { setActiveActionMenu(null); setShowFilterMenu(false); }}
    >
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all duration-300 ${toast.ok ? 'bg-emerald-600' : 'bg-red-500'}`}>
          {toast.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Worker Management</h2>
        <p className="text-gray-500">View and manage all registered workers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          title="Total Workers"
          value={loading ? '...' : workers.length.toString()}
          icon={<Users className="w-6 h-6" />}
          trend={{ value: 'Live', isPositive: true }}
          color="purple"
        />
        <StatCard
          title="Active"
          value={loading ? '...' : activeCount.toString()}
          icon={<CheckCircle className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Inactive"
          value={loading ? '...' : inactiveCount.toString()}
          icon={<Ban className="w-6 h-6" />}
          color="red"
        />
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or zone..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all bg-white"
          />
        </div>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowFilterMenu(!showFilterMenu)}
            className="flex items-center gap-2 px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors bg-white"
          >
            <Filter className="w-4 h-4" />
            {filterStatus}
          </button>
          {showFilterMenu && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
              {['All', 'Active', 'Inactive'].map(s => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setShowFilterMenu(false); setCurrentPage(1); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${filterStatus === s ? 'text-emerald-600 font-semibold bg-emerald-50' : 'text-gray-700'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Registered Workers</h3>
          <span className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${filteredWorkers.length} worker${filteredWorkers.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : currentData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Users className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-xl font-bold text-gray-800">No Workers Found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchTerm ? 'Try a different search term.' : 'No workers have registered yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50/50">
                    <th className="px-6 py-3 font-semibold">Worker</th>
                    <th className="px-6 py-3 font-semibold">Zone</th>
                    <th className="px-6 py-3 font-semibold">Ward</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Joined</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentData.map((worker) => (
                    <tr key={worker.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                            {worker.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{worker.name}</p>
                            <p className="text-xs text-gray-500 truncate">{worker.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          {worker.assignedZone || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${worker.wardName ? 'text-gray-700' : 'text-gray-400'}`}>
                          {worker.wardName || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm ${worker.workerType ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                          {worker.workerType || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(worker.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${worker.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {worker.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block dropdown-container" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveActionMenu(activeActionMenu === worker.id ? null : worker.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {activeActionMenu === worker.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                              <button
                                onClick={() => { setSelectedWorker(worker); setActiveActionMenu(null); }}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              <button
                                onClick={() => handleToggleStatus(worker)}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              >
                                <Ban className="w-4 h-4" /> {worker.status === 'Active' ? 'Deactivate' : 'Activate'}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {currentData.map((worker) => (
                <div key={worker.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm flex-shrink-0">
                        {worker.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{worker.name}</p>
                        <p className="text-xs text-gray-500 truncate">{worker.email}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${worker.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {worker.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(worker.createdAt)}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {worker.assignedZone || '—'}</span>
                    {worker.workerType && <span className="ml-auto font-medium text-purple-600">{worker.workerType}</span>}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setSelectedWorker(worker)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleToggleStatus(worker)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      {worker.status === 'Active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedWorker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedWorker(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 bg-purple-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Worker Details</h3>
              <button onClick={() => setSelectedWorker(null)} className="p-1 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-2xl">
                  {selectedWorker.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{selectedWorker.name}</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selectedWorker.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedWorker.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">{selectedWorker.email}</span>
                </div>
                {selectedWorker.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-4 h-4 flex items-center justify-center text-xs">📞</span>
                    <span className="text-gray-600">{selectedWorker.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">{selectedWorker.assignedZone || 'No zone assigned'}</span>
                </div>
                {selectedWorker.wardName && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-4 h-4 flex items-center justify-center text-xs">📋</span>
                    <span className="text-gray-600">{selectedWorker.wardName}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <HardHat className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">{selectedWorker.workerType || 'No type assigned'}</span>
                </div>
                {selectedWorker.designation && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-4 h-4 flex items-center justify-center text-xs">🏷️</span>
                    <span className="text-gray-600">{selectedWorker.designation}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">Joined {formatDate(selectedWorker.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerManagementTab;
