import React, { useEffect, useState } from 'react';
import { AlertTriangle, Users, Shield, Activity, Loader2, CheckCircle, Clock } from 'lucide-react';
import StatCard from '../../common/StatCard';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAuth } from '../../../contexts/AuthContext';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface SystemStats {
    totalComplaints: number;
    resolvedComplaints: number;
    pendingComplaints: number;
    assignedComplaints: number;
    totalWorkers: number;
    totalAdmins: number;
    totalCitizens: number;
    avgRatingPct: number;
    totalRatings: number;
    loading: boolean;
}

const OverviewTab: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
    const { t } = useLanguage();
    const [stats, setStats] = useState<SystemStats>({
        totalComplaints: 0,
        resolvedComplaints: 0,
        pendingComplaints: 0,
        assignedComplaints: 0,
        totalWorkers: 0,
        totalAdmins: 0,
        totalCitizens: 0,
        avgRatingPct: 0,
        totalRatings: 0,
        loading: true,
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);

    const { currentUser } = useAuth();
    const [seeding, setSeeding] = useState(false);
    const [seedDone, setSeedDone] = useState(false);
    const [seedError, setSeedError] = useState<string | null>(null);

    // Display-only list — real seeding is done via `npx tsx scripts/seed-demo.ts`
    const DEMO_USERS = [
        { email: 'superadmin@demo.com',  name: 'Super Admin',    role: 'Superadmin'     },
        { email: 'admin@demo.com',        name: 'Admin Demo',     role: 'Admin'          },
        { email: 'worker@demo.com',       name: 'Worker Demo',    role: 'Worker'         },
        { email: 'citizen@demo.com',      name: 'Citizen Demo',   role: 'Citizen'        },
        { email: 'champion@demo.com',     name: 'Champion Demo',  role: 'Green-Champion' },
    ];

    const SEED_COMPLAINTS = [
        { title: 'Overflowing garbage bin near market', category: 'Waste Management', location: 'MG Road, Zone A', status: 'SUBMITTED', lat: 28.6139, lng: 77.2090 },
        { title: 'Pothole causing accidents on road', category: 'Road Damage', location: 'NH-44, Zone B', status: 'UNDER_REVIEW', lat: 28.6200, lng: 77.2150 },
        { title: 'Street light out for 3 days', category: 'Street Lighting', location: 'Sector 15, Zone C', status: 'ASSIGNED', lat: 28.6050, lng: 77.2200 },
        { title: 'Blocked drainage causing flooding', category: 'Drainage/Sewage', location: 'Ring Road, Zone D', status: 'SUBMITTED', lat: 28.6300, lng: 77.2300 },
        { title: 'Broken water pipe on main street', category: 'Water Supply', location: 'Civil Lines, Zone A', status: 'RESOLVED', lat: 28.6100, lng: 77.2050 },
    ];

    const SEED_INVENTORY = [
        { name: 'Garbage Collection Trucks', quantity: 12, unit: 'vehicles', zone: 'All Zones' },
        { name: 'Safety Gloves (pairs)', quantity: 500, unit: 'pairs', zone: 'All Zones' },
        { name: 'High-Visibility Vests', quantity: 200, unit: 'pieces', zone: 'All Zones' },
    ];

    const handleSeedData = async () => {
        if (!currentUser) {
            setSeedError('You must be logged in to seed data.');
            return;
        }
        setSeeding(true);
        setSeedError(null);
        try {
            for (const c of SEED_COMPLAINTS) {
                await addDoc(collection(db, 'complaints'), {
                    ...c,
                    citizenId: currentUser.uid,
                    citizenName: currentUser.displayName || 'Demo User',
                    description: `Demo complaint: ${c.title}`,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }
            for (const item of SEED_INVENTORY) {
                await addDoc(collection(db, 'inventory'), {
                    ...item,
                    lastUpdated: serverTimestamp(),
                });
            }
            setSeedDone(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setSeedError(`Seed failed: ${msg}`);
            console.error('Seed failed:', err);
        } finally {
            setSeeding(false);
        }
    };

    useEffect(() => {
        const complaintsUnsub = onSnapshot(collection(db, 'complaints'), (snap) => {
            const all = snap.docs;
            const resolved = all.filter(d => d.data().status === 'RESOLVED').length;
            const pending = all.filter(d => ['SUBMITTED', 'UNDER_REVIEW'].includes(d.data().status)).length;
            const assigned = all.filter(d => d.data().status === 'ASSIGNED').length;
            const recent = [...all]
                .sort((a, b) => {
                    const ta = a.data().createdAt?.toMillis?.() || 0;
                    const tb = b.data().createdAt?.toMillis?.() || 0;
                    return tb - ta;
                })
                .slice(0, 5)
                .map(d => ({ id: d.id, ...d.data() }));
            setStats(prev => ({ ...prev, totalComplaints: all.length, resolvedComplaints: resolved, pendingComplaints: pending, assignedComplaints: assigned }));
            setRecentActivity(recent);
        });

        const ratingsUnsub = onSnapshot(collection(db, 'ratings'), (snap) => {
            const values = snap.docs
                .map(d => Number(d.data().rating))
                .filter(r => r >= 1 && r <= 5);
            const avg = values.length > 0
                ? values.reduce((a, b) => a + b, 0) / values.length
                : 0;
            setStats(prev => ({
                ...prev,
                avgRatingPct: Math.round((avg / 5) * 100),
                totalRatings: values.length,
            }));
        });

        const workersUnsub = onSnapshot(
            query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker'])),
            (snap) => setStats(prev => ({ ...prev, totalWorkers: snap.docs.length }))
        );

        const adminsUnsub = onSnapshot(
            query(collection(db, 'users'), where('role', 'in', ['Admin', 'admin'])),
            (snap) => setStats(prev => ({ ...prev, totalAdmins: snap.docs.length }))
        );

        const citizensUnsub = onSnapshot(
            query(collection(db, 'users'), where('role', 'in', ['Citizen', 'citizen'])),
            (snap) => setStats(prev => ({ ...prev, totalCitizens: snap.docs.length, loading: false }))
        );

        return () => { complaintsUnsub(); workersUnsub(); adminsUnsub(); citizensUnsub(); ratingsUnsub(); };
    }, []);

    const resolutionRate = stats.totalComplaints > 0
        ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
        : 0;

    // Worker efficiency: % of worker-touched complaints (assigned or resolved) that got resolved
    const workerTouched = stats.resolvedComplaints + stats.assignedComplaints;
    const workerEfficiency = workerTouched > 0
        ? Math.round((stats.resolvedComplaints / workerTouched) * 100)
        : 0;

    // Citizen satisfaction: avg rating converted to percentage (1–5 → 0–100%)
    const citizenSatisfaction = stats.avgRatingPct;

    const getTimeAgo = (ts: any) => {
        if (!ts) return 'Just now';
        try {
            const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
            const sec = Math.floor((Date.now() - d.getTime()) / 1000);
            if (sec < 60) return 'Just now';
            const min = Math.floor(sec / 60);
            if (min < 60) return `${min}m ago`;
            const hr = Math.floor(min / 60);
            return hr < 24 ? `${hr}h ago` : d.toLocaleDateString();
        } catch { return 'Recently'; }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-1">{t('system_overview')}</h2>
                    <p className="text-gray-500">{t('real_time_analytics')}</p>
                </div>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-semibold border border-emerald-100 w-fit">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                </span>
            </div>

            {/* Primary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <StatCard
                    title={t('total_complaints')}
                    value={stats.loading ? '...' : stats.totalComplaints.toString()}
                    icon={<AlertTriangle className="w-6 h-6" />}
                    trend={{ value: 'Live', isPositive: true }}
                    color="blue"
                />
                <StatCard
                    title={t('resolved_complaints')}
                    value={stats.loading ? '...' : stats.resolvedComplaints.toString()}
                    icon={<CheckCircle className="w-6 h-6" />}
                    trend={{ value: `${resolutionRate}% rate`, isPositive: true }}
                    color="green"
                />
                <StatCard
                    title={t('active_workers')}
                    value={stats.loading ? '...' : stats.totalWorkers.toString()}
                    icon={<Users className="w-6 h-6" />}
                    trend={{ value: 'On Field', isPositive: true }}
                    color="purple"
                />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Admins', value: stats.totalAdmins, icon: Shield, cls: 'bg-amber-50 text-amber-700 border-amber-100', tab: 'admins' },
                    { label: 'Total Workers', value: stats.totalWorkers, icon: Users, cls: 'bg-purple-50 text-purple-700 border-purple-100', tab: 'workers' },
                    { label: 'Pending Complaints', value: stats.pendingComplaints, icon: Clock, cls: 'bg-red-50 text-red-700 border-red-100', tab: '' },
                    { label: 'Registered Citizens', value: stats.totalCitizens, icon: Users, cls: 'bg-cyan-50 text-cyan-700 border-cyan-100', tab: 'citizens' },
                ].map((c, i) => (
                    <div
                        key={i}
                        className={`rounded-2xl p-5 border flex items-center gap-4 ${c.cls} ${c.tab && onNavigate ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                        onClick={() => c.tab && onNavigate?.(c.tab)}
                    >
                        <div className="p-2 rounded-xl bg-white/60 flex-shrink-0">
                            <c.icon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">{stats.loading ? '...' : c.value}</div>
                            <div className="text-sm font-medium opacity-80">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">Recent Complaints</h3>
                        <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="divide-y divide-gray-50 min-h-[200px]">
                        {stats.loading ? (
                            <div className="flex justify-center items-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                            </div>
                        ) : recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                <CheckCircle className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm">No complaints yet</p>
                            </div>
                        ) : recentActivity.map((item, i) => (
                            <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'RESOLVED' ? 'bg-green-500' : item.status === 'ASSIGNED' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{item.title || item.category || 'Complaint'}</p>
                                        <p className="text-xs text-gray-400">{getTimeAgo(item.createdAt)}</p>
                                    </div>
                                </div>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ml-2 ${item.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : item.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {item.status}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Performance + Score */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4">{t('city_wide_performance')}</h3>
                        <div className="space-y-4">
                            {[
                                { label: t('resolution_rate') || 'Resolution Rate', val: resolutionRate, color: 'bg-green-500', textColor: 'text-green-600', sub: '' },
                                { label: t('worker_efficiency') || 'Worker Efficiency', val: workerEfficiency, color: 'bg-blue-500', textColor: 'text-blue-600', sub: workerTouched > 0 ? `${stats.resolvedComplaints}/${workerTouched} resolved` : 'No data yet' },
                                { label: t('citizen_satisfaction') || 'Citizen Satisfaction', val: citizenSatisfaction, color: 'bg-purple-500', textColor: 'text-purple-600', sub: stats.totalRatings > 0 ? `${stats.totalRatings} ratings` : 'No ratings yet' },
                            ].map((r) => (
                                <div key={r.label}>
                                    <div className="flex justify-between text-sm mb-1.5">
                                        <div>
                                            <span className="text-gray-600">{r.label}</span>
                                            {r.sub && <span className="ml-2 text-xs text-gray-400">({r.sub})</span>}
                                        </div>
                                        <span className={`font-semibold ${r.textColor}`}>{stats.loading ? '...' : `${r.val}%`}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.val}%`, transition: 'width 1s ease' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-lg mb-1">{t('municipal_score')}</h3>
                                <p className="text-emerald-100 text-sm">{t('overall_rating')}</p>
                            </div>
                            <div className="text-center bg-white/10 px-5 py-3 rounded-xl">
                                <div className="text-4xl font-black">
                                    {stats.loading ? '...' : resolutionRate > 0 ? (resolutionRate / 10).toFixed(1) : '—'}
                                    <span className="text-lg text-emerald-200">/10</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Demo Data Seeder ───────────────────────────────────────────── */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-amber-900 mb-1">🌱 Demo Data Seeder</h3>
                        <p className="text-sm text-amber-700">
                            Populate Firestore with 5 sample complaints and 3 inventory items so dashboards show real data.
                        </p>
                        {seedDone && (
                            <p className="mt-1 text-sm font-semibold text-green-700">✓ 5 complaints + 3 inventory items created!</p>
                        )}
                        {seedError && (
                            <p className="mt-1 text-sm text-red-600">{seedError}</p>
                        )}
                    </div>
                    <button
                        onClick={handleSeedData}
                        disabled={seeding || seedDone}
                        className="flex-shrink-0 px-5 py-2.5 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {seeding ? (
                            <>
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Seeding...
                            </>
                        ) : seedDone ? '✓ Done' : 'Seed Demo Data'}
                    </button>
                </div>
            </div>

            {/* ── Demo Users Info ────────────────────────────────────────────── */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-1">👥 Demo Accounts</h3>
                <p className="text-sm text-blue-700 mb-3">
                    Run <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">npx tsx scripts/seed-demo.ts</code> to create all demo accounts. Password: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-xs">Demo1234!</code>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs text-blue-600 font-mono">
                    {DEMO_USERS.map(u => (
                        <span key={u.email} className="bg-blue-100 px-2 py-0.5 rounded truncate">
                            {u.role}: {u.email}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
