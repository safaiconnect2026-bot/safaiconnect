import React, { useEffect, useState, useMemo } from 'react';
import {
    FileText,
    Download,
    Calendar,
    BarChart3,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Clock,
    MapPin,
    ChevronDown,
    Loader2
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { useLanguage } from '../../../contexts/LanguageContext';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface Complaint {
    id: string;
    status: string;
    priority: string;
    category: string;
    zone?: string;
    area?: string;
    createdAt?: any;
    resolvedAt?: any;
    description?: string;
    location?: string;
}

interface ZoneStat {
    zone: string;
    total: number;
    resolved: number;
    pending: number;
    rate: string;
}

interface DayStat {
    label: string;
    count: number;
}

interface CategoryStat {
    name: string;
    count: number;
}

// SVG bar chart (vertical)
const BarChart: React.FC<{ data: DayStat[]; maxVal: number }> = ({ data, maxVal }) => {
    const chartH = 150;
    const barW = 30;
    const gap = 14;
    const chartW = data.length * (barW + gap) - gap;
    const colors = ['#10b981', '#059669', '#047857', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'];

    return (
        <svg viewBox={`0 0 ${chartW + 10} ${chartH + 38}`} className="w-full" style={{ maxHeight: 220 }}>
            {data.map((d, i) => {
                const barH = maxVal > 0 ? Math.max((d.count / maxVal) * chartH, d.count > 0 ? 6 : 0) : 0;
                const x = i * (barW + gap);
                const y = chartH - barH;
                return (
                    <g key={i}>
                        <rect
                            x={x}
                            y={y}
                            width={barW}
                            height={barH || 2}
                            rx={4}
                            fill={d.count > 0 ? colors[i % colors.length] : '#e5e7eb'}
                            opacity={0.9}
                        />
                        <text x={x + barW / 2} y={chartH + 15} textAnchor="middle" fontSize={10} fill="#6b7280">{d.label}</text>
                        {d.count > 0 && (
                            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="600">{d.count}</text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};

// Horizontal bar chart for categories
const HBarChart: React.FC<{ data: CategoryStat[]; maxVal: number }> = ({ data, maxVal }) => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
    return (
        <div className="space-y-3">
            {data.slice(0, 7).map((d, i) => {
                const pct = maxVal > 0 ? (d.count / maxVal) * 100 : 0;
                return (
                    <div key={i} className="flex items-center gap-3">
                        <div className="w-28 text-xs text-gray-600 truncate text-right shrink-0">{d.name}</div>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                            <div
                                className="h-4 rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
                            />
                        </div>
                        <div className="w-8 text-xs font-semibold text-gray-700 text-right shrink-0">{d.count}</div>
                    </div>
                );
            })}
        </div>
    );
};

const PERIODS = [
    { label: 'This Week', days: 7 },
    { label: 'This Month', days: 30 },
    { label: 'Last 3 Months', days: 90 },
];

const ReportsTab: React.FC = () => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [periodIdx, setPeriodIdx] = useState(1);
    const [showPeriodMenu, setShowPeriodMenu] = useState(false);

    useEffect(() => {
        // Try ordered query first; fall back if composite index missing
        let unsubscribe: () => void;
        try {
            const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
            unsubscribe = onSnapshot(q, (snapshot) => {
                setComplaints(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Complaint)));
                setLoading(false);
            }, () => {
                // fallback: unordered
                const q2 = query(collection(db, 'complaints'));
                unsubscribe = onSnapshot(q2, (snap2) => {
                    setComplaints(snap2.docs.map(d => ({ id: d.id, ...d.data() } as Complaint)));
                    setLoading(false);
                });
            });
        } catch {
            const q2 = query(collection(db, 'complaints'));
            unsubscribe = onSnapshot(q2, (snap2) => {
                setComplaints(snap2.docs.map(d => ({ id: d.id, ...d.data() } as Complaint)));
                setLoading(false);
            });
        }
        return () => unsubscribe && unsubscribe();
    }, []);

    const selectedPeriod = PERIODS[periodIdx];

    // Filter to selected period
    const periodComplaints = useMemo(() => {
        const cutoff = Date.now() - selectedPeriod.days * 86400_000;
        return complaints.filter(c => {
            const ts = c.createdAt;
            if (!ts) return true;
            try {
                const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime();
                return ms >= cutoff;
            } catch { return true; }
        });
    }, [complaints, periodIdx]);

    // Key stats
    const stats = useMemo(() => {
        const total = periodComplaints.length;
        const resolved = periodComplaints.filter(c => c.status === 'RESOLVED').length;
        const critical = periodComplaints.filter(c =>
            ['HIGH', 'URGENT', 'CRITICAL'].includes(c.priority)
        ).length;
        const rate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0%';

        const withTime = periodComplaints.filter(c => c.resolvedAt && c.createdAt);
        let avgHours: string | null = null;
        if (withTime.length > 0) {
            const totalMs = withTime.reduce((sum, c) => {
                try {
                    const cr = typeof c.createdAt.toMillis === 'function' ? c.createdAt.toMillis() : new Date(c.createdAt).getTime();
                    const re = typeof c.resolvedAt.toMillis === 'function' ? c.resolvedAt.toMillis() : new Date(c.resolvedAt).getTime();
                    return sum + (re - cr);
                } catch { return sum; }
            }, 0);
            const h = Math.round(totalMs / withTime.length / 3_600_000);
            avgHours = h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
        }
        return { total, resolved, critical, rate, avgHours };
    }, [periodComplaints]);

    // Zone analytics
    const zoneStats: ZoneStat[] = useMemo(() => {
        const map: Record<string, ZoneStat> = {};
        periodComplaints.forEach(c => {
            const zone = c.zone || c.area || 'Unassigned';
            if (!map[zone]) map[zone] = { zone, total: 0, resolved: 0, pending: 0, rate: '0%' };
            map[zone].total++;
            if (c.status === 'RESOLVED') map[zone].resolved++;
            else map[zone].pending++;
        });
        return Object.values(map)
            .map(z => ({ ...z, rate: z.total > 0 ? ((z.resolved / z.total) * 100).toFixed(0) + '%' : '0%' }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [periodComplaints]);

    // Weekly volume (last 7 days)
    const weeklyData: DayStat[] = useMemo(() => {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const days: DayStat[] = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return { label: dayNames[d.getDay()], count: 0 };
        });
        complaints.forEach(c => {
            const ts = c.createdAt;
            if (!ts) return;
            try {
                const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : new Date(ts).getTime();
                const diffDays = Math.floor((Date.now() - ms) / 86400_000);
                if (diffDays >= 0 && diffDays < 7) days[6 - diffDays].count++;
            } catch { /* skip */ }
        });
        return days;
    }, [complaints]);

    const weeklyMax = Math.max(...weeklyData.map(d => d.count), 1);

    // Category breakdown
    const categoryData: CategoryStat[] = useMemo(() => {
        const map: Record<string, number> = {};
        periodComplaints.forEach(c => { const cat = c.category || 'Other'; map[cat] = (map[cat] || 0) + 1; });
        return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [periodComplaints]);

    const categoryMax = Math.max(...categoryData.map(d => d.count), 1);

    // CSV Export
    const handleExportCSV = () => {
        const headers = ['ID', 'Status', 'Priority', 'Category', 'Zone/Area', 'Description', 'Location', 'Created At', 'Resolved At'];
        const esc = (v: any) => {
            const s = String(v ?? '').replace(/"/g, '""');
            return /[,"\n]/.test(s) ? `"${s}"` : s;
        };
        const getDate = (ts: any) => {
            if (!ts) return '';
            try { return (typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)).toISOString(); } catch { return ''; }
        };
        const rows = periodComplaints.map(c => [
            esc(c.id), esc(c.status), esc(c.priority), esc(c.category),
            esc(c.zone || c.area || ''), esc(c.description), esc(c.location),
            esc(getDate(c.createdAt)), esc(getDate(c.resolvedAt)),
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `complaints_${selectedPeriod.label.replace(/\s+/g, '_').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('system_reports')}</h2>
                    <p className="text-gray-600">{t('reports_subtitle')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Period picker */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPeriodMenu(m => !m)}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 bg-white shadow-sm transition-colors"
                        >
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">{selectedPeriod.label}</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showPeriodMenu && (
                            <div className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[160px]">
                                {PERIODS.map((p, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setPeriodIdx(i); setShowPeriodMenu(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${i === periodIdx ? 'text-emerald-600 font-semibold bg-emerald-50' : 'text-gray-700'}`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleExportCSV}
                        disabled={loading || periodComplaints.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        <span className="text-sm">{t('export_csv')}</span>
                        {!loading && periodComplaints.length > 0 && (
                            <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">{periodComplaints.length}</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title={t('total_complaints')}
                    value={loading ? '...' : stats.total.toString()}
                    icon={<FileText className="w-6 h-6" />}
                    trend={{ value: selectedPeriod.label, isPositive: true }}
                    color="blue"
                />
                <StatCard
                    title={t('resolution_rate')}
                    value={loading ? '...' : stats.rate}
                    icon={<CheckCircle className="w-6 h-6" />}
                    trend={{ value: 'Live', isPositive: true }}
                    color="green"
                />
                <StatCard
                    title={t('avg_response_time')}
                    value={loading ? '...' : (stats.avgHours ?? '—')}
                    icon={<Clock className="w-6 h-6" />}
                    color="purple"
                />
                <StatCard
                    title={t('critical_issues')}
                    value={loading ? '...' : stats.critical.toString()}
                    icon={<AlertTriangle className="w-6 h-6" />}
                    color="red"
                />
            </div>

            {/* Zone Performance Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-lg font-bold text-gray-900">{t('zone_performance_analytics')}</h3>
                    </div>
                    {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                </div>

                {!loading && zoneStats.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100">
                            <BarChart3 className="w-8 h-8 text-gray-300" />
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-1">No zone data yet</h4>
                        <p className="text-gray-500 max-w-sm mx-auto text-sm">
                            Zone-wise analytics will appear here once complaints with zone or area information are submitted.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('zone_name')}</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resolved</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pending</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('resolution_rate')}</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {zoneStats.map((z, i) => {
                                    const pct = z.total > 0 ? (z.resolved / z.total) * 100 : 0;
                                    return (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                                                    <span className="font-medium text-gray-900 text-sm">{z.zone}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5 text-center font-semibold text-gray-900 text-sm">{z.total}</td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className="text-emerald-600 font-semibold text-sm">{z.resolved}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className="text-amber-600 font-semibold text-sm">{z.pending}</span>
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    pct >= 80 ? 'bg-emerald-100 text-emerald-700'
                                                        : pct >= 50 ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-red-100 text-red-700'
                                                }`}>{z.rate}</span>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-700 ${
                                                            pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Volume Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-lg font-bold text-gray-900">{t('weekly_complaint_volume')}</h3>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center h-44">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : (
                        <div className="px-2">
                            <BarChart data={weeklyData} maxVal={weeklyMax} />
                            <p className="text-xs text-gray-400 text-center mt-1">
                                Last 7 days · {weeklyData.reduce((s, d) => s + d.count, 0)} complaints
                            </p>
                        </div>
                    )}
                </div>

                {/* Category Breakdown Horizontal Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-5">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        <h3 className="text-lg font-bold text-gray-900">Category Breakdown</h3>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center h-44">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : categoryData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-44 text-gray-400">
                            <TrendingUp className="w-12 h-12 mb-2 text-gray-200" />
                            <p className="text-sm">No category data for this period</p>
                        </div>
                    ) : (
                        <div className="mt-2">
                            <HBarChart data={categoryData} maxVal={categoryMax} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportsTab;
