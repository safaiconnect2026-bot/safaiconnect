import React, { useState, useEffect } from 'react';
import {
  ClipboardList, CheckCircle, AlertCircle, MoreVertical,
  Eye, UserPlus, X, Loader2, Trash2,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
  collection, query, onSnapshot, doc, updateDoc, getDocs, getDoc,
  where, addDoc, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useToast } from '../../../contexts/ToastContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { sendPushNotification } from '../../../lib/fcm';
import { useLanguage } from '../../../contexts/LanguageContext';

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
  zoneId?: string;
  wardId?: string;
  wardName?: string;
  zoneName?: string;
  assignedWorkerIds?: string[];
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

interface ZonalComplaintsTabProps {
  zoneId: string;
}

const ZonalComplaintsTab: React.FC<ZonalComplaintsTabProps> = ({ zoneId }) => {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
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

  // Fetch zone workers + zone complaints
  useEffect(() => {
    if (!zoneId) return;

    // Workers in this zone
    const workersQ = query(
      collection(db, 'users'),
      where('role', 'in', ['Worker', 'worker']),
      where('zoneId', '==', zoneId),
    );

    const unsubWorkers = onSnapshot(workersQ, (snap) => {
      const fetched: Worker[] = [];
      snap.forEach((d) => {
        fetched.push({ id: d.id, name: d.data().name || 'Unknown', email: d.data().email || '' });
      });
      setWorkers(fetched);
    });

    // All complaints — we handle merging in the next effect
    return () => { unsubWorkers(); };
  }, [zoneId]);

  // Separate effect to merge workers + complaints
  useEffect(() => {
    if (!zoneId) return;

    // Query complaints that belong to this zone directly (set by citizen at submission)
    const complaintsQ = query(
      collection(db, 'complaints'),
      where('zoneId', '==', zoneId),
    );

    const unsubComplaints = onSnapshot(complaintsQ, (snap) => {
      const fetched: Complaint[] = [];
      snap.forEach((d) => {
        const data = d.data() as Omit<Complaint, 'id'>;
        fetched.push({ id: d.id, ...data });
      });
      fetched.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setComplaints(fetched);
      setLoading(false);
    });

    return () => { unsubComplaints(); };
  }, [zoneId]);

  const toggleDropdown = (id: string) => setActiveDropdown(activeDropdown === id ? null : id);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (activeDropdown && !(e.target as Element).closest('.dropdown-container')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeDropdown]);

  const handleViewDetail = async (complaintId: string, currentStatus: string) => {
    setActiveDropdown(null);
    if (currentStatus === 'SUBMITTED') {
      try {
        await updateDoc(doc(db, 'complaints', complaintId), { status: 'UNDER_REVIEW', updatedAt: serverTimestamp() });
      } catch (error) { console.error('Error updating status:', error); }
    }
    const selected = complaints.find((c) => c.id === complaintId);
    if (selected) {
      setSelectedComplaintForReview(selected);
      setEvidenceList([]);
      setIsReviewModalOpen(true);
      try {
        const q = query(collection(db, 'completion_evidence'), where('complaintId', '==', complaintId));
        const snap = await getDocs(q);
        const ev: Evidence[] = [];
        snap.forEach((d) => ev.push({ id: d.id, ...d.data() } as Evidence));
        setEvidenceList(ev);
      } catch (e) { console.error('Failed to fetch evidence', e); }
    }
  };

  const handleReviewAction = async (action: 'RESOLVED' | 'REASSIGNED') => {
    if (!selectedComplaintForReview) return;
    setIsReviewing(true);
    try {
      await updateDoc(doc(db, 'complaints', selectedComplaintForReview.id), { status: action, updatedAt: serverTimestamp() });
      setIsReviewModalOpen(false);
      setSelectedComplaintForReview(null);
    } catch (error) {
      console.error('Error updating complaint:', error);
      toastError('Failed to update status.');
    } finally { setIsReviewing(false); }
  };

  const openAssignModal = (complaintId: string) => {
    setSelectedComplaintId(complaintId);
    setSelectedWorkerIds([]);
    setIsAssignModalOpen(true);
    setActiveDropdown(null);
  };

  const toggleWorkerSelection = (workerId: string) => {
    setSelectedWorkerIds((prev) =>
      prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId],
    );
  };

  const handleAssignWorkers = async () => {
    if (!selectedComplaintId || selectedWorkerIds.length === 0) return;
    setIsAssigning(true);
    try {
      const assignedComplaint = complaints.find((c) => c.id === selectedComplaintId);
      for (const wId of selectedWorkerIds) {
        await addDoc(collection(db, 'assignments'), {
          complaintId: selectedComplaintId,
          workerId: wId,
          assignedAt: serverTimestamp(),
          workerStatus: 'ASSIGNED',
          ...(assignedComplaint?.lat != null && assignedComplaint?.lng != null && { lat: assignedComplaint.lat, lng: assignedComplaint.lng }),
        });
      }
      await updateDoc(doc(db, 'complaints', selectedComplaintId), { status: 'ASSIGNED', updatedAt: serverTimestamp() });

      for (const wId of selectedWorkerIds) {
        await addNotification(wId, `You have been assigned a new complaint: ${assignedComplaint?.title || assignedComplaint?.category || 'Complaint'}`, 'complaint_assigned', selectedComplaintId || undefined);
        try {
          const userSnap = await getDoc(doc(db, 'users', wId));
          const fcmToken = userSnap.data()?.fcmToken as string | undefined;
          if (fcmToken) {
            await sendPushNotification([fcmToken], 'New Task Assigned', `You have been assigned: ${assignedComplaint?.title ?? 'a new complaint'}`, { complaintId: selectedComplaintId ?? '' });
          }
        } catch { /* non-critical */ }
      }

      setIsAssignModalOpen(false);
      setSelectedWorkerIds([]);
    } catch (error) {
      console.error('Error assigning workers:', error);
      toastError('Failed to assign workers.');
    } finally { setIsAssigning(false); }
  };

  const handleDeleteComplaint = (complaintId: string) => {
    setActiveDropdown(null);
    setDeleteConfirmId(complaintId);
  };

  const executeDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'complaints', deleteConfirmId));
      toastSuccess('Complaint deleted successfully.');
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Error deleting complaint:', error);
      toastError('Failed to delete complaint.');
    } finally { setIsDeleting(false); }
  };

  const pendingCount = complaints.filter((c) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW').length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  return (
    <div className="space-y-8 animate-fade-in relative">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {t('zone_complaints') || 'Zone Complaints'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('zone_complaints_subtitle') || 'Manage complaints assigned to your zone'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('total_complaints') || 'Total Complaints'} value={complaints.length.toString()} icon={<ClipboardList className="w-6 h-6" />} color="blue" />
        <StatCard title={t('resolved') || 'Resolved'} value={resolvedCount.toString()} icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <StatCard title={t('pending') || 'Pending / Review'} value={pendingCount.toString()} icon={<AlertCircle className="w-6 h-6" />} color="yellow" />
        <StatCard title={t('workers') || 'Zone Workers'} value={workers.length.toString()} icon={<UserPlus className="w-6 h-6" />} color="purple" />
      </div>

      {/* Complaints Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden min-h-[400px]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('recent_complaints') || 'Recent Complaints'}
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-gray-500">
            <ClipboardList className="w-12 h-12 mb-3 text-gray-300" />
            <p>{t('no_complaints') || 'No complaints found in your zone.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('title') || 'Title / Type'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ward</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('location') || 'Location'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('date') || 'Date'}</th>
                  <th className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('status') || 'Status'}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('actions') || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {complaints.map((complaint) => (
                  <tr key={complaint.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{complaint.title}</div>
                      <div className="text-xs text-gray-500">{complaint.category}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{complaint.wardName || '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[200px] truncate">{complaint.location}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {complaint.createdAt ? new Date(complaint.createdAt.toMillis()).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${
                        complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                        complaint.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                        complaint.status === 'UNDER_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                        complaint.status === 'ZONAL_APPROVED' ? 'bg-teal-100 text-teal-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {complaint.status === 'ZONAL_APPROVED' ? 'ZONAL APPROVED' : complaint.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right dropdown-container relative">
                      <button onClick={() => toggleDropdown(complaint.id)} className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {activeDropdown === complaint.id && (
                        <div className="absolute top-full right-0 mt-2 min-w-[180px] w-48 rounded-xl shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                          <div className="py-1" role="menu">
                            <button onClick={() => handleViewDetail(complaint.id, complaint.status)} className="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                              <Eye className="w-4 h-4 text-gray-500" /> {t('view') || 'View / Review'}
                            </button>
                            {(complaint.status === 'SUBMITTED' || complaint.status === 'UNDER_REVIEW') && (
                              <button onClick={() => openAssignModal(complaint.id)} className="w-full text-left px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-green-500" /> {t('assign_workers') || 'Assign Workers'}
                              </button>
                            )}
                            <button onClick={() => handleDeleteComplaint(complaint.id)} className="w-full text-left px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 flex items-center gap-2">
                              <Trash2 className="w-4 h-4 text-red-500" /> {t('delete') || 'Delete'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('assign_workers') || 'Assign Workers'}</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('assign_workers_desc') || 'Select workers from your zone to assign to this complaint.'}
              </p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                {workers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">{t('no_workers') || 'No workers available in your zone.'}</div>
                ) : (
                  workers.map((worker) => (
                    <div key={worker.id} onClick={() => toggleWorkerSelection(worker.id)} className={`p-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedWorkerIds.includes(worker.id) ? 'bg-emerald-50/50 dark:bg-emerald-900/20' : ''}`}>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">{worker.name}</div>
                        <div className="text-xs text-gray-500">{worker.email}</div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selectedWorkerIds.includes(worker.id) ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {selectedWorkerIds.includes(worker.id) && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">
                {t('cancel') || 'Cancel'}
              </button>
              <button onClick={handleAssignWorkers} disabled={selectedWorkerIds.length === 0 || isAssigning} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {t('assign') || 'Assign'} {selectedWorkerIds.length > 0 ? `(${selectedWorkerIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-xl p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Delete Complaint</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              This action is permanent and cannot be undone. Are you sure you want to delete this complaint?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">
                Cancel
              </button>
              <button onClick={executeDelete} disabled={isDeleting} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && selectedComplaintForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('review_complaint') || 'Review Complaint'}</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-gray-900 dark:text-white">{selectedComplaintForReview.title}</h4>
                  <span className={`inline-flex px-2 py-1 text-[10px] font-bold uppercase rounded-full tracking-wider ${
                    selectedComplaintForReview.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                    selectedComplaintForReview.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>{selectedComplaintForReview.status}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{selectedComplaintForReview.description}</p>
                <div className="text-xs text-gray-500 font-medium">{selectedComplaintForReview.location}</div>
              </div>

              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('verification_evidence') || 'Verification Evidence'}</h4>
              {evidenceList.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
                  <p className="text-gray-500 text-sm">{t('no_evidence') || 'No evidence uploaded yet.'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {evidenceList.map((ev, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                      {ev.imageUrl && (
                        <div className="aspect-video bg-gray-100 dark:bg-gray-700">
                          <img src={ev.imageUrl} alt="Evidence" className="w-full h-full object-contain" />
                        </div>
                      )}
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-start gap-4 border-t border-gray-100 dark:border-gray-600">
                        <div>
                          <div className="text-xs text-gray-400 mb-1 uppercase font-semibold">{t('worker_notes') || 'Worker Notes'}</div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{ev.notes || 'No description provided.'}</p>
                        </div>
                        <div className="text-xs text-gray-400 whitespace-nowrap">
                          {ev.createdAt ? new Date(ev.createdAt.toMillis()).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-between gap-3 flex-shrink-0">
              <button onClick={() => setIsReviewModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600">
                {t('close') || 'Close'}
              </button>
              <div className="flex gap-3">
                <button onClick={() => handleReviewAction('REASSIGNED')} disabled={isReviewing} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50">
                  {t('reject_reassign') || 'Reject & Reassign'}
                </button>
                <button onClick={() => handleReviewAction('RESOLVED')} disabled={isReviewing} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  {isReviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {t('approve_resolve') || 'Approve & Resolve'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZonalComplaintsTab;
