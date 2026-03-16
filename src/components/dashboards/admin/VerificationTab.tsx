import React, { useEffect, useState } from 'react';
import {
    Camera, CheckCircle, AlertCircle, TrendingUp, MapPin,
    Loader2, X, User, Clock
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
    collection, query, where, onSnapshot, getDocs, doc,
    getDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

interface VerificationEntry {
    assignmentId: string;
    complaintId: string;
    workerId: string;
    workerName: string;
    workerEmail: string;
    complaintTitle: string;
    complaintLocation: string;
    completedAt: any;
    evidenceImageUrl?: string;
    evidenceNotes?: string;
    complaintStatus: string;
    zonalApproval?: {
        approved: boolean;
        approvedBy: string;
        approvedByName: string;
        approvedAt: any;
    };
    wardName?: string;
    zoneName?: string;
}

const VerificationTab: React.FC = () => {
    const { error: toastError } = useToast();
    const { userProfile } = useAuth();
    const [entries, setEntries] = useState<VerificationEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [approvedCount, setApprovedCount] = useState(0);
    const [rejectedCount, setRejectedCount] = useState(0);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<VerificationEntry | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // Listen to ZONAL_APPROVED assignments (awaiting admin final approval) and VERIFIED (already done)
        const q = query(collection(db, 'assignments'), where('workerStatus', 'in', ['ZONAL_APPROVED', 'VERIFIED']));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const pending: VerificationEntry[] = [];
            let approved = 0;
            let rejected = 0;

            for (const assignDoc of snapshot.docs) {
                const a = assignDoc.data();

                // Already fully verified by admin — count as approved, skip
                if (a.workerStatus === 'VERIFIED') {
                    approved++;
                    continue;
                }

                try {
                    // Fetch complaint
                    const complaintSnap = await getDoc(doc(db, 'complaints', a.complaintId));
                    if (!complaintSnap.exists()) continue;
                    const complaint = complaintSnap.data();

                    if (complaint.status === 'RESOLVED' || complaint.status === 'CLOSED') {
                        approved++;
                        continue;
                    }
                    if (complaint.status === 'REASSIGNED') {
                        rejected++;
                        continue;
                    }

                    // Fetch worker name
                    const workerSnap = await getDoc(doc(db, 'users', a.workerId));
                    const worker = workerSnap.exists() ? workerSnap.data() : {};

                    // Fetch evidence
                    const evSnap = await getDocs(
                        query(collection(db, 'completion_evidence'), where('complaintId', '==', a.complaintId))
                    );
                    const evidence = evSnap.empty ? null : evSnap.docs[0].data();

                    pending.push({
                        assignmentId: assignDoc.id,
                        complaintId: a.complaintId,
                        workerId: a.workerId,
                        workerName: (worker as any).name || 'Unknown Worker',
                        workerEmail: (worker as any).email || '',
                        complaintTitle: complaint.title || complaint.category || 'Task',
                        complaintLocation: complaint.location || 'Unknown Location',
                        completedAt: a.completedAt,
                        evidenceImageUrl: evidence?.imageUrl,
                        evidenceNotes: evidence?.notes,
                        complaintStatus: complaint.status,
                        zonalApproval: a.zonalApproval,
                        wardName: complaint.wardName || '',
                        zoneName: complaint.zoneName || '',
                    });
                } catch (e) {
                    console.error('Error fetching verification entry:', e);
                }
            }

            // Sort by most recent
            pending.sort((a, b) => (b.completedAt?.toMillis?.() || 0) - (a.completedAt?.toMillis?.() || 0));
            setApprovedCount(approved);
            setRejectedCount(rejected);
            setEntries(pending);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleApprove = async (entry: VerificationEntry) => {
        setReviewing(entry.assignmentId);
        try {
            await updateDoc(doc(db, 'complaints', entry.complaintId), {
                status: 'RESOLVED',
                updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'assignments', entry.assignmentId), {
                workerStatus: 'VERIFIED',
                adminApproval: {
                    approved: true,
                    approvedBy: userProfile?.uid || '',
                    approvedByName: userProfile?.name || '',
                    approvedAt: serverTimestamp(),
                },
                verifiedAt: serverTimestamp(),
            });
            setIsModalOpen(false);
            setSelectedEntry(null);
        } catch (e) {
            console.error('Error approving:', e);
            toastError('Failed to approve. Please try again.');
        } finally {
            setReviewing(null);
        }
    };

    const handleReject = async (entry: VerificationEntry) => {
        setReviewing(entry.assignmentId);
        try {
            await updateDoc(doc(db, 'complaints', entry.complaintId), {
                status: 'UNDER_REVIEW',
                updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'assignments', entry.assignmentId), {
                workerStatus: 'ASSIGNED',
                zonalApproval: null,
                adminApproval: null,
                updatedAt: serverTimestamp(),
            });
            setIsModalOpen(false);
            setSelectedEntry(null);
        } catch (e) {
            console.error('Error rejecting:', e);
            toastError('Failed to reject. Please try again.');
        } finally {
            setReviewing(null);
        }
    };

    const formatTime = (ts: any) => {
        if (!ts) return 'N/A';
        try {
            const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
            return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
        } catch {
            return 'N/A';
        }
    };

    const total = approvedCount + rejectedCount + entries.length;
    const verificationRate = total > 0 ? Math.round((approvedCount / total) * 100) : 0;

    return (
        <div className="space-y-8 relative">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Final Verification (Admin Approval)</h2>
                <p className="text-gray-600">Review zonal-approved work completions — both zonal and admin approval required</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Pending Review"
                    value={loading ? '...' : entries.length.toString()}
                    icon={<Camera className="w-6 h-6" />}
                    color="yellow"
                />
                <StatCard
                    title="Approved"
                    value={approvedCount.toString()}
                    icon={<CheckCircle className="w-6 h-6" />}
                    trend={{ value: 'Resolved', isPositive: true }}
                    color="green"
                />
                <StatCard
                    title="Rejected"
                    value={rejectedCount.toString()}
                    icon={<AlertCircle className="w-6 h-6" />}
                    color="red"
                />
                <StatCard
                    title="Approval Rate"
                    value={`${verificationRate}%`}
                    icon={<TrendingUp className="w-6 h-6" />}
                    trend={{ value: 'Live', isPositive: true }}
                    color="blue"
                />
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Pending Verifications</h3>
                    <span className="text-sm text-gray-500">
                        {loading ? 'Loading...' : `${entries.length} awaiting review`}
                    </span>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-16 text-center">
                        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                        <p className="text-xl font-bold text-gray-800">All Caught Up!</p>
                        <p className="text-sm text-gray-500 mt-1">No pending verifications at this time.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {entries.map((entry) => (
                            <div
                                key={entry.assignmentId}
                                className="p-5 hover:bg-gray-50/50 transition-colors flex flex-col sm:flex-row gap-4 items-start"
                            >
                                {/* Evidence Thumbnail */}
                                <div className="w-full sm:w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                                    {entry.evidenceImageUrl ? (
                                        <img
                                            src={entry.evidenceImageUrl}
                                            alt="Evidence"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-300">
                                            <Camera className="w-7 h-7" />
                                            <span className="text-xs font-medium">No photo</span>
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-gray-900 truncate">
                                            {entry.complaintTitle}
                                        </span>
                                        {entry.evidenceImageUrl && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                                                Photo ✓
                                            </span>
                                        )}
                                        {entry.evidenceNotes?.includes('lat:') && (
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                                GPS ✓
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate">
                                            {entry.workerName} · {entry.workerEmail}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                        <span className="truncate">{entry.complaintLocation}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        <span>Completed: {formatTime(entry.completedAt)}</span>
                                    </div>
                                    {entry.zonalApproval && (
                                        <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-1">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>Zonal Approved by: {entry.zonalApproval.approvedByName || 'Zonal Admin'}</span>
                                        </div>
                                    )}
                                    {(entry.wardName || entry.zoneName) && (
                                        <div className="flex items-center gap-1.5 text-xs text-blue-500 mt-0.5">
                                            <MapPin className="w-3 h-3" />
                                            <span>{entry.wardName}{entry.zoneName ? ` · ${entry.zoneName}` : ''}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex sm:flex-col gap-2 flex-shrink-0 w-full sm:w-auto">
                                    <button
                                        onClick={() => { setSelectedEntry(entry); setIsModalOpen(true); }}
                                        className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        View Details
                                    </button>
                                    <button
                                        onClick={() => handleApprove(entry)}
                                        disabled={reviewing === entry.assignmentId}
                                        className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                                    >
                                        {reviewing === entry.assignmentId
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <CheckCircle className="w-3.5 h-3.5" />
                                        }
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(entry)}
                                        disabled={reviewing === entry.assignmentId}
                                        className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {isModalOpen && selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg">Verification Review</h3>
                                <p className="text-sm text-gray-500">{selectedEntry.complaintTitle}</p>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); setSelectedEntry(null); }}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-5">
                            {selectedEntry.evidenceImageUrl ? (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Evidence Photo
                                    </p>
                                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                                        <img
                                            src={selectedEntry.evidenceImageUrl}
                                            alt="Evidence"
                                            className="w-full h-full object-contain"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400">
                                    <Camera className="w-10 h-10 mb-2" />
                                    <p className="text-sm font-medium">No photo evidence uploaded</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Worker</p>
                                    <p className="font-semibold text-gray-900">{selectedEntry.workerName}</p>
                                    <p className="text-gray-500 text-xs mt-0.5">{selectedEntry.workerEmail}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Submitted At</p>
                                    <p className="font-semibold text-gray-900">{formatTime(selectedEntry.completedAt)}</p>
                                </div>
                                <div className="col-span-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Location</p>
                                    <div className="flex items-start gap-1.5">
                                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                        <p className="font-medium text-gray-900">{selectedEntry.complaintLocation}</p>
                                    </div>
                                </div>
                                {selectedEntry.evidenceNotes && (
                                    <div className="col-span-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            Worker Notes / GPS Tag
                                        </p>
                                        <p className="text-gray-700 bg-gray-50 border border-gray-100 p-3 rounded-lg text-xs font-mono leading-relaxed">
                                            {selectedEntry.evidenceNotes}
                                        </p>
                                    </div>
                                )}
                                {selectedEntry.zonalApproval && (
                                    <div className="col-span-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            Zonal Admin Approval
                                        </p>
                                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
                                            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-800">Approved by {selectedEntry.zonalApproval.approvedByName || 'Zonal Admin'}</p>
                                                <p className="text-xs text-emerald-600">{formatTime(selectedEntry.zonalApproval.approvedAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {(selectedEntry.wardName || selectedEntry.zoneName) && (
                                    <div className="col-span-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                            Ward / Zone
                                        </p>
                                        <p className="text-gray-700 text-sm">{selectedEntry.wardName}{selectedEntry.zoneName ? ` · ${selectedEntry.zoneName}` : ''}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
                            <button
                                onClick={() => handleReject(selectedEntry)}
                                disabled={reviewing !== null}
                                className="px-5 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
                            >
                                Reject & Reassign
                            </button>
                            <button
                                onClick={() => handleApprove(selectedEntry)}
                                disabled={reviewing !== null}
                                className="px-5 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                            >
                                {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Final Approve & Resolve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VerificationTab;
