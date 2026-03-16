import React, { useState, useEffect } from 'react';
import {
  Users, AlertTriangle, Activity, Loader2,
  CheckCircle, Clock, TrendingUp, UserCheck,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface OverviewTabProps {
  onNavigate: (tab: string) => void;
}

interface PriorityAction {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: any;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    totalComplaints:    0,
    pendingComplaints:  0,
    resolvedComplaints: 0,
    inProgress:         0,
    activeWorkers:      0,
    totalWorkers:       0,
    citizens:           0,
    loading:            true,
  });
  const [priorityActions, setPriorityActions] = useState<PriorityAction[]>([]);

  useEffect(() => {
    // ── 1. All complaints ──────────────────────────────────────────────────
    const unsubscribeComplaints = onSnapshot(query(collection(db, 'complaints')), (snapshot) => {
      const all = snapshot.docs;
      const data = all.map(d => d.data());
      const pending    = data.filter(d => ['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED'].includes(d.status)).length;
      const resolved   = data.filter(d => ['RESOLVED', 'CLOSED'].includes(d.status)).length;
      const inProgress = data.filter(d => d.status === 'IN_PROGRESS').length;

      setStats(prev => ({ ...prev, totalComplaints: all.length, pendingComplaints: pending, resolvedComplaints: resolved, inProgress }));

      const actions: PriorityAction[] = all
        .filter(d => d.data().status === 'SUBMITTED')
        .map(d => ({
          id: d.id,
          title: d.data().title || d.data().category || 'Complaint',
          category: d.data().category || 'General',
          status: d.data().status,
          createdAt: d.data().createdAt,
        }))
        .slice(0, 5);
      setPriorityActions(actions);
    });

    // ── 2. Workers count ───────────────────────────────────────────────────
    const unsubscribeWorkers = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker'])),
      (snapshot) => setStats(prev => ({ ...prev, totalWorkers: snapshot.docs.length, loading: false }))
    );

    // ── 2b. Active workers today (checked in) ──────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    const unsubscribeAttendance = onSnapshot(
      query(collection(db, 'attendance'), where('date', '==', today)),
      (snapshot) => {
        const activeCount = snapshot.docs.filter(d => d.data().checkIn && !d.data().checkOut).length;
        setStats(prev => ({ ...prev, activeWorkers: activeCount }));
      }
    );

    // ── 3. Citizens count ─────────────────────────────────────────────────
    const unsubscribeCitizens = onSnapshot(
      query(collection(db, 'users'), where('role', 'in', ['Citizen', 'citizen'])),
      (snapshot) => setStats(prev => ({ ...prev, citizens: snapshot.docs.length }))
    );

    return () => { unsubscribeComplaints(); unsubscribeWorkers(); unsubscribeAttendance(); unsubscribeCitizens(); };
  }, []);

  const resolutionRate = stats.totalComplaints > 0
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
    : 0;
  const pendingRate = stats.totalComplaints > 0
    ? Math.round((stats.pendingComplaints / stats.totalComplaints) * 100)
    : 0;

  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    try {
      const date = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
      if (isNaN(date.getTime())) return 'Just now';
      const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return 'Just now'; }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h2>
          <p className="text-gray-600">Real-time overview of system performance and key metrics</p>
        </div>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1 shadow-sm">
          <Activity className="w-4 h-4" /> System Live
        </span>
      </div>

      {/* ── 4-card metrics row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Complaints"
          value={stats.loading ? '...' : stats.totalComplaints.toString()}
          icon={<AlertTriangle className="w-6 h-6" />}
          trend={{ value: 'All time', isPositive: true }}
          color="blue"
        />
        <StatCard
          title="Pending Review"
          value={stats.loading ? '...' : stats.pendingComplaints.toString()}
          icon={<Clock className="w-6 h-6" />}
          trend={{ value: pendingRate > 0 ? `${pendingRate}% of total` : 'None pending', isPositive: pendingRate === 0 }}
          color="orange"
        />
        <StatCard
          title="Resolved"
          value={stats.loading ? '...' : stats.resolvedComplaints.toString()}
          icon={<CheckCircle className="w-6 h-6" />}
          trend={{ value: `${resolutionRate}% rate`, isPositive: resolutionRate >= 50 }}
          color="green"
        />
        <StatCard
          title="Active Workers"
          value={stats.loading ? '...' : stats.activeWorkers.toString()}
          icon={<Users className="w-6 h-6" />}
          trend={{ value: `${stats.totalWorkers} registered`, isPositive: stats.activeWorkers > 0 }}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Priority Actions ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">Priority Actions</h3>
              {priorityActions.length > 0 && (
                <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{priorityActions.length} new</span>
              )}
            </div>
            <button onClick={() => onNavigate('complaints')} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
              Manage All →
            </button>
          </div>
          <div className="divide-y divide-gray-100 min-h-[200px]">
            {stats.loading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
              </div>
            ) : priorityActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mb-3 text-green-200" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm mt-1">No new complaints awaiting review.</p>
              </div>
            ) : (
              priorityActions.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-sm text-gray-500">{getTimeAgo(item.createdAt)} · {item.category}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate('complaints')}
                    className="ml-3 flex-shrink-0 px-3 py-1.5 text-xs border border-emerald-100 bg-emerald-50 rounded-lg hover:bg-emerald-100 text-emerald-700 transition-colors font-semibold"
                  >
                    Review
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── City Vitals ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h3 className="text-lg font-semibold text-gray-900">City Vitals</h3>

          {/* Resolution Rate */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600 font-medium">Resolution Rate</span>
              <span className={`font-bold ${resolutionRate >= 70 ? 'text-green-600' : resolutionRate >= 40 ? 'text-yellow-600' : 'text-red-500'}`}>
                {stats.loading ? '—' : `${resolutionRate}%`}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${resolutionRate >= 70 ? 'bg-green-500' : resolutionRate >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
                style={{ width: `${stats.loading ? 0 : resolutionRate}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats.resolvedComplaints} of {stats.totalComplaints} complaints resolved</p>
          </div>

          {/* Pending Load */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600 font-medium">Pending Load</span>
              <span className={`font-bold ${pendingRate < 30 ? 'text-green-600' : pendingRate < 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                {stats.loading ? '—' : `${pendingRate}%`}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${pendingRate < 30 ? 'bg-green-500' : pendingRate < 60 ? 'bg-yellow-500' : 'bg-red-400'}`}
                style={{ width: `${stats.loading ? 0 : pendingRate}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{stats.pendingComplaints} awaiting action</p>
          </div>

          {/* In Progress */}
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-600 font-medium">In Progress</span>
              <span className="font-bold text-blue-600">{stats.loading ? '—' : stats.inProgress}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-700"
                style={{ width: `${stats.totalComplaints > 0 ? Math.round((stats.inProgress / stats.totalComplaints) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Workers currently on site</p>
          </div>

          {/* Quick Nav Pills */}
          <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
            {[
              { label: 'Workers', icon: <UserCheck className="w-3.5 h-3.5" />, tab: 'workers', val: stats.activeWorkers },
              { label: 'Citizens', icon: <Users className="w-3.5 h-3.5" />, tab: 'complaints', val: stats.citizens },
              { label: 'Verify', icon: <CheckCircle className="w-3.5 h-3.5" />, tab: 'verification', val: null },
              { label: 'Payroll', icon: <TrendingUp className="w-3.5 h-3.5" />, tab: 'salary', val: null },
            ].map(item => (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg text-xs font-medium transition-colors border border-gray-100 hover:border-emerald-200"
              >
                {item.icon}
                <span>{item.label}</span>
                {item.val !== null && item.val !== undefined && (
                  <span className="ml-auto font-bold text-gray-700">{item.val}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab;
