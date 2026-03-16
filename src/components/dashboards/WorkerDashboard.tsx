import React, { useState, useEffect, useRef } from 'react';
import {
  ClipboardList, Camera, CheckCircle, GraduationCap,
  QrCode, BarChart3, Clock, Target,
  MapPin, X, Loader2, UserCircle, Settings,
  CalendarCheck, LogIn, LogOut, Calendar
} from 'lucide-react';

import { User } from '../../App';
import Layout from '../common/Layout';
import StatCard from '../common/StatCard';
import TrainingSystem from '../training/TrainingSystem';
import TrainingMaterialsViewer from '../training/TrainingMaterialsViewer';
import ProfilePage from '../common/ProfilePage';
import SettingsTab from './tabs/SettingsTab';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadToCloudinary } from '../../lib/cloudinary';

interface WorkerDashboardProps {
  user: User;
  onLogout: () => void;
}

// Data models for the joined assignment + complaint
interface EnrichedTask {
  assignmentId: string;
  complaintId: string;
  workerStatus: string;
  assignedAt: any;
  completedAt?: any;
  // Complaint data
  title: string;
  category: string;
  location: string;
  complaintStatus: string;
}

const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState<EnrichedTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Active task for proof submission
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);

  // Geo-tagged proof photos state
  interface GeoPhoto {
    file: File;
    preview: string;
    lat?: number;
    lng?: number;
    address?: string;
    geoLoading?: boolean;
  }
  const [proofPhotos, setProofPhotos] = useState<GeoPhoto[]>([]);
  const [proofDescription, setProofDescription] = useState('');
  const proofCameraInputRef = useRef<HTMLInputElement>(null);
  const proofGalleryInputRef = useRef<HTMLInputElement>(null);

  // Fetch tasks
  useEffect(() => {
    if (!user || !user.id) return;

    const q = query(collection(db, 'assignments'), where('workerId', '==', user.id));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const fetchedTasks: EnrichedTask[] = [];

        for (const docSnap of snapshot.docs) {
          const assignmentData = docSnap.data();
          const complaintRef = doc(db, 'complaints', assignmentData.complaintId);
          const complaintSnap = await getDoc(complaintRef);

          if (complaintSnap.exists()) {
            const complaintData = complaintSnap.data();
            fetchedTasks.push({
              assignmentId: docSnap.id,
              complaintId: assignmentData.complaintId,
              workerStatus: assignmentData.workerStatus,
              assignedAt: assignmentData.assignedAt,
              completedAt: assignmentData.completedAt,
              title: complaintData.title || complaintData.category,
              category: complaintData.category,
              location: complaintData.location,
              complaintStatus: complaintData.status
            });
          }
        }

        // Sort: IN_PROGRESS first, then ASSIGNED, then COMPLETED, then ZONAL_APPROVED, then VERIFIED
        fetchedTasks.sort((a, b) => {
          const rank: Record<string, number> = { 'IN_PROGRESS': 1, 'ASSIGNED': 2, 'COMPLETED': 3, 'ZONAL_APPROVED': 4, 'VERIFIED': 5 };
          const rankA = rank[a.workerStatus] || 6;
          const rankB = rank[b.workerStatus] || 6;
          return rankA - rankB;
        });

        setTasks(fetchedTasks);
      } catch (error) {
        console.error("Error fetching tasks:", error);
      } finally {
        setLoadingTasks(false);
      }
    });

    return () => unsubscribe();
  }, [user]);


  const handleStartTask = async (assignmentId: string) => {
    try {
      await updateDoc(doc(db, 'assignments', assignmentId), {
        workerStatus: 'IN_PROGRESS'
      });
    } catch (error) {
      console.error("Error starting task:", error);
      toastError("Failed to start task.");
    }
  };

  const handleGoToProof = (taskId: string) => {
    setSelectedTaskId(taskId);
    setProofPhotos([]);
    setActiveTab('proof');
  };

  const captureGpsForProof = (index: number) => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        let address = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`);
          const data = await res.json();
          if (data.display_name) address = data.display_name;
        } catch { /* fallback */ }
        setProofPhotos((prev) =>
          prev.map((p, i) =>
            i === index ? { ...p, lat: coords.latitude, lng: coords.longitude, address, geoLoading: false } : p
          )
        );
      },
      () => {
        setProofPhotos((prev) => prev.map((p, i) => (i === index ? { ...p, geoLoading: false } : p)));
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleProofPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per photo
    const files = Array.from(e.target.files || []);
    const remaining = 5 - proofPhotos.length;
    const startIndex = proofPhotos.length;
    const oversized = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (oversized) {
      toastError(`Photo "${oversized.name}" is too large (${(oversized.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB per photo.`);
      e.target.value = '';
      return;
    }
    const toAdd: GeoPhoto[] = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      geoLoading: true,
    }));
    setProofPhotos((prev) => [...prev, ...toAdd]);
    toAdd.forEach((_, i) => captureGpsForProof(startIndex + i));
    e.target.value = '';
  };

  const removeProofPhoto = (index: number) => {
    setProofPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmitProof = async () => {
    if (!selectedTaskId || proofPhotos.length === 0) return;

    const task = tasks.find(t => t.assignmentId === selectedTaskId);
    if (!task) return;

    setIsSubmittingProof(true);
    try {
      // 1. Upload first photo (can loop for all if needed, but schema only has 1 imageUrl currently)
      const file = proofPhotos[0].file; // Pick the first available photo
      const result = await uploadToCloudinary(file, { folder: 'evidence' });
      const imageUrl = result.secure_url;

      // 2. Create evidence record
      await addDoc(collection(db, 'completion_evidence'), {
        complaintId: task.complaintId,
        workerId: user.id,
        imageUrl,
        description: proofDescription.trim(),
        notes: `Completed at lat: ${proofPhotos[0].lat}, lng: ${proofPhotos[0].lng}`,
        createdAt: serverTimestamp()
      });

      // 3. Update assignment status
      await updateDoc(doc(db, 'assignments', task.assignmentId), {
        workerStatus: 'COMPLETED',
        completedAt: serverTimestamp()
      });

      toastSuccess("Proof submitted successfully! Awaiting Admin approval.");
      setProofPhotos([]);
      setProofDescription('');
      setSelectedTaskId(null);
      setActiveTab('tasks');
    } catch (error) {
      console.error("Error submitting proof:", error);
      toastError("Failed to submit proof. Please try again.");
    } finally {
      setIsSubmittingProof(false);
    }
  };


  // ── Digital ID handlers ──────────────────────────────────────────────────
  const handleSaveIdCard = () => {
    const printWindow = window.open('', '_blank', 'width=440,height=680');
    if (!printWindow) { toastError('Pop-up blocked. Please allow pop-ups to save the ID card.'); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>SafaiConnect ID – ${user.name}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#f0fdf4;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:system-ui,sans-serif}
  .card{width:340px;background:linear-gradient(135deg,#059669,#0f766e);border-radius:20px;overflow:hidden;color:#fff;box-shadow:0 20px 40px rgba(0,0,0,.25)}
  .hdr{padding:18px 22px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,.2)}
  .brand{font-weight:800;font-size:13px;letter-spacing:.06em}
  .badge{background:rgba(255,255,255,.2);padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.1em}
  .body{padding:18px 22px;display:flex;gap:16px;align-items:center}
  .avatar{width:68px;height:68px;border-radius:14px;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-size:32px;flex-shrink:0}
  .name{font-size:18px;font-weight:800;margin-bottom:4px}
  .role{color:#a7f3d0;font-size:12px}
  .meta{margin-top:8px;font-size:11px;color:rgba(255,255,255,.75);line-height:1.9}
  .meta b{color:#6ee7b7;margin-right:4px}
  .qr{margin:2px 22px 18px;background:#fff;border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center}
  .qr-img{width:52px;height:52px;background:repeating-linear-gradient(45deg,#111 0,#111 4px,#fff 4px,#fff 8px);border-radius:4px;flex-shrink:0}
  .qr h4{font-size:11px;font-weight:700;color:#374151;margin-bottom:4px}
  .qr p{font-size:10px;color:#9ca3af;font-family:monospace;word-break:break-all}
  .ftr{padding:10px 22px;display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.5)}
  @media print{body{background:#fff}.card{box-shadow:none}}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="brand">SAFAI CONNECT</div><div class="badge">OFFICIAL ID</div></div>
  <div class="body">
    <div class="avatar">&#128100;</div>
    <div><div class="name">${user.name}</div><div class="role">Field Worker</div>
    <div class="meta"><div><b>ID:</b>${(user.id || '').slice(-8).toUpperCase()}</div><div><b>Zone:</b>${user.assignedZone || 'Not Assigned'}</div><div><b>Email:</b>${user.email}</div></div></div>
  </div>
  <div class="qr"><div class="qr-img"></div><div><h4>Scan to verify identity</h4><p>${user.email}</p></div></div>
  <div class="ftr"><span>SafaiConnect — Empowering Sanitation Workers</span><span>Valid 2025-26</span></div>
</div>
<script>window.onload=()=>window.print();<\/script></body></html>`);
    printWindow.document.close();
  };

  const handleShareIdCard = async () => {
    const text = `SafaiConnect Official ID\nName: ${user.name}\nWorker ID: ${(user.id || '').slice(-8).toUpperCase()}\nZone: ${user.assignedZone || 'Not Assigned'}\nEmail: ${user.email}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'SafaiConnect Worker ID', text }); } catch { /* cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        toastSuccess('ID details copied to clipboard!');
      } catch {
        toastError('Sharing is not supported on this device.');
      }
    }
  };

  const sidebarItems = [
    { icon: <ClipboardList className="w-5 h-5" />, label: t('my_tasks'), active: activeTab === 'tasks', onClick: () => setActiveTab('tasks') },
    { icon: <Camera className="w-5 h-5" />, label: t('submit_proof'), active: activeTab === 'proof', onClick: () => { const inProgress = tasks.find(t => t.workerStatus === 'IN_PROGRESS'); if (inProgress && !selectedTaskId) { setSelectedTaskId(inProgress.assignmentId); setProofPhotos([]); } setActiveTab('proof'); } },
    { icon: <CheckCircle className="w-5 h-5" />, label: t('attendance'), active: activeTab === 'attendance', onClick: () => setActiveTab('attendance') },
    { icon: <QrCode className="w-5 h-5" />, label: t('digital_id'), active: activeTab === 'digitalid', onClick: () => setActiveTab('digitalid') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('training'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'tasks':
        const completedCount = tasks.filter(t => t.workerStatus === 'COMPLETED' || t.workerStatus === 'ZONAL_APPROVED' || t.workerStatus === 'VERIFIED').length;
        const inProgressCount = tasks.filter(t => t.workerStatus === 'IN_PROGRESS').length;

        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">My Tasks</h2>
              <p className="text-gray-600">Today's assigned tasks and progress</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Total Assigned" value={tasks.length.toString()} icon={<ClipboardList className="w-6 h-6" />} color="blue" />
              <StatCard title="Completed" value={completedCount.toString()} icon={<CheckCircle className="w-6 h-6" />} color="green" />
              <StatCard title="In Progress" value={inProgressCount.toString()} icon={<Clock className="w-6 h-6" />} color="yellow" />
              <StatCard title="Performance" value="Live" icon={<BarChart3 className="w-6 h-6" />} color="purple" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">Your Assignments</h3>
              </div>
              <div className="p-6">
                {loadingTasks ? (
                  <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
                ) : tasks.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">No tasks assigned to you right now.</div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => (
                      <div key={task.assignmentId} className={`border ${task.workerStatus === 'COMPLETED' || task.workerStatus === 'ZONAL_APPROVED' || task.workerStatus === 'VERIFIED' ? 'border-green-200 bg-green-50/30' : 'border-gray-200'} rounded-xl p-4 hover:shadow-md transition-shadow`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-semibold text-gray-900 line-clamp-1 max-w-[200px]">{task.title}</span>
                          </div>
                          <span className={`px-3 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full ${task.workerStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                            task.workerStatus === 'ZONAL_APPROVED' ? 'bg-teal-100 text-teal-800' :
                            task.workerStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                            task.workerStatus === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {task.workerStatus === 'VERIFIED' ? 'Verified' : task.workerStatus === 'ZONAL_APPROVED' ? 'Zonal Approved' : task.workerStatus.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="mb-4">
                          <p className="text-sm text-gray-600 flex items-start gap-1">
                            <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{task.location}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100/50">
                          <span className="text-xs text-gray-400">Assigned: {task.assignedAt ? new Date(task.assignedAt.toMillis()).toLocaleDateString() : 'N/A'}</span>

                          {task.workerStatus === 'ASSIGNED' && (
                            <button
                              onClick={() => handleStartTask(task.assignmentId)}
                              className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
                            >
                              Start Task
                            </button>
                          )}

                          {task.workerStatus === 'IN_PROGRESS' && (
                            <button
                              onClick={() => handleGoToProof(task.assignmentId)}
                              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm"
                            >
                              Submit Proof
                            </button>
                          )}

                          {(task.workerStatus === 'COMPLETED' || task.workerStatus === 'VERIFIED') && (
                            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" /> {task.workerStatus === 'VERIFIED' ? 'Verified ✓' : 'Awaiting Review'}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'proof':
        const activeProofTask = tasks.find(t => t.assignmentId === selectedTaskId);

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Submit Proof of Work</h2>
              <p className="text-gray-500">Verify your task completion with geo-tagged photos</p>
            </div>

            {/* Hidden Inputs - always rendered so refs work */}
            <input ref={proofCameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleProofPhotoChange} />
            <input ref={proofGalleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleProofPhotoChange} />

            {!selectedTaskId ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                {/* Photo Upload Section */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Photo Evidence
                    <span className="ml-2 text-xs font-normal text-gray-400">({proofPhotos.length}/5)</span>
                  </label>

                  {/* Photo preview grid */}
                  {proofPhotos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                      {proofPhotos.map((p, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={p.preview}
                            alt={`Proof ${i + 1}`}
                            className="w-full h-20 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeProofPhoto(i)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {p.geoLoading ? (
                            <div className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/60 text-white text-[9px] font-medium px-1 py-0.5 rounded">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              <span>GPS…</span>
                            </div>
                          ) : p.lat ? (
                            <div className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-green-600/90 text-white text-[9px] font-medium px-1 py-0.5 rounded max-w-[95%] overflow-hidden">
                              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{p.lat.toFixed(4)}, {p.lng?.toFixed(4)}</span>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload buttons */}
                  {proofPhotos.length < 5 && (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center">
                      <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 mb-1">Take a photo of your completed work</p>
                      <p className="text-xs text-gray-400 mb-4">Each photo is automatically geo-tagged with your GPS location</p>
                      <div className="flex gap-3 justify-center">
                        <button
                          type="button"
                          onClick={() => proofCameraInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          <Camera className="w-4 h-4" /> Camera
                        </button>
                        <button
                          type="button"
                          onClick={() => proofGalleryInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                        >
                          <span>🖼️</span> Gallery
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={4}
                    value={proofDescription}
                    onChange={(e) => setProofDescription(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200"
                    placeholder="Describe the work you completed..."
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={async () => {
                    if (proofPhotos.length === 0) { toastError('Please upload at least one photo.'); return; }
                    setIsSubmittingProof(true);
                    try {
                      const file = proofPhotos[0].file;
                      const result = await uploadToCloudinary(file, { folder: 'evidence' });
                      await addDoc(collection(db, 'completion_evidence'), {
                        workerId: user.id,
                        imageUrl: result.secure_url,
                        description: proofDescription.trim(),
                        notes: `Completed at lat: ${proofPhotos[0].lat}, lng: ${proofPhotos[0].lng}`,
                        createdAt: serverTimestamp()
                      });
                      toastSuccess('Proof submitted successfully!');
                      setProofPhotos([]);
                      setProofDescription('');
                    } catch (error) {
                      console.error('Error submitting proof:', error);
                      toastError('Failed to submit proof. Please try again.');
                    } finally {
                      setIsSubmittingProof(false);
                    }
                  }}
                  disabled={proofPhotos.length === 0 || isSubmittingProof}
                  className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 hover:shadow-green-300 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isSubmittingProof ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-5 h-5" />}
                  {isSubmittingProof ? 'Submitting...' : 'Submit Proof'}
                </button>
              </div>
            ) : (
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left Column: Task Context */}
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <ClipboardList className="w-24 h-24 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 relative z-10">Current Task</h3>
                    <div className="space-y-4 relative z-10">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</label>
                        <div className="flex items-start gap-2 mt-1">
                          <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <p className="font-medium text-gray-900">{activeProofTask?.location}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</label>
                        <p className="font-medium text-gray-900 mt-1">{activeProofTask?.title}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Target className="w-4 h-4 text-orange-600" />
                      </div>
                      <h4 className="font-semibold text-gray-900">Photo Requirements</h4>
                    </div>
                    <ul className="space-y-2.5">
                      {[
                        'Clear view of the cleaned area',
                        'GPS location must be enabled',
                        'Take photos from multiple angles',
                        'Include surrounding context'
                      ].map((req, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right Column: Upload Area */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900">Proof Photos</h3>
                      <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                        {proofPhotos.length}/5 Uploaded
                      </span>
                    </div>

                    {/* Upload Dropzone */}
                    {proofPhotos.length < 5 && (
                      <div className="mb-8">
                        <div className="border-2 border-dashed border-gray-200 hover:border-green-400 rounded-2xl p-8 transition-colors bg-gray-50/50 hover:bg-green-50/30 group text-center">
                          <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                            <Camera className="w-8 h-8 text-green-600" />
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">Capture Evidence</h4>
                          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-6">
                            Take clear photos of the completed task. Geo-location will be automatically added.
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                              type="button"
                              onClick={() => proofCameraInputRef.current?.click()}
                              className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium shadow-sm hover:shadow-md active:scale-95 duration-200"
                            >
                              <Camera className="w-5 h-5" /> Open Camera
                            </button>
                            <button
                              type="button"
                              onClick={() => proofGalleryInputRef.current?.click()}
                              className="inline-flex justify-center items-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm hover:shadow-md active:scale-95 duration-200"
                            >
                              <span>🖼️</span> Choose from Gallery
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Photo Grid */}
                    {proofPhotos.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4">
                        {proofPhotos.map((p, i) => (
                          <div key={i} className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-sm border border-gray-100 bg-gray-100">
                            <img src={p.preview} alt={`Proof ${i + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <button
                              type="button"
                              onClick={() => removeProofPhoto(i)}
                              className="absolute top-2 right-2 p-1.5 bg-white/90 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:scale-110 shadow-sm"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-2 left-2 right-2">
                              {p.geoLoading ? (
                                <div className="inline-flex items-center gap-1.5 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span className="font-medium">Acquiring GPS...</span>
                                </div>
                              ) : p.lat ? (
                                <div className="inline-flex items-center gap-1.5 bg-green-600/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg shadow-sm border border-green-500/50">
                                  <MapPin className="w-3 h-3" />
                                  <span className="font-medium truncate max-w-[120px]">
                                    {p.lat.toFixed(4)}, {p.lng?.toFixed(4)}
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 bg-red-500/90 text-white text-xs px-2 py-1 rounded-lg">
                                  <X className="w-3 h-3" /> <span>No GPS</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Description */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                      <textarea
                        rows={3}
                        value={proofDescription}
                        onChange={(e) => setProofDescription(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200"
                        placeholder="Describe the work you completed..."
                      />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
                      <button
                        onClick={() => setActiveTab('tasks')}
                        className="flex-1 px-6 py-3.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 focus:ring-4 focus:ring-gray-100 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitProof}
                        className="flex-[2] flex justify-center items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3.5 rounded-xl font-bold shadow-lg shadow-green-200 hover:shadow-green-300 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                        disabled={proofPhotos.length === 0 || isSubmittingProof}
                      >
                        {isSubmittingProof ? <Loader2 className="w-6 h-6 animate-spin" /> : null}
                        {isSubmittingProof ? 'Submitting...' : `Submit Verification (${proofPhotos.filter(p => !!p).length})`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'attendance':
        return <AttendanceTab workerId={user.id} workerName={user.name} />;
      case 'digitalid':
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('digital_id_title') || 'Digital Identity Card'}</h2>
              <p className="text-gray-500">{t('digital_id_subtitle') || 'Your official SafaiConnect field credential'}</p>
            </div>

            {/* ID Card */}
            <div className="flex justify-center">
              <div className="w-full max-w-sm">
                {/* Card Front */}
                <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl shadow-2xl overflow-hidden text-white">
                  {/* Card Header */}
                  <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/20">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="SafaiConnect" className="h-8 w-auto object-contain brightness-0 invert" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="font-bold text-sm tracking-wide">SAFAI CONNECT</span>
                    </div>
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold uppercase tracking-widest">Official ID</span>
                  </div>

                  {/* Card Body */}
                  <div className="px-6 py-5 flex items-center gap-5">
                    {/* Photo Placeholder */}
                    <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 border-2 border-white/40 overflow-hidden">
                      <UserCircle className="w-12 h-12 text-white/60" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xl font-bold truncate">{user.name}</p>
                      <p className="text-emerald-200 text-sm mt-0.5">
                        {user.role === 'worker' ? 'Field Worker' : user.role}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-white/80">
                          <span className="text-emerald-300 font-semibold">ID:</span>
                          <span className="font-mono">{user.id?.slice(-8).toUpperCase() || 'W-000001'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-white/80">
                          <span className="text-emerald-300 font-semibold">Zone:</span>
                          <span>{user.assignedZone || 'Assigned Zone'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* QR Code Area */}
                  <div className="mx-6 mb-5 mt-1 bg-white rounded-2xl p-4 flex items-center gap-4">
                    {/* Simulated QR Code */}
                    <div className="w-16 h-16 flex-shrink-0 grid grid-cols-5 gap-0.5">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div key={i} className={`rounded-sm ${[0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,7,12,17].includes(i) ? 'bg-gray-900' : 'bg-gray-100'}`} />
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">{t('qr_scan_label') || 'Scan to verify identity'}</p>
                      <p className="text-xs text-gray-400 mt-1 font-mono truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 pb-5 flex items-center justify-between text-xs text-white/60">
                    <span>{t('id_card_footer') || 'SafaiConnect — Empowering Sanitation Workers'}</span>
                    <span className="font-semibold">Valid 2025-26</span>
                  </div>
                </div>

                {/* Download/Print buttons */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSaveIdCard}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    Save ID Card
                  </button>
                  <button
                    onClick={handleShareIdCard}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Target className="w-4 h-4" />
                    Share
                  </button>
                </div>
              </div>
            </div>

            {/* Worker Details Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Employee Information</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: t('full_name') || 'Full Name', value: user.name },
                  { label: 'Worker ID', value: user.id?.slice(-8).toUpperCase() || 'W-000001' },
                  { label: t('email_address') || 'Email', value: user.email },
                  { label: t('assigned_zone') || 'Assigned Zone', value: user.assignedZone || 'Not assigned' },
                  { label: 'Designation', value: 'Sanitation Field Worker' },
                  { label: 'Status', value: 'Active' },
                ].map((row, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500 font-medium">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.label === 'Status' ? 'text-green-600 bg-green-50 px-3 py-1 rounded-full' : 'text-gray-900'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'training': return <WorkerTrainingWrapper user={user} />;
      case 'settings': return <SettingsTab user={user} />;
      case 'profile': return <ProfilePage user={user} />;
      default: return null;
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} sidebarItems={sidebarItems} onProfileClick={() => setActiveTab('profile')}>
      {renderContent()}
    </Layout>
  );
};

// ─── Attendance Sub-Component ────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  date: string;           // YYYY-MM-DD
  checkIn?: string;       // HH:MM
  checkOut?: string;
  status: 'present' | 'absent' | 'half_day';
  checkInTs?: any;
  checkOutTs?: any;
}

const AttendanceTab: React.FC<{ workerId: string; workerName: string }> = ({ workerId, workerName }) => {
  const { error: toastError } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const docId = (date: string) => `${workerId}_${date}`;

  // Real-time listener for this month's attendance
  useEffect(() => {
    const monthPrefix = today.slice(0, 7); // YYYY-MM
    const q = query(
      collection(db, 'attendance'),
      where('workerId', '==', workerId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const records: AttendanceRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.date?.startsWith(monthPrefix)) {
          records.push({ id: d.id, ...data } as AttendanceRecord);
        }
      });
      setMonthRecords(records);
      const rec = records.find(r => r.date === today) || null;
      setTodayRecord(rec);
      setLoading(false);
    });
    return () => unsub();
  }, [workerId, today]);

  const handleCheckIn = async () => {
    setActing(true);
    try {
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      await setDoc(doc(db, 'attendance', docId(today)), {
        workerId,
        workerName,
        date: today,
        checkIn: timeStr,
        checkInTs: serverTimestamp(),
        checkOut: null,
        checkOutTs: null,
        status: 'present',
      });
    } catch (e) {
      console.error('Check-in failed:', e);
      toastError('Check-in failed. Please try again.');
    } finally {
      setActing(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    setActing(true);
    try {
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      // Destructure to exclude the 'id' field which shouldn't be written to Firestore
      const { id, ...recordData } = todayRecord;
      await setDoc(doc(db, 'attendance', docId(today)), {
        ...recordData,
        checkOut: timeStr,
        checkOutTs: serverTimestamp(),
      });
    } catch (e) {
      console.error('Check-out failed:', e);
      toastError('Check-out failed. Please try again.');
    } finally {
      setActing(false);
    }
  };

  const presentCount = monthRecords.filter(r => r.status === 'present' || r.status === 'half_day').length;
  const attendanceRate = daysInMonth > 0 ? Math.round((presentCount / Math.min(now.getDate(), daysInMonth)) * 100) : 0;

  const getStatusForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = monthRecords.find(r => r.date === dateStr);
    const d = new Date(year, month, day);
    const isFuture = d > now;
    const isToday = dateStr === today;
    if (!rec) return isFuture ? 'future' : isToday ? 'today' : 'absent';
    return rec.status;
  };

  const dayColors: Record<string, string> = {
    present:  'bg-green-500 text-white',
    half_day: 'bg-yellow-400 text-white',
    absent:   'bg-red-100 text-red-400',
    future:   'bg-gray-50 text-gray-300',
    today:    'bg-blue-100 text-blue-600 ring-2 ring-blue-400 font-bold',
  };

  const isCheckedIn = !!todayRecord?.checkIn;
  const isCheckedOut = !!todayRecord?.checkOut;

  // Time-based check-out: Only show button after minimum shift duration (4 hours)
  const MIN_SHIFT_HOURS = 4;
  const canCheckOut = (() => {
    if (!isCheckedIn || isCheckedOut || !todayRecord?.checkInTs) return false;
    try {
      const checkInTime = typeof todayRecord.checkInTs.toDate === 'function'
        ? todayRecord.checkInTs.toDate()
        : new Date(todayRecord.checkInTs);
      const hoursElapsed = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
      return hoursElapsed >= MIN_SHIFT_HOURS;
    } catch {
      return true; // Allow checkout if timestamp can't be parsed
    }
  })();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Attendance</h2>
        <p className="text-gray-500">Track your daily check-in / check-out — {monthName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Days Present"
          value={loading ? '...' : presentCount.toString()}
          icon={<CalendarCheck className="w-6 h-6" />}
          trend={{ value: `of ${now.getDate()} worked days`, isPositive: true }}
          color="green"
        />
        <StatCard
          title="Attendance Rate"
          value={loading ? '...' : `${attendanceRate}%`}
          icon={<BarChart3 className="w-6 h-6" />}
          trend={{ value: 'This month', isPositive: attendanceRate >= 80 }}
          color={attendanceRate >= 80 ? 'green' : 'yellow'}
        />
        <StatCard
          title="Today's Status"
          value={isCheckedOut ? 'Done' : isCheckedIn ? 'On Duty' : 'Not Checked In'}
          icon={<Clock className="w-6 h-6" />}
          color={isCheckedOut ? 'green' : isCheckedIn ? 'blue' : 'yellow'}
        />
      </div>

      {/* Today's check-in card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 rounded-xl ${isCheckedOut ? 'bg-green-100' : isCheckedIn ? 'bg-blue-100' : 'bg-orange-100'}`}>
            <CalendarCheck className={`w-5 h-5 ${isCheckedOut ? 'text-green-600' : isCheckedIn ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Today — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <p className="text-sm text-gray-500">
              {isCheckedOut
                ? `Checked out at ${todayRecord?.checkOut}`
                : isCheckedIn
                  ? `On duty since ${todayRecord?.checkIn}`
                  : 'You have not checked in yet'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Check In */}
            <div className={`flex-1 p-5 rounded-2xl border-2 ${isCheckedIn ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${isCheckedIn ? 'bg-green-100' : 'bg-white border border-gray-200'}`}>
                  <LogIn className={`w-5 h-5 ${isCheckedIn ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Check In</p>
                  <p className="text-sm text-gray-500">
                    {isCheckedIn ? `Marked at ${todayRecord?.checkIn}` : 'Mark your arrival'}
                  </p>
                </div>
              </div>
              {!isCheckedIn && (
                <button
                  onClick={handleCheckIn}
                  disabled={acting}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  Check In Now
                </button>
              )}
              {isCheckedIn && (
                <div className="flex items-center justify-center gap-2 py-2 text-green-700 font-semibold">
                  <CheckCircle className="w-5 h-5" /> Checked In at {todayRecord?.checkIn}
                </div>
              )}
            </div>

            {/* Check Out */}
            <div className={`flex-1 p-5 rounded-2xl border-2 ${isCheckedOut ? 'border-blue-200 bg-blue-50' : isCheckedIn ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl ${isCheckedOut ? 'bg-blue-100' : isCheckedIn ? 'bg-orange-100' : 'bg-white border border-gray-200'}`}>
                  <LogOut className={`w-5 h-5 ${isCheckedOut ? 'text-blue-600' : isCheckedIn ? 'text-orange-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Check Out</p>
                  <p className="text-sm text-gray-500">
                    {isCheckedOut ? `Marked at ${todayRecord?.checkOut}` : isCheckedIn ? 'Mark your departure' : 'Check in first'}
                  </p>
                </div>
              </div>
              {!isCheckedOut && isCheckedIn && (
                <button
                  onClick={handleCheckOut}
                  disabled={acting || !canCheckOut}
                  className="w-full py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  {!canCheckOut ? `Available after ${MIN_SHIFT_HOURS}h shift` : 'Check Out Now'}
                </button>
              )}
              {isCheckedOut && (
                <div className="flex items-center justify-center gap-2 py-2 text-blue-700 font-semibold">
                  <CheckCircle className="w-5 h-5" /> Checked Out at {todayRecord?.checkOut}
                </div>
              )}
              {!isCheckedIn && !isCheckedOut && (
                <div className="flex items-center justify-center py-2 text-gray-400 text-sm">Check in to enable</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Monthly Calendar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Monthly Calendar — {monthName}</h3>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-3">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {/* offset for first day of month */}
          {Array.from({ length: new Date(year, month, 1).getDay() }).map((_, i) => (
            <div key={`offset-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const status = getStatusForDay(day);
            return (
              <div
                key={day}
                title={status}
                className={`aspect-square flex items-center justify-center rounded-lg text-sm transition-all ${dayColors[status] || 'bg-gray-100 text-gray-500'}`}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-5 pt-4 border-t border-gray-100">
          {[
            { color: 'bg-green-500', label: 'Present' },
            { color: 'bg-yellow-400', label: 'Half Day' },
            { color: 'bg-red-100', label: 'Absent' },
            { color: 'bg-blue-100 ring-2 ring-blue-400', label: 'Today' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className={`w-3.5 h-3.5 rounded ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Attendance Log */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Recent Attendance Log</h3>
        </div>
        <div className="divide-y divide-gray-50">
          {monthRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No attendance records for this month yet.</div>
          ) : (
            [...monthRecords]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 10)
              .map(rec => (
                <div key={rec.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${rec.status === 'present' ? 'bg-green-500' : rec.status === 'half_day' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {rec.checkIn ? `In: ${rec.checkIn}` : 'No check-in'}
                        {rec.checkOut ? ` · Out: ${rec.checkOut}` : rec.checkIn ? ' · Not checked out' : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${rec.status === 'present' ? 'bg-green-100 text-green-700' : rec.status === 'half_day' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {rec.status.replace('_', ' ')}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};

// ── Worker Training Wrapper (sub-tabs: Exercises + Materials) ────────────────
const WorkerTrainingWrapper: React.FC<{ user: User }> = ({ user }) => {
  const [subTab, setSubTab] = useState<'exercises' | 'materials'>('exercises');
  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        {[
          { key: 'exercises' as const, label: 'Training Exercises' },
          { key: 'materials' as const, label: 'Training Materials' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              subTab === tab.key
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {subTab === 'exercises' ? <TrainingSystem user={user} /> : <TrainingMaterialsViewer />}
    </div>
  );
};

export default WorkerDashboard;