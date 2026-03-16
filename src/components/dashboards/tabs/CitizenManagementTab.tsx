import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Search, Filter, MoreVertical, X, Eye, Ban,
  CheckCircle, Loader2, MapPin, Calendar, Mail,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface Citizen {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  assignedZone: string;
  status: 'Active' | 'Inactive';
  rewardPoints: number;
  createdAt: any;
  citizenID: string;
}

const CitizenManagementTab: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const itemsPerPage = 10;

  const [citizens, setCitizens] = useState<Citizen[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['Citizen', 'citizen']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Citizen[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          name: data.name || 'Unnamed Citizen',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          assignedZone: data.assignedZone || '',
          status: data.status || 'Active',
          rewardPoints: data.rewardPoints || 0,
          createdAt: data.createdAt,
          citizenID: data.citizenID || '',
        });
      });
      // Sort newest first
      fetched.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setCitizens(fetched);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeActionMenu && !(event.target as Element).closest('.dropdown-container')) {
        setActiveActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeActionMenu]);

  const filteredCitizens = useMemo(() => {
    return citizens.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.citizenID.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'All' || c.status === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [citizens, searchTerm, filterStatus]);

  const totalPages = Math.ceil(filteredCitizens.length / itemsPerPage);
  const currentData = filteredCitizens.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const activeCount = citizens.filter(c => c.status === 'Active').length;
  const inactiveCount = citizens.filter(c => c.status === 'Inactive').length;

  const handleToggleStatus = async (citizen: Citizen) => {
    setActiveActionMenu(null);
    const newStatus: 'Active' | 'Inactive' = citizen.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateDoc(doc(db, 'users', citizen.id), { status: newStatus, updatedAt: serverTimestamp() });
      showToast(`${citizen.name} marked as ${newStatus}.`);
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
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Citizen Management</h2>
        <p className="text-gray-500">View and manage all registered citizens</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          title="Total Citizens"
          value={loading ? '...' : citizens.length.toString()}
          icon={<Users className="w-6 h-6" />}
          trend={{ value: 'Live', isPositive: true }}
          color="blue"
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
            placeholder="Search by name, email, or citizen ID..."
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

      {/* Citizens Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Registered Citizens</h3>
          <span className="text-sm text-gray-500">
            {loading ? 'Loading...' : `${filteredCitizens.length} citizen${filteredCitizens.length !== 1 ? 's' : ''}`}
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
            <p className="text-xl font-bold text-gray-800">No Citizens Found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchTerm ? 'Try a different search term.' : 'No citizens have registered yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50/50">
                    <th className="px-6 py-3 font-semibold">Citizen</th>
                    <th className="px-6 py-3 font-semibold">Citizen ID</th>
                    <th className="px-6 py-3 font-semibold">Zone</th>
                    <th className="px-6 py-3 font-semibold">Reward Pts</th>
                    <th className="px-6 py-3 font-semibold">Joined</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentData.map((citizen) => (
                    <tr key={citizen.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                            {citizen.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{citizen.name}</p>
                            <p className="text-xs text-gray-500 truncate">{citizen.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{citizen.citizenID || '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{citizen.assignedZone || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${citizen.rewardPoints > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {citizen.rewardPoints}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(citizen.createdAt)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${citizen.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {citizen.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block dropdown-container" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setActiveActionMenu(activeActionMenu === citizen.id ? null : citizen.id)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {activeActionMenu === citizen.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
                              <button
                                onClick={() => { setSelectedCitizen(citizen); setActiveActionMenu(null); }}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              >
                                <Eye className="w-4 h-4" /> View Details
                              </button>
                              <button
                                onClick={() => handleToggleStatus(citizen)}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                              >
                                <Ban className="w-4 h-4" /> {citizen.status === 'Active' ? 'Deactivate' : 'Activate'}
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
              {currentData.map((citizen) => (
                <div key={citizen.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm flex-shrink-0">
                        {citizen.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{citizen.name}</p>
                        <p className="text-xs text-gray-500 truncate">{citizen.email}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${citizen.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {citizen.status}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(citizen.createdAt)}</span>
                    <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{citizen.citizenID || '—'}</span>
                    <span className="ml-auto font-bold text-amber-600">{citizen.rewardPoints} pts</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => setSelectedCitizen(citizen)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleToggleStatus(citizen)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      {citizen.status === 'Active' ? 'Deactivate' : 'Activate'}
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
      {selectedCitizen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedCitizen(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 bg-emerald-50/50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Citizen Details</h3>
              <button onClick={() => setSelectedCitizen(null)} className="p-1 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-2xl">
                  {selectedCitizen.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{selectedCitizen.name}</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selectedCitizen.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {selectedCitizen.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">{selectedCitizen.email}</span>
                </div>
                {selectedCitizen.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400 flex-shrink-0 w-4 h-4 flex items-center justify-center text-xs">📞</span>
                    <span className="text-gray-600">{selectedCitizen.phone}</span>
                  </div>
                )}
                {selectedCitizen.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">{selectedCitizen.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">Joined {formatDate(selectedCitizen.createdAt)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                  <p className="text-2xl font-bold text-amber-700">{selectedCitizen.rewardPoints}</p>
                  <p className="text-xs text-amber-600 font-medium">Reward Points</p>
                </div>
                <div className="bg-cyan-50 rounded-xl p-3 text-center border border-cyan-100">
                  <p className="text-sm font-bold text-cyan-700 font-mono">{selectedCitizen.citizenID || '—'}</p>
                  <p className="text-xs text-cyan-600 font-medium">Citizen ID</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { handleToggleStatus(selectedCitizen); setSelectedCitizen(null); }}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm ${selectedCitizen.status === 'Active' ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'}`}
                >
                  {selectedCitizen.status === 'Active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setSelectedCitizen(null)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CitizenManagementTab;
