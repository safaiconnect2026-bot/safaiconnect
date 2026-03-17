import React, { useState, useEffect } from 'react';
import { Truck, Clock, CheckCircle, Loader2, MapPin, User, Calendar } from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
  collection, query, onSnapshot, orderBy, doc, updateDoc,
  serverTimestamp, getDocs, where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useToast } from '../../../contexts/ToastContext';

interface Booking {
  id: string;
  userId: string;
  type: 'immediate' | 'scheduled';
  address: string;
  wasteType: string;
  notes?: string;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: any;
  scheduledDate?: string;
  scheduledTime?: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
}

interface Worker {
  id: string;
  name: string;
  assignedZone?: string;
}

const CollectionBookingsTab: React.FC = () => {
  const { t } = useLanguage();
  const { success: toastSuccess, error: toastError } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, 'collection_bookings'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Booking[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Booking));
      setBookings(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']))).then((snap) => {
      const list: Worker[] = [];
      snap.forEach(d => list.push({ id: d.id, name: d.data().name, assignedZone: d.data().assignedZone }));
      setWorkers(list);
    });
  }, []);

  const handleAssign = async (bookingId: string) => {
    const workerId = selectedWorker[bookingId];
    if (!workerId) return;
    const worker = workers.find(w => w.id === workerId);
    setAssigningId(bookingId);
    try {
      await updateDoc(doc(db, 'collection_bookings', bookingId), {
        assignedWorkerId: workerId,
        assignedWorkerName: worker?.name || '',
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
      toastSuccess('Worker assigned successfully.');
    } catch {
      toastError('Failed to assign worker.');
    } finally {
      setAssigningId(null);
    }
  };

  const handleStatusUpdate = async (bookingId: string, status: 'in_progress' | 'completed') => {
    try {
      await updateDoc(doc(db, 'collection_bookings', bookingId), {
        status,
        updatedAt: serverTimestamp(),
      });
      toastSuccess('Status updated.');
    } catch {
      toastError('Failed to update status.');
    }
  };

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    try {
      const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  const pending = bookings.filter(b => b.status === 'pending').length;
  const inProgress = bookings.filter(b => b.status === 'in_progress').length;
  const completed = bookings.filter(b => b.status === 'completed').length;

  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('collection_bookings')}</h2>
        <p className="text-gray-600">{t('collection_bookings_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title={t('pending_bookings')}
          value={loading ? '...' : pending.toString()}
          icon={<Clock className="w-6 h-6" />}
          trend={{ value: t('action_required'), isPositive: false }}
          color="yellow"
        />
        <StatCard
          title={t('status_in_progress') || 'In Progress'}
          value={loading ? '...' : inProgress.toString()}
          icon={<Truck className="w-6 h-6" />}
          trend={{ value: 'Assigned to worker', isPositive: true }}
          color="blue"
        />
        <StatCard
          title={t('completed_bookings')}
          value={loading ? '...' : completed.toString()}
          icon={<CheckCircle className="w-6 h-6" />}
          trend={{ value: `${bookings.length} total`, isPositive: true }}
          color="green"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">{t('collection_requests')}</h3>
          <span className="text-sm text-gray-500">{bookings.length} total</span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-gray-400">
            <Truck className="w-12 h-12 mb-3 text-gray-200" />
            <p>{t('no_bookings_yet')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {bookings.map((booking) => (
              <div key={booking.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${statusColor[booking.status] || 'bg-gray-100 text-gray-700'}`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {booking.type === 'immediate' ? t('immediate') : t('scheduled')}
                      </span>
                      <span className="text-xs text-gray-400">{getTimeAgo(booking.createdAt)}</span>
                    </div>

                    <div className="flex items-start gap-1.5 mb-1">
                      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 line-clamp-2">{booking.address}</p>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
                      <span><span className="font-medium text-gray-600">{t('waste_type')}:</span> {booking.wasteType}</span>
                      {booking.scheduledDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(booking.scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {booking.scheduledTime && ` at ${booking.scheduledTime}`}
                        </span>
                      )}
                      {booking.assignedWorkerName && (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <User className="w-3.5 h-3.5" />
                          {booking.assignedWorkerName}
                        </span>
                      )}
                    </div>

                    {booking.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{booking.notes}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {booking.status === 'pending' && (
                      <div className="flex gap-2">
                        <select
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-300"
                          value={selectedWorker[booking.id] || ''}
                          onChange={e => setSelectedWorker(prev => ({ ...prev, [booking.id]: e.target.value }))}
                        >
                          <option value="">{t('assign_worker')}…</option>
                          {workers.map(w => (
                            <option key={w.id} value={w.id}>{w.name}{w.assignedZone ? ` (${w.assignedZone})` : ''}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAssign(booking.id)}
                          disabled={!selectedWorker[booking.id] || assigningId === booking.id}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                        >
                          {assigningId === booking.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                          {t('assign_worker')}
                        </button>
                      </div>
                    )}

                    {booking.status === 'in_progress' && (
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'completed')}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        {t('mark_completed')}
                      </button>
                    )}

                    {booking.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(booking.id, 'in_progress')}
                        className="px-3 py-1.5 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        {t('mark_in_progress')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionBookingsTab;
