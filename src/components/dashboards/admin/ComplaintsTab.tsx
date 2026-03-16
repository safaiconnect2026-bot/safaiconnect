import React, { useState, useEffect } from 'react';
import {
    ClipboardList, CheckCircle, AlertCircle, MoreVertical,
    Trash2, Eye, UserPlus, X, Loader2
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import { collection, query, onSnapshot, doc, updateDoc, getDocs, getDoc, where, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useToast } from '../../../contexts/ToastContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { sendPushNotification } from '../../../lib/fcm';

interface Complaint {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    citizenId: string;
    imageUrl?: string;
    createdAt: any;
    lat?: number;
    lng?: number;
    wardId?: string;
    wardName?: string;
    zoneId?: string;
    zoneName?: string;
    cityId?: string;
}

interface Worker {
    id: string;
    name: string;
    email: string;
}

interface Evidence {
    id: string;
    complaintId: string;
    workerId: string;
    imageUrl: string;
    notes: string;
    createdAt: any;
}

const ComplaintsTab: React.FC = () => {
    const { error: toastError } = useToast();
    const { addNotification } = useNotifications();
    const [complaints, setComplaints] = useState<Complaint[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [selectedComplaintForReview, setSelectedComplaintForReview] = useState<Complaint | null>(null);
    const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
    const [isReviewing, setIsReviewing] = useState(false);

    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch complaints in real-time
    useEffect(() => {
        const q = query(collection(db, 'complaints'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched: Complaint[] = [];
            snapshot.forEach((docSnap) => {
                fetched.push({ id: docSnap.id, ...docSnap.data() } as Complaint);
            });
            // Sort by latest
            fetched.sort((a, b) => {
                if (!a.createdAt || !b.createdAt) return 0;
                return b.createdAt.toMillis() - a.createdAt.toMillis();
            });
            setComplaints(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Fetch workers once
    useEffect(() => {
        const fetchWorkers = async () => {
            const q = query(collection(db, 'users'), where('role', 'in', ['Worker', 'worker']));
            const snap = await getDocs(q);
            const fetchedWorkers: Worker[] = [];
            snap.forEach(docSnap => {
                fetchedWorkers.push({
                    id: docSnap.id,
                    name: docSnap.data().name || 'Unknown Worker',
                    email: docSnap.data().email || ''
                });
            });
            setWorkers(fetchedWorkers);
        };
        fetchWorkers();
    }, []);

    const toggleDropdown = (id: string) => {
        setActiveDropdown(activeDropdown === id ? null : id);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeDropdown && !(event.target as Element).closest('.dropdown-container')) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeDropdown]);

    const handleViewDetail = async (complaintId: string, currentStatus: string) => {
        setActiveDropdown(null);
        // If it was just submitted, admin viewing it marks it as UNDER_REVIEW
        if (currentStatus === 'SUBMITTED') {
            try {
                const complaintRef = doc(db, 'complaints', complaintId);
                await updateDoc(complaintRef, { status: 'UNDER_REVIEW', updatedAt: serverTimestamp() });
            } catch (error) {
                console.error("Error updating status:", error);
            }
        }

        // Fetch evidence for review
        const selected = complaints.find(c => c.id === complaintId);
        if (selected) {
            setSelectedComplaintForReview(selected);
            setEvidenceList([]);
            setIsReviewModalOpen(true);

            // Load evidence
            try {
                const q = query(collection(db, 'completion_evidence'), where('complaintId', '==', complaintId));
                const snap = await getDocs(q);
                const fetchedEvidence: Evidence[] = [];
                snap.forEach(docSnap => {
                    fetchedEvidence.push({ id: docSnap.id, ...docSnap.data() } as Evidence);
                });

                // Also fetch original complaint photo if any (it's already on selected.imageUrl)
                setEvidenceList(fetchedEvidence);
            } catch (e) {
                console.error("Failed to fetch evidence", e);
            }
        }
    };

    const handleReviewAction = async (action: 'RESOLVED' | 'REASSIGNED') => {
        if (!selectedComplaintForReview) return;
        setIsReviewing(true);
        try {
            const complaintRef = doc(db, 'complaints', selectedComplaintForReview.id);
            await updateDoc(complaintRef, {
                status: action,
                updatedAt: serverTimestamp()
            });

            if (action === 'RESOLVED' && selectedComplaintForReview.citizenId) {
                try {
                    const userSnap = await getDoc(doc(db, 'users', selectedComplaintForReview.citizenId));
                    const fcmToken = userSnap.data()?.fcmToken as string | undefined;
                    if (fcmToken) {
                        await sendPushNotification(
                            [fcmToken],
                            'Issue Resolved! ✅',
                            'Your reported issue has been resolved. Please rate the work done.'
                        );
                    }
                } catch (notifyErr) {
                    console.warn('[ComplaintsTab] Push notification failed:', notifyErr);
                }
            }

            setIsReviewModalOpen(false);
            setSelectedComplaintForReview(null);
        } catch (error) {
            console.error("Error updating complaint:", error);
            toastError("Failed to update status.");
        } finally {
            setIsReviewing(false);
        }
    };

    const handleDelete = (complaintId: string) => {
        setActiveDropdown(null);
        setDeleteConfirmId(complaintId);
    };

    const executeDelete = async () => {
        if (!deleteConfirmId) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'complaints', deleteConfirmId));
            setDeleteConfirmId(null);
        } catch (error) {
            console.error("Error deleting complaint:", error);
            toastError("Failed to delete. Super Admin privileges required.");
        } finally {
            setIsDeleting(false);
        }
    };

    const openAssignModal = (complaintId: string) => {
        setSelectedComplaintId(complaintId);
        setSelectedWorkerIds([]);
        setIsAssignModalOpen(true);
        setActiveDropdown(null);
    };

    const toggleWorkerSelection = (workerId: string) => {
        if (selectedWorkerIds.includes(workerId)) {
            setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== workerId));
        } else {
            setSelectedWorkerIds([...selectedWorkerIds, workerId]);
        }
    };

    const handleAssignWorkers = async () => {
        if (!selectedComplaintId || selectedWorkerIds.length === 0) return;

        setIsAssigning(true);
        try {
            // Find the complaint early so we can copy GPS coords to each assignment
            const assignedComplaint = complaints.find(c => c.id === selectedComplaintId);

            // Write to assignments collection for each worker
            for (const wId of selectedWorkerIds) {
                await addDoc(collection(db, 'assignments'), {
                    complaintId: selectedComplaintId,
                    workerId: wId,
                    assignedAt: serverTimestamp(),
                    workerStatus: 'ASSIGNED',
                    // Copy GPS coords from complaint so WorkerRouteTab can show task on map
                    ...(assignedComplaint?.lat != null && assignedComplaint?.lng != null && {
                        lat: assignedComplaint.lat,
                        lng: assignedComplaint.lng,
                    }),
                });
            }

            // Update main complaint status
            const complaintRef = doc(db, 'complaints', selectedComplaintId);
            await updateDoc(complaintRef, {
                status: 'ASSIGNED',
                updatedAt: serverTimestamp()
            });

            // Notify the assigned worker(s)
            for (const wId of selectedWorkerIds) {
                await addNotification(
                    wId,
                    `You have been assigned a new complaint: ${assignedComplaint?.title || assignedComplaint?.category || 'Complaint'}`,
                    'complaint_assigned',
                    selectedComplaintId || undefined
                );
            }

            // Also send FCM push to each assigned worker
            for (const wId of selectedWorkerIds) {
                try {
                    const userSnap = await getDoc(doc(db, 'users', wId));
                    const fcmToken = userSnap.data()?.fcmToken as string | undefined;
                    if (fcmToken) {
                        await sendPushNotification(
                            [fcmToken],
                            '🗂️ New Task Assigned',
                            `You have been assigned: ${assignedComplaint?.title ?? 'a new complaint'}`,
                            { complaintId: selectedComplaintId ?? '' }
                        );
                    }
                } catch { /* FCM push is non-critical */ }
            }

            setIsAssignModalOpen(false);
            setSelectedWorkerIds([]);
        } catch (error) {
            console.error("Error assigning workers:", error);
            toastError("Failed to assign workers.");
        } finally {
            setIsAssigning(false);
        }
    };

    const pendingCount = complaints.filter(c => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW').length;
    const resolvedCount = complaints.filter(c => c.status === 'RESOLVED').length;

    return (
        <div className="space-y-8 animate-fade-in relative">
            <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Complaint Management</h2>
                <p className="text-gray-600">Monitor and manage citizen complaints</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Complaints"
                    value={complaints.length.toString()}
                    icon={<ClipboardList className="w-6 h-6" />}
                    trend={{ value: "Live", isPositive: true }}
                    color="blue"
                />
                <StatCard
                    title="Resolved"
                    value={resolvedCount.toString()}
                    icon={<CheckCircle className="w-6 h-6" />}
                    trend={{ value: "Live", isPositive: true }}
                    color="green"
                />
                <StatCard
                    title="Pending / Review"
                    value={pendingCount.toString()}
                    icon={<AlertCircle className="w-6 h-6" />}
                    trend={{ value: "Live", isPositive: false }}
                    color="yellow"
                />
                <StatCard
                    title="Total Workers"
                    value={workers.length.toString()}
                    icon={<UserPlus className="w-6 h-6" />}
                    trend={{ value: "Live", isPositive: true }}
                    color="purple"
                />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[400px]">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">Recent Complaints</h3>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    </div>
                ) : complaints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                        <ClipboardList className="w-12 h-12 mb-3 text-gray-300" />
                        <p>No complaints found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto overflow-visible">
                        <table className="w-full min-w-[900px] text-left">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title / Type</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ward / Zone</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {complaints.map((complaint) => (
                                    <tr key={complaint.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{complaint.title}</div>
                                            <div className="text-xs text-gray-500">{complaint.category}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="text-xs font-medium text-gray-700">{complaint.wardName || '—'}</div>
                                            <div className="text-xs text-gray-400">{complaint.zoneName || ''}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[200px] truncate">
                                            {complaint.location}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {complaint.createdAt ? new Date(complaint.createdAt.toMillis()).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                                                complaint.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                                                    complaint.status === 'UNDER_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                                                        complaint.status === 'ZONAL_APPROVED' ? 'bg-teal-100 text-teal-800' :
                                                            'bg-purple-100 text-purple-800'
                                                }`}>
                                                {complaint.status === 'ZONAL_APPROVED' ? 'ZONAL APPROVED' : complaint.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right dropdown-container relative">
                                            <button
                                                onClick={() => toggleDropdown(complaint.id)}
                                                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                                            >
                                                <MoreVertical className="w-5 h-5" />
                                            </button>

                                            {activeDropdown === complaint.id && (
                                                <div className="absolute top-full right-0 mt-2 min-w-[180px] rounded-xl shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 animate-in fade-in zoom-in duration-200">
                                                    <div className="py-1" role="menu" aria-label="Complaint actions">
                                                        <button
                                                            role="menuitem"
                                                            onClick={() => handleViewDetail(complaint.id, complaint.status)}
                                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Eye className="w-4 h-4 text-gray-500" /> View / Review
                                                        </button>
                                                        {(complaint.status === 'SUBMITTED' || complaint.status === 'UNDER_REVIEW') && (
                                                            <button
                                                                role="menuitem"
                                                                onClick={() => openAssignModal(complaint.id)}
                                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                                            >
                                                                <UserPlus className="w-4 h-4 text-green-500" /> Assign Workers
                                                            </button>
                                                        )}
                                                        <button
                                                            role="menuitem"
                                                            onClick={() => handleDelete(complaint.id)}
                                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                        >
                                                            <Trash2 className="w-4 h-4" /> Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Worker Assignment Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-semibold text-gray-900">Assign Workers</h3>
                            <button
                                onClick={() => setIsAssignModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-sm text-gray-600 mb-4">
                                Select one or more workers to assign to this complaint. They will be notified automatically.
                            </p>

                            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                                {workers.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-gray-500">No workers available.</div>
                                ) : (
                                    workers.map(worker => (
                                        <div
                                            key={worker.id}
                                            onClick={() => toggleWorkerSelection(worker.id)}
                                            className={`p-3 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${selectedWorkerIds.includes(worker.id) ? 'bg-emerald-50/50' : ''}`}
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900 text-sm">{worker.name}</div>
                                                <div className="text-xs text-gray-500">{worker.email}</div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selectedWorkerIds.includes(worker.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}`}>
                                                    {selectedWorkerIds.includes(worker.id) && <CheckCircle className="w-3 h-3 text-white" />}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsAssignModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAssignWorkers}
                                disabled={selectedWorkerIds.length === 0 || isAssigning}
                                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Assign {selectedWorkerIds.length > 0 ? `(${selectedWorkerIds.length})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-7 h-7 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Complaint?</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                This will permanently remove the complaint and cannot be undone. Super Admin privileges are required.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeDelete}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {isReviewModalOpen && selectedComplaintForReview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                            <h3 className="font-semibold text-gray-900">Review Complaint Verification</h3>
                            <button
                                onClick={() => setIsReviewModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Complaint Details */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-gray-900">{selectedComplaintForReview.title}</h4>
                                    <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${selectedComplaintForReview.status === 'RESOLVED' || selectedComplaintForReview.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                                        selectedComplaintForReview.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                                            selectedComplaintForReview.status === 'UNDER_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-purple-100 text-purple-800'
                                        }`}>
                                        {selectedComplaintForReview.status}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2">{selectedComplaintForReview.description}</p>
                                <div className="text-xs text-gray-500 font-medium">{selectedComplaintForReview.location}</div>
                            </div>

                            {/* Evidence display */}
                            <h4 className="font-semibold text-gray-900 mb-3">Verification Evidence</h4>
                            {evidenceList.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <div className="text-gray-500 text-sm">No evidence photos uploaded yet.</div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {evidenceList.map((evidence, idx) => (
                                        <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            {evidence.imageUrl ? (
                                                <div className="aspect-video bg-gray-100 relative">
                                                    <img src={evidence.imageUrl} alt="Verification Evidence" className="w-full h-full object-contain" />
                                                </div>
                                            ) : (
                                                <div className="p-4 text-sm text-gray-500">Image missing or broken.</div>
                                            )}
                                            <div className="p-4 bg-gray-50 flex justify-between items-start gap-4 border-t border-gray-100">
                                                <div>
                                                    <div className="text-xs text-gray-400 mb-1 uppercase font-semibold">Worker Notes</div>
                                                    <p className="text-sm text-gray-700">{evidence.notes || 'No description provided.'}</p>
                                                </div>
                                                <div className="text-xs text-gray-400 whitespace-nowrap">
                                                    {evidence.createdAt ? new Date(evidence.createdAt.toMillis()).toLocaleString() : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between gap-3 flex-shrink-0">
                            <button
                                onClick={() => setIsReviewModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Close
                            </button>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleReviewAction('REASSIGNED')}
                                    disabled={isReviewing}
                                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                                >
                                    Reject & Reassign
                                </button>
                                <button
                                    onClick={() => handleReviewAction('RESOLVED')}
                                    disabled={isReviewing}
                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    Approve & Resolve
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComplaintsTab;
