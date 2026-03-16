import React, { useState, useEffect } from 'react';
import {
  ClipboardList, Users, CheckCircle, Clock,
  AlertTriangle, TrendingUp, ArrowRight,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
  collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useLanguage } from '../../../contexts/LanguageContext';

interface ZonalOverviewTabProps {
  zoneId: string;
  onNavigate: (tab: string) => void;
}

const ZonalOverviewTab: React.FC<ZonalOverviewTabProps> = ({ zoneId, onNavigate }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalWorkers: 0,
    activeWorkers: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    inProgress: 0,
    resolvedComplaints: 0,
    loading: true,
  });
  const [priorityActions, setPriorityActions] = useState<any[]>([]);

  useEffect(() => {
    if (!zoneId) return;

    // Workers in this zone
    const workersQ = query(
      collection(db, 'users'),
      where('role', 'in', ['Worker', 'worker']),
      where('zoneId', '==', zoneId),
    );

    const unsub1 = onSnapshot(workersQ, (snap) => {
      const workerIds: string[] = [];
      snap.forEach((d) => workerIds.push(d.id));
      setStats((prev) => ({
        ...prev,
        totalWorkers: snap.size,
        activeWorkers: snap.docs.filter((d) => d.data().status !== 'inactive').length,
      }));

      // Listen to assignments for these workers' complaints
      if (workerIds.length === 0) {
        setStats((prev) => ({
          ...prev,
          totalComplaints: 0,
          pendingComplaints: 0,
          inProgress: 0,
          resolvedComplaints: 0,
          loading: false,
        }));
        setPriorityActions([]);
        return;
      }

      // Assignments for zone workers
      const batchSize = 30; // Firestore 'in' limit
      const batches = [];
      for (let i = 0; i < workerIds.length; i += batchSize) {
        batches.push(workerIds.slice(i, i + batchSize));
      }

      // Also listen to all complaints to find un-assigned ones + zone-assigned ones
      const complaintsUnsub = onSnapshot(collection(db, 'complaints'), (cSnap) => {
        let total = 0;
        let pending = 0;
        let inProg = 0;
        let resolved = 0;
        const priority: any[] = [];

        cSnap.forEach((d) => {
          const data = d.data();
          // Include complaints assigned to zone workers OR with matching zoneId
          const isZoneComplaint =
            data.zoneId === zoneId ||
            data.assignedWorkerIds?.some((wid: string) => workerIds.includes(wid));

          if (!isZoneComplaint) return;

          total++;
          const status = (data.status || '').toUpperCase();
          if (status === 'SUBMITTED' || status === 'PENDING') pending++;
          else if (status === 'IN_PROGRESS' || status === 'ASSIGNED') inProg++;
          else if (status === 'RESOLVED' || status === 'COMPLETED') resolved++;

          if ((status === 'SUBMITTED' || status === 'PENDING') && priority.length < 5) {
            priority.push({ id: d.id, ...data });
          }
        });

        setStats((prev) => ({
          ...prev,
          totalComplaints: total,
          pendingComplaints: pending,
          inProgress: inProg,
          resolvedComplaints: resolved,
          loading: false,
        }));
        setPriorityActions(priority);
      });

      return () => complaintsUnsub();
    });

    return () => unsub1();
  }, [zoneId]);

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            {t('zonal_overview') || 'Zone Overview'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('zonal_overview_subtitle') || 'Key metrics for your zone'}
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />
          {t('system_live') || 'System Live'}
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<ClipboardList className="w-6 h-6" />} title={t('total_complaints') || 'Total Complaints'} value={stats.totalComplaints} color="blue" />
        <StatCard icon={<Clock className="w-6 h-6" />} title={t('pending') || 'Pending'} value={stats.pendingComplaints} color="yellow" />
        <StatCard icon={<TrendingUp className="w-6 h-6" />} title={t('in_progress') || 'In Progress'} value={stats.inProgress} color="purple" />
        <StatCard icon={<CheckCircle className="w-6 h-6" />} title={t('resolved') || 'Resolved'} value={stats.resolvedComplaints} color="green" />
      </div>

      {/* Two-column: Priority Actions + Zone Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('priority_actions') || 'Priority Actions'}
            </h3>
            <button onClick={() => onNavigate('complaints')} className="text-sm text-green-600 hover:underline flex items-center gap-1">
              {t('view_all') || 'View All'} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {priorityActions.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('no_priority_actions') || 'No pending complaints'}</p>
          ) : (
            <ul className="space-y-3">
              {priorityActions.map((c) => (
                <li key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white truncate">{c.title || c.description?.slice(0, 50)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.location || '—'}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Zone Vitals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5">
          <h3 className="font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            {t('zone_vitals') || 'Zone Vitals'}
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{t('workers') || 'Workers'}</span>
                <span className="font-medium text-gray-800 dark:text-white">{stats.activeWorkers}/{stats.totalWorkers}</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${stats.totalWorkers ? (stats.activeWorkers / stats.totalWorkers) * 100 : 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">{t('resolution_rate') || 'Resolution Rate'}</span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {stats.totalComplaints ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${stats.totalComplaints ? (stats.resolvedComplaints / stats.totalComplaints) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Quick Nav */}
          <div className="mt-6 grid grid-cols-2 gap-2">
            {[
              { tab: 'complaints', label: t('complaints') || 'Complaints', icon: <ClipboardList className="w-4 h-4" /> },
              { tab: 'workers', label: t('workers') || 'Workers', icon: <Users className="w-4 h-4" /> },
            ].map((n) => (
              <button key={n.tab} onClick={() => onNavigate(n.tab)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZonalOverviewTab;
