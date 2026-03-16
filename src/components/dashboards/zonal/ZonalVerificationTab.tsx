import React, { useEffect, useState } from 'react';
import {
  CheckCircle, XCircle, Clock, Eye, X, Loader2, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import StatCard from '../../common/StatCard';
import {
  collection, query, where, onSnapshot, getDocs, doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useToast } from '../../../contexts/ToastContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAuth } from '../../../contexts/AuthContext';

interface VerificationEntry {
  assignmentId: string;
  complaintId: string;
  complaintTitle: string;
  complaintLocation: string;
  workerId: string;
  workerName: string;
  workerStatus: string;
  evidenceUrl?: string;
  evidenceNotes?: string;
  assignedAt: any;
}

interface ZonalVerificationTabProps {
  zoneId: string;
}

const ZonalVerificationTab: React.FC<ZonalVerificationTabProps> = ({ zoneId }) => {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const { userProfile } = useAuth();
  const [entries, setEntries] = useState<VerificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvedCount, setApprovedCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);

  const [selectedEntry, setSelectedEntry] = useState<VerificationEntry | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);

  useEffect(() => {
    if (!zoneId) return;

    // First get zone worker IDs
    const workersQ = query(
      collection(db, 'users'),
      where('role', 'in', ['Worker', 'worker']),
      where('zoneId', '==', zoneId),
    );

    const unsubWorkers = onSnapshot(workersQ, async (workerSnap) => {
      const workerIds = workerSnap.docs.map((d) => d.id);
      const workerMap = new Map<string, string>();
      workerSnap.docs.forEach((d) => workerMap.set(d.id, d.data().name || 'Unknown'));

      if (workerIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      // Listen to assignments for completed/verified from zone workers
      const batchSize = 30;
      const allEntries: VerificationEntry[] = [];
      let approved = 0;
      let rejected = 0;

      for (let i = 0; i < workerIds.length; i += batchSize) {
        const batch = workerIds.slice(i, i + batchSize);
        const assignQ = query(
          collection(db, 'assignments'),
          where('workerId', 'in', batch),
          where('workerStatus', 'in', ['COMPLETED', 'ZONAL_APPROVED', 'VERIFIED', 'REJECTED']),
        );

        const assignSnap = await getDocs(assignQ);
        for (const aDoc of assignSnap.docs) {
          const aData = aDoc.data();

          // Get complaint details
          let complaintTitle = '';
          let complaintLocation = '';
          try {
            const cSnap = await getDoc(doc(db, 'complaints', aData.complaintId));
            if (cSnap.exists()) {
              complaintTitle = cSnap.data().title || cSnap.data().category || '';
              complaintLocation = cSnap.data().location || '';
            }
          } catch { /* ignore */ }

          // Get evidence
          let evidenceUrl = '';
          let evidenceNotes = '';
          try {
            const evQ = query(collection(db, 'completion_evidence'), where('complaintId', '==', aData.complaintId));
            const evSnap = await getDocs(evQ);
            if (!evSnap.empty) {
              const evData = evSnap.docs[0].data();
              evidenceUrl = evData.imageUrl || '';
              evidenceNotes = evData.notes || '';
            }
          } catch { /* ignore */ }

          if (aData.workerStatus === 'VERIFIED' || aData.workerStatus === 'ZONAL_APPROVED') approved++;
          if (aData.workerStatus === 'REJECTED') rejected++;

          allEntries.push({
            assignmentId: aDoc.id,
            complaintId: aData.complaintId,
            complaintTitle,
            complaintLocation,
            workerId: aData.workerId,
            workerName: workerMap.get(aData.workerId) || 'Unknown',
            workerStatus: aData.workerStatus,
            evidenceUrl,
            evidenceNotes,
            assignedAt: aData.assignedAt,
          });
        }
      }

      setEntries(allEntries);
      setApprovedCount(approved);
      setRejectedCount(rejected);
      setLoading(false);
    });

    return () => unsubWorkers();
  }, [zoneId]);

  const handleOpenReview = async (entry: VerificationEntry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
    // Load all evidence for this complaint
    try {
      const q = query(collection(db, 'completion_evidence'), where('complaintId', '==', entry.complaintId));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setEvidenceList(list);
    } catch { setEvidenceList([]); }
  };

  const handleVerify = async (action: 'ZONAL_APPROVED' | 'REJECTED') => {
    if (!selectedEntry) return;
    setReviewing(true);
    try {
      await updateDoc(doc(db, 'assignments', selectedEntry.assignmentId), {
        workerStatus: action,
        ...(action === 'ZONAL_APPROVED' && {
          zonalApproval: {
            approved: true,
            approvedBy: userProfile?.uid || '',
            approvedByName: userProfile?.name || '',
            approvedAt: serverTimestamp(),
          },
        }),
        verifiedAt: serverTimestamp(),
      });
      // Update complaint status
      if (action === 'ZONAL_APPROVED') {
        await updateDoc(doc(db, 'complaints', selectedEntry.complaintId), { status: 'ZONAL_APPROVED', updatedAt: serverTimestamp() });
      }
      success(action === 'ZONAL_APPROVED' ? 'Zonal approval granted — awaiting admin final approval' : 'Work rejected');
      setIsModalOpen(false);
      setSelectedEntry(null);

      // Refresh entries
      setEntries((prev) => prev.map((e) =>
        e.assignmentId === selectedEntry.assignmentId ? { ...e, workerStatus: action } : e,
      ));
      if (action === 'ZONAL_APPROVED') setApprovedCount((c) => c + 1);
      if (action === 'REJECTED') setRejectedCount((c) => c + 1);
    } catch (error) {
      console.error('Verification error:', error);
      toastError('Failed to update verification status.');
    } finally { setReviewing(false); }
  };

  const pendingEntries = entries.filter((e) => e.workerStatus === 'COMPLETED');
  const totalRate = entries.length > 0 ? Math.round((approvedCount / entries.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('work_verification') || 'Work Verification'}</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('zone_verification_subtitle') || 'Review worker completions — your approval will be forwarded to Admin for final verification'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('pending_review') || 'Pending Review'} value={pendingEntries.length} icon={<Clock className="w-6 h-6" />} color="yellow" />
        <StatCard title={t('approved') || 'Approved'} value={approvedCount} icon={<CheckCircle className="w-6 h-6" />} color="green" />
        <StatCard title={t('rejected') || 'Rejected'} value={rejectedCount} icon={<XCircle className="w-6 h-6" />} color="red" />
        <StatCard title={t('approval_rate') || 'Approval Rate'} value={`${totalRate}%`} icon={<ThumbsUp className="w-6 h-6" />} color="blue" />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      ) : pendingEntries.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('no_pending_verifications') || 'No pending verifications.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingEntries.map((entry) => (
            <div key={entry.assignmentId} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
              {entry.evidenceUrl ? (
                <img src={entry.evidenceUrl} alt="Evidence" className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Eye className="w-6 h-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white truncate">{entry.complaintTitle || 'Complaint'}</h4>
                <p className="text-xs text-gray-500 truncate">{entry.complaintLocation}</p>
                <p className="text-xs text-gray-400 mt-1">{t('worker') || 'Worker'}: {entry.workerName}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleOpenReview(entry)} className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  {t('review') || 'Review'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {isModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 dark:text-white">{t('review_verification') || 'Review Verification'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <h4 className="font-bold text-gray-900 dark:text-white">{selectedEntry.complaintTitle}</h4>
                <p className="text-sm text-gray-500 mt-1">{selectedEntry.complaintLocation}</p>
                <p className="text-xs text-gray-400 mt-2">{t('worker') || 'Worker'}: {selectedEntry.workerName}</p>
              </div>

              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{t('evidence') || 'Evidence'}</h4>
              {evidenceList.length === 0 ? (
                <p className="text-gray-500 text-sm p-4 text-center">{t('no_evidence') || 'No evidence uploaded.'}</p>
              ) : (
                <div className="space-y-4">
                  {evidenceList.map((ev: any, idx: number) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                      {ev.imageUrl && <img src={ev.imageUrl} alt="Evidence" className="w-full max-h-80 object-contain bg-gray-100 dark:bg-gray-700" />}
                      <div className="p-3 bg-gray-50 dark:bg-gray-700/50">
                        <p className="text-sm text-gray-700 dark:text-gray-300">{ev.notes || 'No notes'}</p>
                        <p className="text-xs text-gray-400 mt-1">{ev.createdAt ? new Date(ev.createdAt.toMillis()).toLocaleString() : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex justify-between gap-3 flex-shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50">
                {t('close') || 'Close'}
              </button>
              <div className="flex gap-3">
                <button onClick={() => handleVerify('REJECTED')} disabled={reviewing} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2">
                  <ThumbsDown className="w-4 h-4" /> {t('reject') || 'Reject'}
                </button>
                <button onClick={() => handleVerify('ZONAL_APPROVED')} disabled={reviewing} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                  {reviewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  {t('approve') || 'Approve (Zonal)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZonalVerificationTab;
