import React, { useEffect, useState } from 'react';
import {
    DollarSign, Users, AlertCircle, TrendingUp, CheckCircle,
    Download, Loader2, IndianRupee, X
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
    collection, query, where, getDocs, doc,
    setDoc, getDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useToast } from '../../../contexts/ToastContext';

interface SalaryTabProps {
    onNavigate: (tab: string) => void;
}

interface WorkerSalary {
    id: string;
    name: string;
    email: string;
    assignedZone: string;
    tasksCompleted: number;
    baseSalary: number;
    taskBonus: number;
    totalSalary: number;
    paymentStatus: 'paid' | 'pending' | 'processing';
    paymentMonth: string;
}

const BASE_SALARY = 12000;   // ₹ per month
const PER_TASK_BONUS = 150;  // ₹ per completed task
const CURRENT_MONTH = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

const formatINR = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const SalaryTab: React.FC<SalaryTabProps> = ({ onNavigate }) => {
    const { error: toastError } = useToast();
    const [workers, setWorkers] = useState<WorkerSalary[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [showPayModal, setShowPayModal] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<WorkerSalary | null>(null);

    const fetchSalaryData = async () => {
        setLoading(true);
        try {
            // 1. Fetch all workers
            const workersSnap = await getDocs(
                query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']))
            );

            // 2. For each worker, count completed tasks this month
            const now = new Date();
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            const result: WorkerSalary[] = [];

            for (const workerDoc of workersSnap.docs) {
                const workerData = workerDoc.data();
                const workerId = workerDoc.id;

                // Count completed/verified assignments this month
                const assignSnap = await getDocs(
                    query(
                        collection(db, 'assignments'),
                        where('workerId', '==', workerId),
                        where('workerStatus', 'in', ['COMPLETED', 'VERIFIED'])
                    )
                );

                // Filter by month (Firestore doesn't support date range + equality together easily)
                const tasksThisMonth = assignSnap.docs.filter(d => {
                    const ts = d.data().completedAt;
                    if (!ts) return false;
                    try {
                        const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
                        return date >= monthStart && date <= monthEnd;
                    } catch { return false; }
                }).length;

                const taskBonus = tasksThisMonth * PER_TASK_BONUS;
                const totalSalary = BASE_SALARY + taskBonus;

                // Check existing payment record
                const paymentKey = `${workerId}_${now.getFullYear()}_${now.getMonth() + 1}`;
                const paymentSnap = await getDoc(doc(db, 'salary_records', paymentKey));
                const paymentStatus: 'paid' | 'pending' | 'processing' =
                    paymentSnap.exists() ? (paymentSnap.data().status as any) : 'pending';

                result.push({
                    id: workerId,
                    name: workerData.name || 'Unknown',
                    email: workerData.email || '',
                    assignedZone: workerData.assignedZone || workerData.area || 'Unassigned',
                    tasksCompleted: tasksThisMonth,
                    baseSalary: BASE_SALARY,
                    taskBonus,
                    totalSalary,
                    paymentStatus,
                    paymentMonth: CURRENT_MONTH,
                });
            }

            // Sort: pending first, then processing, then paid
            result.sort((a, b) => {
                const rank = { pending: 0, processing: 1, paid: 2 };
                return rank[a.paymentStatus] - rank[b.paymentStatus];
            });

            setWorkers(result);
        } catch (e) {
            console.error('Error fetching salary data:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSalaryData();
    }, []);

    const handleMarkPaid = async (worker: WorkerSalary) => {
        setUpdatingId(worker.id);
        try {
            const now = new Date();
            const paymentKey = `${worker.id}_${now.getFullYear()}_${now.getMonth() + 1}`;
            await setDoc(doc(db, 'salary_records', paymentKey), {
                workerId: worker.id,
                workerName: worker.name,
                month: CURRENT_MONTH,
                baseSalary: worker.baseSalary,
                taskBonus: worker.taskBonus,
                totalSalary: worker.totalSalary,
                tasksCompleted: worker.tasksCompleted,
                status: 'paid',
                paidAt: serverTimestamp(),
            });
            setWorkers(prev =>
                prev.map(w => w.id === worker.id ? { ...w, paymentStatus: 'paid' } : w)
            );
            setShowPayModal(false);
            setSelectedWorker(null);
        } catch (e) {
            console.error('Error marking as paid:', e);
            toastError('Failed to update payment status.');
        } finally {
            setUpdatingId(null);
        }
    };

    const exportCSV = () => {
        const header = ['Name', 'Email', 'Zone', 'Tasks Completed', 'Base Salary', 'Task Bonus', 'Total Salary', 'Status'];
        const rows = workers.map(w => [
            w.name, w.email, w.assignedZone,
            w.tasksCompleted,
            w.baseSalary, w.taskBonus, w.totalSalary,
            w.paymentStatus
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `salary_${CURRENT_MONTH.replace(' ', '_')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const totalPayroll = workers.reduce((sum, w) => sum + (w.paymentStatus !== 'paid' ? w.totalSalary : 0), 0);
    const paidCount = workers.filter(w => w.paymentStatus === 'paid').length;
    const pendingCount = workers.filter(w => w.paymentStatus === 'pending').length;
    const avgSalary = workers.length > 0
        ? Math.round(workers.reduce((s, w) => s + w.totalSalary, 0) / workers.length)
        : 0;

    return (
        <div className="space-y-8 relative">
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Salary Tracking</h2>
                    <p className="text-gray-600">Payroll for {CURRENT_MONTH} — Base ₹{BASE_SALARY.toLocaleString()} + ₹{PER_TASK_BONUS}/task bonus</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchSalaryData}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
                    >
                        <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        onClick={exportCSV}
                        disabled={workers.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Outstanding Payroll"
                    value={loading ? '...' : formatINR(totalPayroll)}
                    icon={<IndianRupee className="w-6 h-6" />}
                    trend={{ value: 'This Month', isPositive: false }}
                    color="green"
                />
                <StatCard
                    title="Workers Paid"
                    value={loading ? '...' : paidCount.toString()}
                    icon={<CheckCircle className="w-6 h-6" />}
                    trend={{ value: `of ${workers.length}`, isPositive: true }}
                    color="blue"
                />
                <StatCard
                    title="Pending Payment"
                    value={loading ? '...' : pendingCount.toString()}
                    icon={<AlertCircle className="w-6 h-6" />}
                    trend={{ value: 'Action required', isPositive: false }}
                    color="yellow"
                />
                <StatCard
                    title="Avg Salary"
                    value={loading ? '...' : formatINR(avgSalary)}
                    icon={<TrendingUp className="w-6 h-6" />}
                    trend={{ value: 'Per worker', isPositive: true }}
                    color="purple"
                />
            </div>

            {/* Payroll Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Worker Payroll — {CURRENT_MONTH}</h3>
                    {!loading && (
                        <span className="text-sm text-gray-500">{workers.length} workers</span>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : workers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <Users className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Workers Found</h3>
                        <p className="text-gray-500 text-sm max-w-sm">
                            No workers are registered yet.
                        </p>
                        <button
                            onClick={() => onNavigate('workers')}
                            className="mt-5 px-5 py-2 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 font-medium text-sm transition-colors"
                        >
                            View Workers
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Worker</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Zone</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Tasks</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Base</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Bonus</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Status</th>
                                    <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {workers.map((w) => (
                                    <tr key={w.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm border border-emerald-100 flex-shrink-0">
                                                    {w.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                                                    <p className="text-xs text-gray-400 truncate max-w-[160px]">{w.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{w.assignedZone}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${w.tasksCompleted > 0 ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-400'}`}>
                                                {w.tasksCompleted}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 text-right font-mono">
                                            ₹{w.baseSalary.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-mono">
                                            <span className={w.taskBonus > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                                +₹{w.taskBonus.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-base font-bold text-gray-900 font-mono">
                                                ₹{w.totalSalary.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${w.paymentStatus === 'paid'
                                                ? 'bg-green-100 text-green-700'
                                                : w.paymentStatus === 'processing'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                {w.paymentStatus === 'paid' ? '✓ Paid' :
                                                    w.paymentStatus === 'processing' ? 'Processing' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {w.paymentStatus !== 'paid' ? (
                                                <button
                                                    onClick={() => { setSelectedWorker(w); setShowPayModal(true); }}
                                                    disabled={updatingId === w.id}
                                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                                                >
                                                    {updatingId === w.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : 'Mark Paid'}
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-400 flex items-center justify-end gap-1">
                                                    <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Paid
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>

                            {/* Summary Row */}
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                                <tr>
                                    <td colSpan={5} className="px-6 py-3 text-sm font-bold text-gray-700">
                                        Total Payroll — {workers.length} Workers
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        <span className="text-base font-bold text-gray-900 font-mono">
                                            ₹{workers.reduce((s, w) => s + w.totalSalary, 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td colSpan={2} className="px-6 py-3 text-right">
                                        <span className="text-sm text-gray-500">
                                            {paidCount} paid · {pendingCount} pending
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Info card about salary structure */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5">
                <h4 className="font-semibold text-emerald-900 mb-2 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Salary Structure
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Base Salary</p>
                        <p className="text-lg font-bold text-gray-900">₹{BASE_SALARY.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Per month, guaranteed</p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Per Task Bonus</p>
                        <p className="text-lg font-bold text-gray-900">₹{PER_TASK_BONUS}</p>
                        <p className="text-xs text-gray-500">Per completed & verified task</p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-3">
                        <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Month</p>
                        <p className="text-lg font-bold text-gray-900">{CURRENT_MONTH}</p>
                        <p className="text-xs text-gray-500">Current pay period</p>
                    </div>
                </div>
            </div>

            {/* Pay Confirmation Modal */}
            {showPayModal && selectedWorker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900">Confirm Payment</h3>
                            <button
                                onClick={() => { setShowPayModal(false); setSelectedWorker(null); }}
                                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg flex-shrink-0">
                                    {selectedWorker.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900">{selectedWorker.name}</p>
                                    <p className="text-sm text-gray-500">{selectedWorker.assignedZone}</p>
                                </div>
                            </div>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between py-2 border-b border-gray-100">
                                    <span className="text-gray-600">Base Salary</span>
                                    <span className="font-semibold">₹{selectedWorker.baseSalary.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-gray-100">
                                    <span className="text-gray-600">
                                        Task Bonus ({selectedWorker.tasksCompleted} tasks × ₹{PER_TASK_BONUS})
                                    </span>
                                    <span className="font-semibold text-green-600">+₹{selectedWorker.taskBonus.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between py-3">
                                    <span className="font-bold text-gray-900 text-base">Total Amount</span>
                                    <span className="font-bold text-gray-900 text-xl">₹{selectedWorker.totalSalary.toLocaleString()}</span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 bg-yellow-50 border border-yellow-100 p-3 rounded-lg">
                                ⚠️ This will mark the payment as completed for {CURRENT_MONTH}. This action is recorded in the system.
                            </p>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowPayModal(false); setSelectedWorker(null); }}
                                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleMarkPaid(selectedWorker)}
                                disabled={updatingId === selectedWorker.id}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
                            >
                                {updatingId === selectedWorker.id
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : <CheckCircle className="w-4 h-4" />}
                                Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalaryTab;
