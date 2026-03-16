import React, { useState, useRef } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { addDoc, collection, serverTimestamp, query, where, onSnapshot, doc, updateDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { uploadToCloudinary } from '../../lib/cloudinary';
import {
  ClipboardList,
  Calendar,
  GraduationCap,
  Camera,
  Clock,
  CheckCircle,
  Star,
  Mic,
  MicOff,
  Volume2,
  MapPin,
  X,
  Loader2,
  UserCircle,
  LayoutDashboard,
  AlertTriangle,
  History,
  Settings,
  Truck,
  PhoneCall,
  CalendarPlus,
  Trophy,
  Award,
  ScanLine,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import Layout from '../common/Layout';
import TrainingSystem from '../training/TrainingSystem';
import ProfilePage from '../common/ProfilePage';
import SettingsTab from './tabs/SettingsTab';
import WasteScannerTab from './citizen/WasteScannerTab';
import RecyclingLocatorTab from './citizen/RecyclingLocatorTab';
import { User } from '../../App';
import StatCard from '../common/StatCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSpeechToText } from '../../hooks/useSpeechToText';
import { useAuth } from '../../contexts/AuthContext';
import { useCascadingLocation } from '../../hooks/useCascadingLocation';
import { useAutoWardDetection } from '../../hooks/useAutoWardDetection';


interface CitizenDashboardProps {
  user: User;
  onLogout: () => void;
  isChampion?: boolean;
}

// Self-contained Speech Recognition type shim (avoids needing @types/dom-speech-recognition)
interface ISpeechRecognitionResult { readonly length: number;[index: number]: { transcript: string } }
interface ISpeechRecognitionEvent { readonly results: ISpeechRecognitionResult[] }
interface ISpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

// Add StatusBadge component logic outside the main component or inside as a helper
const StatusBadge = ({ status }: { status: string }) => {
  const normalizedStatus = status.toUpperCase();

  if (normalizedStatus === 'RESOLVED' || normalizedStatus === 'CLOSED') {
    return (
      <span className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-green-100 text-green-800">
        {status.replace('_', ' ')}
      </span>
    );
  }
  if (normalizedStatus === 'SUBMITTED') {
    return (
      <span className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-purple-100 text-purple-800">
        {status.replace('_', ' ')}
      </span>
    );
  }
  if (normalizedStatus === 'ZONAL_APPROVED') {
    return (
      <span className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-teal-100 text-teal-800">
        ZONAL APPROVED
      </span>
    );
  }
  return (
    <span className="px-3 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full bg-yellow-100 text-yellow-800">
      {status.replace('_', ' ')}
    </span>
  );
};

const CitizenDashboard: React.FC<CitizenDashboardProps> = ({ user, onLogout, isChampion = false }) => {
  const { userProfile } = useAuth();
  const { error: toastError, warning: toastWarning, info: toastInfo, success: toastSuccess } = useToast();
  const [activeTab, setActiveTab] = useState('home'); // Changed default to 'home' to match new key
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ward selection for complaint routing
  const locationSelector = useCascadingLocation();
  const wardDetection = useAutoWardDetection();
  const [manualWardMode, setManualWardMode] = useState(false);

  // When pending auto-detection completes (data loaded after GPS), apply results
  React.useEffect(() => {
    if (wardDetection.detected && !manualWardMode) {
      const r = wardDetection.detected;
      locationSelector.setSelectedCityId(r.cityId);
      setTimeout(() => {
        locationSelector.setSelectedZoneId(r.zoneId);
        setTimeout(() => {
          locationSelector.setSelectedWardId(r.wardId);
        }, 300);
      }, 300);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardDetection.detected]);

  // ── Draft key is per-user so different accounts don't share drafts ──────
  const DRAFT_KEY = `draft_complaint_${user?.id}`;
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [submitError, setSubmitError] = useState('');
  const { t, language } = useLanguage();
  const { isListening, startStop: toggleMic } = useSpeechToText(
    language,
    (transcript) => setDescription((prev) => prev ? `${prev} ${transcript}` : transcript),
  );

  interface Complaint {
    id: string;
    title: string;
    category: string;
    location: string;
    status: string;
    date: any;
  }
  const [myComplaints, setMyComplaints] = useState<Complaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);

  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [complaintToRate, setComplaintToRate] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [ratingNotes, setRatingNotes] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  React.useEffect(() => {
    if (!user) return; // Removed activeTab !== 'track' check so it loads on mount
    setLoadingComplaints(true);
    const q = query(collection(db, 'complaints'), where('citizenId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Complaint[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          title: data.title || data.category || 'Unknown Issue',
          category: data.category || 'General',
          location: data.location || 'Unknown Location',
          status: data.status || 'SUBMITTED',
          date: data.createdAt
        });
      });
      fetched.sort((a, b) => (b.date?.toMillis() || 0) - (a.date?.toMillis() || 0));
      setMyComplaints(fetched);
      setLoadingComplaints(false);
    }, () => {
      setLoadingComplaints(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Load training progress for stats from Firestore
  const [trainingProgress, setTrainingProgress] = useState(0);

  // ----------- Champion Hub state (only used when isChampion=true) -----------
  const [leaderboard, setLeaderboard] = useState<Array<{
    id: string; name: string; rewardPoints: number;
  }>>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  React.useEffect(() => {
    if (!isChampion) return;
    setLeaderboardLoading(true);
    const q = query(
      collection(db, 'users'),
      orderBy('rewardPoints', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, snap => {
      setLeaderboard(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Anonymous',
        rewardPoints: d.data().rewardPoints || 0,
      })));
      setLeaderboardLoading(false);
    }, () => {
      setLeaderboardLoading(false);
    });
    return () => unsub();
  }, [isChampion]);

  const championBadges = React.useMemo(() => {
    if (!isChampion) return [];
    const userRankForBadge = leaderboard.findIndex(e => e.id === user.id) + 1;
    return [
      { id: 'comm-leader', icon: '🌿', label: 'Community Leader', desc: 'Submit 20+ reports', unlocked: myComplaints.length >= 20 },
      { id: 'eco-warrior', icon: '♻️', label: 'Eco Warrior', desc: '10 issues resolved', unlocked: myComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length >= 10 },
      { id: 'train-master', icon: '🎓', label: 'Training Master', desc: 'Complete all training', unlocked: trainingProgress >= 100 },
      { id: 'top-champ', icon: '🏆', label: 'Top Champion', desc: 'Reach leaderboard top 3', unlocked: userRankForBadge > 0 && userRankForBadge <= 3 },
    ];
  }, [isChampion, myComplaints, trainingProgress, leaderboard, user.id]);

  React.useEffect(() => {
    if (!user) return;
    const trainingDocRef = doc(db, 'training', user.id);
    const unsubscribe = onSnapshot(trainingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const completedModules = data.completedModules || [];
        // Assuming 4 modules for Citizen as a default base for the percentage
        const totalCitizenModules = 4;
        const percentage = Math.round((completedModules.length / totalCitizenModules) * 100);
        setTrainingProgress(Math.min(percentage, 100)); // Cap at 100
      } else {
        setTrainingProgress(0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // ── Restore draft when user lands on the report tab ─────────────────────
  React.useEffect(() => {
    if (activeTab !== 'report') return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved) as { issueType?: string; description?: string; location?: string };
      if (draft.issueType || draft.description || draft.location) {
        if (draft.issueType) setIssueType(draft.issueType);
        if (draft.description) setDescription(draft.description);
        toastInfo('Draft restored — your previous report was recovered.');
      }
    } catch { /* ignore corrupt draft */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ issueType, description }));
      toastSuccess('Draft saved! Your progress is stored locally.');
    } catch {
      toastError('Could not save draft. Storage may be full.');
    }
  };

  const handleOpenRating = (complaintId: string) => {
    setComplaintToRate(complaintId);
    setRating(0);
    setRatingNotes('');
    setRatingModalOpen(true);
  };

  const handleSubmitRating = async () => {
    if (!complaintToRate || rating === 0) return;
    setIsSubmittingRating(true);
    try {
      await addDoc(collection(db, 'ratings'), {
        complaintId: complaintToRate,
        citizenId: user.id,
        rating,
        notes: ratingNotes,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'complaints', complaintToRate), {
        status: 'CLOSED',
        updatedAt: serverTimestamp()
      });

      setRatingModalOpen(false);
      setComplaintToRate(null);
    } catch (e) {
      console.error("Error submitting rating", e);
      toastError("Failed to submit rating");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // ----------- Multi-photo state -----------
  interface GeoPhoto {
    file: File;
    preview: string;
    lat?: number;
    lng?: number;
    address?: string;
    geoLoading?: boolean;
  }
  const [photos, setPhotos] = useState<GeoPhoto[]>([]);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Capture GPS coords silently when a photo is added
  const captureGpsForPhoto = async (index: number) => {
    try {
      let latitude, longitude;

      // Use Native Geolocation if on mobile
      if (Capacitor.isNativePlatform()) {
        const permission = await CapGeolocation.checkPermissions();
        if (permission.location !== 'granted') {
          await CapGeolocation.requestPermissions();
        }
        const position = await CapGeolocation.getCurrentPosition({ enableHighAccuracy: true });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        // Fallback to web HTML5 Geolocation
        if (!navigator.geolocation) throw new Error("No GPS available");
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        if (data.display_name) address = data.display_name;
      } catch { /* fallback to coords */ }

      setPhotos((prev) =>
        prev.map((p, i) =>
          i === index
            ? { ...p, lat: latitude, lng: longitude, address, geoLoading: false }
            : p
        )
      );
    } catch (e) {
      console.warn("GPS capture failed", e);
      // Mark as done without coords
      setPhotos((prev) =>
        prev.map((p, i) => (i === index ? { ...p, geoLoading: false } : p))
      );
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB per photo
    const files = Array.from(e.target.files || []);
    const remaining = 5 - photos.length;
    const startIndex = photos.length;
    const oversized = files.find((f) => f.size > MAX_PHOTO_BYTES);
    if (oversized) {
      toastWarning(`Photo "${oversized.name}" is too large (${(oversized.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB per photo.`);
      e.target.value = '';
      return;
    }
    const toAdd: GeoPhoto[] = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      geoLoading: true,
    }));
    setPhotos((prev) => [...prev, ...toAdd]);
    // Capture GPS for each new photo
    toAdd.forEach((_, i) => captureGpsForPhoto(startIndex + i));
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ----------- GPS location state -----------
  const [location, setLocation] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      let latitude, longitude;

      if (Capacitor.isNativePlatform()) {
        const permission = await CapGeolocation.checkPermissions();
        if (permission.location !== 'granted') {
          await CapGeolocation.requestPermissions();
        }
        const position = await CapGeolocation.getCurrentPosition({ enableHighAccuracy: true });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } else {
        if (!navigator.geolocation) {
          toastWarning('Geolocation is not supported by your browser.');
          setLocationLoading(false);
          return;
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      }

      let cityHint = '';
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        setLocation(data.display_name || `${latitude}, ${longitude}`);
        // Extract city name for ward detection fallback
        cityHint = data.address?.city || data.address?.town || data.address?.state_district || '';
      } catch {
        setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
      }

      // Auto-detect ward/zone/city from GPS coordinates
      const result = wardDetection.detectWard(latitude, longitude, cityHint);
      if (result) {
        locationSelector.setSelectedCityId(result.cityId);
        setTimeout(() => {
          locationSelector.setSelectedZoneId(result.zoneId);
          setTimeout(() => {
            locationSelector.setSelectedWardId(result.wardId);
          }, 300);
        }, 300);
        setManualWardMode(false);
      }
    } catch (e) {
      console.warn('Unable to fetch location', e);
      toastWarning('Unable to fetch location. Please allow location access.');
    } finally {
      setLocationLoading(false);
    }
  };

  // ----------- Voice – Read Aloud for Dashboard summary -----------
  const readAloud = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const summary =
      language === 'ur'
        ? `آپ نے ${myComplaints.length} رپورٹیں جمع کی ہیں۔ ${myComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length} مسائل حل ہوچکے ہیں۔ ٹریننگ پروگریس ${trainingProgress} فیصد ہے۔`
        : language === 'sd'
          ? `توهان ${myComplaints.length} رپورٽون جمع ڪيون آهن. ${myComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length} مسئلا حل ٿيا آهن. ٽريننگ پروگريس ${trainingProgress} سيڪڙو آهي.`
          : `You have submitted ${myComplaints.length} reports. ${myComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length} issues have been resolved. Training progress is at ${trainingProgress} percent.`;

    const utterance = new SpeechSynthesisUtterance(summary);
    utterance.lang =
      language === 'ur' ? 'ur-PK' : language === 'sd' ? 'sd' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!issueType) {
      setSubmitError('Please select an issue type.');
      return;
    }
    if (!locationSelector.selectedWardId && !wardDetection.detected) {
      setSubmitError('Please detect your location or manually select your ward.');
      return;
    }
    if (!location) {
      setSubmitError('Please provide a location.');
      return;
    }
    if (!description.trim()) {
      setSubmitError('Please provide a description.');
      return;
    }

    setIsSubmitting(true);

    // Helper to add timeout to promises
    const withTimeout = <T,>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
      ]);
    };

    try {
      let imageUrl = null;

      // Only upload the first photo for now to simplify, or join multiple if needed. 
      // The schema currently supports a single imageUrl, so we take the first.
      if (photos.length > 0 && photos[0].file) {
        const file = photos[0].file;
        const result = await withTimeout(
          uploadToCloudinary(file, { folder: 'complaints' }),
          30000,
          'Image upload timed out. Please check your connection and try again.'
        );
        imageUrl = result.secure_url;
      }

      // Grab GPS coords from the first geo-tagged photo (if any)
      const geoPhoto = photos.find(p => p.lat != null);

      // Get ward/zone/city names for display (prefer manual selection, fallback to auto-detected)
      const det = wardDetection.detected;
      const finalCityId = locationSelector.selectedCityId || det?.cityId || '';
      const finalZoneId = locationSelector.selectedZoneId || det?.zoneId || '';
      const finalWardId = locationSelector.selectedWardId || det?.wardId || '';
      const finalCityName = locationSelector.cities.find(c => c.id === finalCityId)?.name || det?.cityName || '';
      const finalZoneName = locationSelector.zones.find(z => z.id === finalZoneId)?.name || det?.zoneName || '';
      const finalWardName = locationSelector.wards.find(w => w.id === finalWardId)?.name || det?.wardName || '';

      const complaintData: Record<string, any> = {
        title: issueType,
        description: description.trim(),
        category: issueType,
        location: location,
        status: 'SUBMITTED',
        citizenId: user.id,
        citizenName: user.name || '',
        imageUrl: imageUrl,
        cityId: finalCityId,
        cityName: finalCityName,
        zoneId: finalZoneId,
        zoneName: finalZoneName,
        wardId: finalWardId,
        wardName: finalWardName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(geoPhoto?.lat != null && geoPhoto?.lng != null && {
          lat: geoPhoto.lat,
          lng: geoPhoto.lng,
        }),
      };

      await withTimeout(addDoc(collection(db, 'complaints'), complaintData), 15000, 'Failed to save complaint. Please try again.');

      setSubmitSuccess('Your complaint has been successfully submitted!');
      // Clear draft and reset form
      localStorage.removeItem(DRAFT_KEY);
      setIssueType('');
      setDescription('');
      setLocation('');
      setPhotos([]);
      locationSelector.setSelectedCityId('');
      locationSelector.setSelectedZoneId('');
      locationSelector.setSelectedWardId('');
      wardDetection.clearDetected();
      setManualWardMode(false);

      // Clear success message after 4s
      setTimeout(() => setSubmitSuccess(''), 4000);

    } catch (err: any) {
      console.error("Error submitting complaint:", err);
      setSubmitError(err.message || 'Failed to submit complaint. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sidebarItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: t('nav_home'), active: activeTab === 'home', onClick: () => setActiveTab('home') },
    ...(isChampion ? [{ icon: <Trophy className="w-5 h-5 text-yellow-500" />, label: t('champion_hub'), active: activeTab === 'champion', onClick: () => setActiveTab('champion') }] : []),
    { icon: <Truck className="w-5 h-5" />, label: 'Book Collection', active: activeTab === 'collection', onClick: () => setActiveTab('collection') },
    { icon: <ScanLine className="w-5 h-5" />, label: 'Waste Scanner', active: activeTab === 'scanner', onClick: () => setActiveTab('scanner') },
    { icon: <MapPin className="w-5 h-5" />, label: 'Recycling Locator', active: activeTab === 'locator', onClick: () => setActiveTab('locator') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('nav_education'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <AlertTriangle className="w-5 h-5" />, label: t('nav_report'), active: activeTab === 'report', onClick: () => setActiveTab('report') },
    { icon: <History className="w-5 h-5" />, label: t('nav_track'), active: activeTab === 'track', onClick: () => setActiveTab('track') },
    { icon: <Trophy className="w-5 h-5" />, label: t('nav_rewards'), active: activeTab === 'rewards', onClick: () => setActiveTab('rewards') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];

  const renderContent = () => {
    const resolvedCount = myComplaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length;
    const progressCount = myComplaints.filter(c => ['ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW'].includes(c.status)).length;
    const totalReports = myComplaints.length;
    const areaScore = totalReports > 0 ? ((resolvedCount / totalReports) * 10).toFixed(1) : 'N/A';
    const recentReports = myComplaints.slice(0, 3); // Top 3 most recent
    const totalPoints = totalReports * 10 + resolvedCount * 50 + Math.floor(trainingProgress / 25) * 25;

    switch (activeTab) {
      case 'home':
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-1">{t('citizen_dashboard_title')}</h2>
                <p className="text-gray-600">{t('citizen_dashboard_subtitle')}</p>
              </div>
              <button
                onClick={readAloud}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors border border-blue-200"
                title={t('read_aloud')}
              >
                <Volume2 className="w-4 h-4" />
                {t('read_aloud')}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title={t('stat_reports')}
                value={totalReports.toString()}
                icon={<ClipboardList className="w-6 h-6" />}
                trend={{ value: progressCount > 0 ? `${progressCount} in progress` : 'All clear', isPositive: true }}
                color="blue"
              />
              <StatCard
                title={t('stat_resolved')}
                value={resolvedCount.toString()}
                icon={<Star className="w-6 h-6" />}
                trend={{ value: totalReports > 0 ? `${Math.round((resolvedCount / totalReports) * 100)}%` : '0%', isPositive: true }}
                color="green"
              />
              <StatCard
                title={t('stat_training')}
                value={`${trainingProgress}%`}
                icon={<GraduationCap className="w-6 h-6" />}
                trend={{ value: trainingProgress >= 100 ? 'Complete!' : 'In progress', isPositive: true }}
                color="yellow"
              />
              <div
                onClick={() => setActiveTab('rewards')}
                className="cursor-pointer"
                title="View Rewards"
              >
                <StatCard
                  title={t('stat_points')}
                  value={totalPoints.toString()}
                  icon={<Trophy className="w-6 h-6" />}
                  trend={{ value: '🏆 View badges', isPositive: true }}
                  color="purple"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">{t('recent_reports')}</h3>
                <button
                  onClick={() => setActiveTab('track')}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {recentReports.length > 0 ? (
                  recentReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex-1 mr-4 overflow-hidden">
                        <p className="font-medium text-gray-900 truncate">{report.title}</p>
                        <p className="text-sm text-gray-500">{report.id.substring(0, 8)} • {report.date ? new Date(report.date.toMillis()).toLocaleDateString() : 'N/A'}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${['RESOLVED', 'CLOSED'].includes(report.status)
                        ? 'bg-green-100 text-green-800'
                        : ['ASSIGNED', 'IN_PROGRESS'].includes(report.status)
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                        }`}>
                        {report.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500">No recent reports found.</div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{t('area_score_title')}</h3>
                  <p className="text-blue-100">{t('area_performing_well')}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{areaScore === 'N/A' ? '--' : `${areaScore}/10`}</div>
                  <div className="text-blue-100">{t('this_week')}</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'report':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('report_title')}</h2>
              <p className="text-gray-600">{t('report_subtitle')}</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {submitSuccess && (
                <div className="mb-6 p-4 bg-green-50 text-green-800 rounded-xl flex items-center gap-3 border border-green-200">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <p className="font-medium">{submitSuccess}</p>
                </div>
              )}
              {submitError && (
                <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-xl flex items-center gap-3 border border-red-200">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <p className="font-medium">{submitError}</p>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleSubmitReport}>
                {/* Auto-detected Ward / Zone — with manual override */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-800">
                      {wardDetection.detected ? '📍 Ward auto-detected from your location' : 'Ward / Zone for complaint routing'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setManualWardMode(!manualWardMode)}
                      className="text-xs text-blue-600 underline hover:text-blue-800"
                    >
                      {manualWardMode ? 'Use auto-detect' : 'Select manually'}
                    </button>
                  </div>

                  {/* Auto-detected display */}
                  {!manualWardMode && wardDetection.detected && (
                    <div className="flex items-center gap-3 bg-white border border-green-200 rounded-lg p-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <div className="text-sm">
                        <span className="font-semibold text-gray-900">{wardDetection.detected.wardName}</span>
                        <span className="text-gray-500"> · {wardDetection.detected.zoneName} · {wardDetection.detected.cityName}</span>
                        {wardDetection.detected.distanceKm != null && (
                          <span className="text-xs text-gray-400 ml-2">({wardDetection.detected.distanceKm} km away)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {!manualWardMode && wardDetection.detecting && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Detecting your ward...</span>
                    </div>
                  )}

                  {!manualWardMode && !wardDetection.detected && !wardDetection.detecting && (
                    <p className="text-xs text-gray-500">Click "Detect Location" below to auto-detect your ward, or select manually.</p>
                  )}

                  {/* Manual override dropdowns */}
                  {manualWardMode && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                        <select
                          value={locationSelector.selectedCityId}
                          onChange={(e) => locationSelector.setSelectedCityId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 text-sm"
                        >
                          <option value="">Select City</option>
                          {locationSelector.cities.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Zone</label>
                        <select
                          value={locationSelector.selectedZoneId}
                          onChange={(e) => locationSelector.setSelectedZoneId(e.target.value)}
                          disabled={!locationSelector.selectedCityId}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 text-sm disabled:opacity-50"
                        >
                          <option value="">Select Zone</option>
                          {locationSelector.zones.map((z) => (
                            <option key={z.id} value={z.id}>{z.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ward</label>
                        <select
                          value={locationSelector.selectedWardId}
                          onChange={(e) => locationSelector.setSelectedWardId(e.target.value)}
                          disabled={!locationSelector.selectedZoneId}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-100 text-sm disabled:opacity-50"
                        >
                          <option value="">Select Ward</option>
                          {locationSelector.wards.map((w) => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('issue_type')}
                  </label>
                  <select
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200"
                  >
                    <option value="">{t('select_issue_type')}</option>
                    <option value="Overflowing Bin">{t('overflowing_bin')}</option>
                    <option value="Missed Collection">{t('missed_collection')}</option>
                    <option value="Illegal Dumping">{t('illegal_dumping')}</option>
                    <option value="Damaged Bin">{t('damaged_bin')}</option>
                    <option value="Other">{t('other')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('location')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200"
                      placeholder={t('location_placeholder')}
                    />
                    <button
                      type="button"
                      onClick={fetchLocation}
                      disabled={locationLoading}
                      title="Use my current location"
                      className="flex items-center gap-2 px-4 py-3 bg-green-50 border-2 border-green-200 text-green-700 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-60"
                    >
                      {locationLoading
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : <MapPin className="w-5 h-5" />}
                      <span className="text-sm font-medium hidden sm:inline">
                        {locationLoading ? 'Fetching…' : 'Auto-detect'}
                      </span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('description')}
                  </label>
                  <div className="relative">
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-3 pr-14 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200"
                      placeholder={t('description_placeholder')}
                    />
                    {/* Microphone button */}
                    <button
                      type="button"
                      onClick={toggleMic}
                      title={isListening ? t('listening') : t('speak_description')}
                      className={`absolute top-3 right-3 p-2 rounded-lg transition-all duration-200 ${isListening
                        ? 'bg-red-100 text-red-600 animate-pulse'
                        : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                        }`}
                    >
                      {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>
                  </div>
                  {isListening && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
                      {t('listening')}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    {t('photo_evidence')}
                    <span className="ml-2 text-xs font-normal text-gray-400">({photos.length}/5)</span>
                  </label>

                  {/* Photo preview grid */}
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
                      {photos.map((p, i) => (
                        <div key={i} className="relative group">
                          <img
                            src={p.preview}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-20 object-cover rounded-lg border border-gray-200"
                          />
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => removePhoto(i)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          {/* Geo-tag badge */}
                          {p.geoLoading ? (
                            <div className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/60 text-white text-[9px] font-medium px-1 py-0.5 rounded">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              <span>GPS…</span>
                            </div>
                          ) : p.lat ? (
                            <div
                              className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-green-600/90 text-white text-[9px] font-medium px-1 py-0.5 rounded cursor-help max-w-[95%] overflow-hidden"
                              title={p.address || `${p.lat?.toFixed(5)}, ${p.lng?.toFixed(5)}`}
                            >
                              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{p.lat.toFixed(4)}, {p.lng?.toFixed(4)}</span>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload buttons */}
                  {photos.length < 5 && (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center">
                      <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 mb-1">{t('take_photo')}</p>
                      <p className="text-xs text-gray-400 mb-4">Each photo is automatically geo-tagged with your GPS location</p>
                      <div className="flex gap-3 justify-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                const image = await CapCamera.getPhoto({
                                  quality: 90,
                                  allowEditing: false,
                                  resultType: CameraResultType.Uri,
                                  source: CameraSource.Camera
                                });
                                if (image.webPath) {
                                  const response = await fetch(image.webPath);
                                  const blob = await response.blob();
                                  const file = new File([blob], "camera_photo.jpg", { type: "image/jpeg" });
                                  // Fake an event wrapper to reuse handlePhotoChange logic
                                  const syntheticEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                                  handlePhotoChange(syntheticEvent);
                                }
                              } catch (e) {
                                console.warn('User cancelled photo or error', e);
                              }
                            } else {
                              cameraInputRef.current?.click();
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                        >
                          <Camera className="w-4 h-4" />
                          Camera
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                const image = await CapCamera.getPhoto({
                                  quality: 90,
                                  allowEditing: false,
                                  resultType: CameraResultType.Uri,
                                  source: CameraSource.Photos
                                });
                                if (image.webPath) {
                                  const response = await fetch(image.webPath);
                                  const blob = await response.blob();
                                  const file = new File([blob], "gallery_photo.jpg", { type: "image/jpeg" });
                                  const syntheticEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                                  handlePhotoChange(syntheticEvent);
                                }
                              } catch (e) {
                                console.warn('User cancelled gallery or error', e);
                              }
                            } else {
                              galleryInputRef.current?.click();
                            }
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                        >
                          <span>🖼️</span>
                          Gallery
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Camera input – one photo at a time from camera */}
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                  {/* Gallery input – multiple photos from library */}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={!issueType && !description}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('save_draft')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                    ) : (
                      t('submit_report')
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'track':
        return (
          <div className="space-y-8 animate-in fade-in relative">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('nav_track')}</h2>
              <p className="text-gray-600">Monitor the status of your reported issues</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">Your Reports</h3>
                <div className="flex gap-2">
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">{resolvedCount} Resolved</span>
                  <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">{progressCount} In Progress</span>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {loadingComplaints ? (
                  <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-green-500" /></div>
                ) : myComplaints.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">You haven't reported any issues yet.</div>
                ) : (
                  myComplaints.map((report) => (
                    <div key={report.id} className="p-4 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl flex-shrink-0 ${report.status === 'RESOLVED' || report.status === 'CLOSED' ? 'bg-green-100 text-green-600' :
                          report.status === 'SUBMITTED' ? 'bg-purple-100 text-purple-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}>
                          {report.status === 'RESOLVED' || report.status === 'CLOSED' ? <CheckCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{report.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <span className="font-medium">#{report.id.slice(0, 8)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {report.date ? new Date(report.date.toMillis()).toLocaleDateString() : 'N/A'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {report.location.substring(0, 30)}...</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <StatusBadge status={report.status} />

                        {report.status === 'RESOLVED' && (
                          <button
                            onClick={() => handleOpenRating(report.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm whitespace-nowrap"
                          >
                            Rate & Close
                          </button>
                        )}

                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Rating Modal */}
            {
              ratingModalOpen && complaintToRate && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
                  <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-emerald-50/50">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Rate Final Work</h3>
                        <p className="text-sm text-gray-500">Your feedback improves our community</p>
                      </div>
                      <button
                        onClick={() => setRatingModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-white transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6">
                      <div className="flex justify-center gap-2 mb-6">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setRating(star)}
                            className={`transition-all duration-200 hover:scale-110 ${rating >= star ? 'text-yellow-400 scale-110 drop-shadow-md' : 'text-gray-200 hover:text-yellow-200'}`}
                          >
                            <Star className="w-12 h-12" fill={rating >= star ? "currentColor" : "none"} />
                          </button>
                        ))}
                      </div>

                      <div className="mb-2 flex justify-between text-xs font-semibold text-gray-400 px-2 uppercase tracking-wider">
                        <span>Poor</span>
                        <span>Excellent</span>
                      </div>

                      <div className="mt-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Feedback (Optional)</label>
                        <textarea
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all duration-200"
                          rows={3}
                          placeholder="Tell us what went well or what could be improved..."
                          value={ratingNotes}
                          onChange={(e) => setRatingNotes(e.target.value)}
                        ></textarea>
                      </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                      <button
                        onClick={() => setRatingModalOpen(false)}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitRating}
                        disabled={rating === 0 || isSubmittingRating}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-200 transition-all flex items-center gap-2"
                      >
                        {isSubmittingRating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Submit Rating
                      </button>
                    </div>
                  </div>
                </div>
              )
            }
          </div >
        );

      case 'scanner':
        return <WasteScannerTab />;
      case 'locator':
        return <RecyclingLocatorTab />;
      case 'collection':
        return <OnDemandCollectionTab userId={user.id} userAddress={user.address || ''} />;
      case 'rewards':
        return <RewardsTab complaints={myComplaints} trainingProgress={trainingProgress} />;
      case 'training':
        return <TrainingSystem user={user} />;
      case 'settings': return <SettingsTab user={user} />;
      case 'profile':
        return <ProfilePage user={user} />;

      case 'champion': {
        const userRank = leaderboard.findIndex(e => e.id === user.id) + 1;
        const myPoints = leaderboard.find(e => e.id === user.id)?.rewardPoints ?? (userProfile?.rewardPoints ?? 0);

        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <Trophy className="w-8 h-8 text-yellow-500" />
                {t('champion_hub')}
              </h2>
              <p className="text-gray-500 text-sm">{t('champion_hub_subtitle')}</p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-yellow-50 to-amber-100 rounded-2xl p-5 border border-amber-200 text-center">
                <p className="text-3xl font-bold text-amber-700">{userRank > 0 ? `#${userRank}` : '—'}</p>
                <p className="text-xs text-amber-600 font-medium mt-1">{t('champion_leaderboard_rank')}</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl p-5 border border-emerald-200 text-center">
                <p className="text-3xl font-bold text-emerald-700">{myPoints}</p>
                <p className="text-xs text-emerald-600 font-medium mt-1">{t('champion_reward_points')}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl p-5 border border-violet-200 text-center">
                <p className="text-3xl font-bold text-violet-700">{championBadges.filter(b => b.unlocked).length}/{championBadges.length}</p>
                <p className="text-xs text-violet-600 font-medium mt-1">{t('champion_badges_earned')}</p>
              </div>
            </div>

            {/* Champion-exclusive badges */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" /> {t('champion_badges_title')}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {championBadges.map(badge => (
                  <div key={badge.id} className={`rounded-xl p-4 text-center border-2 transition-all ${badge.unlocked ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-gray-50 opacity-50 grayscale'}`}>
                    <div className="text-3xl mb-2">{badge.icon}</div>
                    <p className="font-semibold text-gray-900 text-sm">{badge.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{badge.desc}</p>
                    {badge.unlocked && <p className="text-xs text-yellow-600 font-bold mt-2">✓ Earned</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" /> {t('champion_top_champions')}
              </h3>
              {leaderboardLoading ? (
                <p className="text-gray-400 text-sm text-center py-6">{t('champion_loading_leaderboard')}</p>
              ) : leaderboard.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">{t('champion_no_champions')}</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry, i) => (
                    <div key={entry.id} className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${entry.id === user.id ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'}`}>
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {entry.name}{entry.id === user.id ? ` ${t('champion_you')}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{entry.rewardPoints} pts</p>
                      </div>
                      {i < 3 && <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }

      default:
        return (
          <div className="text-center py-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('coming_soon')}</h3>
            <p className="text-gray-600">This feature is under development</p>
          </div>
        );
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} sidebarItems={sidebarItems} onProfileClick={() => setActiveTab('profile')}>
      {renderContent()}
    </Layout>
  );
};

// ─── On-Demand Collection Sub-Component ──────────────────────────────────────

interface Booking {
  id: string;
  type: 'immediate' | 'scheduled';
  address: string;
  wasteType: string;
  scheduledDate?: string;
  scheduledTime?: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: any;
}

const WASTE_TYPES = [
  'Household Waste', 'Dry Recyclables', 'Wet/Organic Waste',
  'E-Waste', 'Bulk Items / Furniture', 'Construction Debris', 'Medical Waste',
];

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const OnDemandCollectionTab: React.FC<{ userId: string; userAddress: string }> = ({ userId, userAddress }) => {
  const { error: toastError, warning: toastWarning } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tab, setTab] = useState<'immediate' | 'schedule'>('immediate');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    address: userAddress || '',
    wasteType: '',
    scheduledDate: '',
    scheduledTime: '08:00',
    notes: '',
  });

  React.useEffect(() => {
    const q = query(
      collection(db, 'collection_bookings'),
      where('userId', '==', userId)
    );
    const unsub = onSnapshot(q, snap => {
      const list: Booking[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Booking));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setBookings(list);
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address || !form.wasteType) {
      toastWarning('Please fill in address and waste type.');
      return;
    }
    if (tab === 'schedule' && !form.scheduledDate) {
      toastWarning('Please select a date for the scheduled pickup.');
      return;
    }
    setIsSubmitting(true);
    try {
      const data: any = {
        userId,
        type: tab === 'immediate' ? 'immediate' : 'scheduled',
        address: form.address,
        wasteType: form.wasteType,
        notes: form.notes,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      if (tab === 'schedule') {
        data.scheduledDate = form.scheduledDate;
        data.scheduledTime = form.scheduledTime;
      }
      await addDoc(collection(db, 'collection_bookings'), data);
      setSuccess(tab === 'immediate'
        ? '✅ Pickup request sent! Our team will arrive shortly.'
        : `✅ Pickup scheduled for ${new Date(form.scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} at ${form.scheduledTime}.`
      );
      setForm(prev => ({ ...prev, wasteType: '', notes: '', scheduledDate: '' }));
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Booking error:', err);
      toastError('Failed to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Garbage Collection</h2>
        <p className="text-gray-500">Request an immediate pickup or schedule one in advance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Bookings"
          value={loading ? '...' : bookings.length.toString()}
          icon={<Truck className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Pending"
          value={loading ? '...' : pendingCount.toString()}
          icon={<Clock className="w-6 h-6" />}
          trend={{ value: 'Awaiting pickup', isPositive: false }}
          color="yellow"
        />
        <StatCard
          title="Completed"
          value={loading ? '...' : completedCount.toString()}
          icon={<CheckCircle className="w-6 h-6" />}
          trend={{ value: 'All time', isPositive: true }}
          color="green"
        />
      </div>

      {/* Booking Form */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab('immediate')}
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${tab === 'immediate' ? 'text-emerald-700 bg-emerald-50 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <PhoneCall className="w-4 h-4" />
            Request Now
          </button>
          <button
            onClick={() => setTab('schedule')}
            className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${tab === 'schedule' ? 'text-blue-700 bg-blue-50 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <CalendarPlus className="w-4 h-4" />
            Schedule in Advance
          </button>
        </div>

        <form onSubmit={handleBook} className="p-6 space-y-5">
          {success && (
            <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-200 font-medium text-sm">
              {success}
            </div>
          )}

          {tab === 'immediate' && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-100 rounded-xl">
              <Truck className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-900 text-sm">On-Demand Pickup</p>
                <p className="text-orange-700 text-xs mt-0.5">Our nearest available team will be dispatched to your location. Estimated arrival: 2–4 hours.</p>
              </div>
            </div>
          )}

          {tab === 'schedule' && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900 text-sm">Scheduled Pickup</p>
                <p className="text-blue-700 text-xs mt-0.5">Choose a date and time window. We'll confirm within 2 hours of your booking.</p>
              </div>
            </div>
          )}

          {/* Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Pickup Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Your full pickup address"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all text-sm"
              />
            </div>
          </div>

          {/* Waste Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Waste Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.wasteType}
              onChange={e => setForm(p => ({ ...p, wasteType: e.target.value }))}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all text-sm appearance-none"
            >
              <option value="">Select waste type...</option>
              {WASTE_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
            </select>
          </div>

          {/* Date + Time (schedule only) */}
          {tab === 'schedule' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  required
                  min={minDate}
                  value={form.scheduledDate}
                  onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Preferred Time</label>
                <select
                  value={form.scheduledTime}
                  onChange={e => setForm(p => ({ ...p, scheduledTime: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-sm"
                >
                  <option value="07:00">7:00 AM – 9:00 AM</option>
                  <option value="09:00">9:00 AM – 11:00 AM</option>
                  <option value="11:00">11:00 AM – 1:00 PM</option>
                  <option value="14:00">2:00 PM – 4:00 PM</option>
                  <option value="16:00">4:00 PM – 6:00 PM</option>
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Additional Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Ring bell, leave at door, large items need assistance..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 text-white rounded-xl font-semibold transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm ${tab === 'immediate' ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700' : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700'}`}
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Booking...</>
            ) : tab === 'immediate' ? (
              <><Truck className="w-5 h-5" /> Request Pickup Now</>
            ) : (
              <><CalendarPlus className="w-5 h-5" /> Schedule Pickup</>
            )}
          </button>
        </form>
      </div>

      {/* Bookings List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Your Bookings</h3>
        </div>
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="w-7 h-7 animate-spin text-emerald-500" /></div>
        ) : bookings.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No bookings yet. Request your first pickup above.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {bookings.map(b => (
              <div key={b.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${b.type === 'immediate' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                    {b.type === 'immediate' ? <PhoneCall className="w-4 h-4 text-orange-600" /> : <Calendar className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{b.wasteType}</p>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {b.address.slice(0, 50)}{b.address.length > 50 ? '...' : ''}
                    </p>
                    {b.scheduledDate && (
                      <p className="text-xs text-blue-600 mt-0.5 font-medium">
                        📅 {new Date(b.scheduledDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {b.scheduledTime}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {b.type === 'immediate' ? 'On-demand' : 'Scheduled'} · #{b.id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                </div>
                <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${BOOKING_STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CitizenDashboard;

// ─── Citizen Rewards Tab ──────────────────────────────────────────────────────

interface RewardsBadge {
  id: string;
  icon: string;
  label: string;
  desc: string;
  condition: (complaints: { status: string }[], training: number) => boolean;
}

const REWARD_BADGES: RewardsBadge[] = [
  { id: 'first', icon: '🌱', label: 'First Step', desc: 'Submit your first report', condition: (c) => c.length >= 1 },
  { id: 'reporter5', icon: '📊', label: 'Active Reporter', desc: 'Submit 5 reports', condition: (c) => c.length >= 5 },
  { id: 'reporter10', icon: '🏆', label: 'Super Citizen', desc: 'Submit 10 reports', condition: (c) => c.length >= 10 },
  { id: 'resolver3', icon: '⭐', label: 'Problem Solver', desc: 'Get 3 issues resolved', condition: (c) => c.filter(x => ['RESOLVED', 'CLOSED'].includes(x.status)).length >= 3 },
  { id: 'resolver10', icon: '🎯', label: 'Impact Maker', desc: 'Get 10 issues resolved', condition: (c) => c.filter(x => ['RESOLVED', 'CLOSED'].includes(x.status)).length >= 10 },
  { id: 'training25', icon: '📚', label: 'Learner', desc: 'Complete 25% of training', condition: (_, t) => t >= 25 },
  { id: 'training100', icon: '🎓', label: 'Graduate', desc: 'Complete all training', condition: (_, t) => t >= 100 },
  {
    id: 'points500', icon: '🌟', label: 'Star Volunteer', desc: 'Earn 500+ points',
    condition: (c, t) => {
      const resolved = c.filter(x => ['RESOLVED', 'CLOSED'].includes(x.status)).length;
      return c.length * 10 + resolved * 50 + Math.floor(t / 25) * 25 >= 500;
    },
  },
];

interface RewardsTabProps {
  complaints: { id: string; status: string }[];
  trainingProgress: number;
}

const RewardsTab: React.FC<RewardsTabProps> = ({ complaints, trainingProgress }) => {
  const resolvedCount = complaints.filter(c => ['RESOLVED', 'CLOSED'].includes(c.status)).length;
  const trainingPts = Math.floor(trainingProgress / 25) * 25;
  const totalPoints = complaints.length * 10 + resolvedCount * 50 + trainingPts;
  const earnedBadges = REWARD_BADGES.filter(b => b.condition(complaints, trainingProgress));

  const TIERS = [
    { name: 'Bronze', min: 0, max: 199, color: 'from-amber-700 to-amber-500', icon: '🥉' },
    { name: 'Silver', min: 200, max: 499, color: 'from-slate-500 to-slate-400', icon: '🥈' },
    { name: 'Gold', min: 500, max: 999, color: 'from-yellow-500 to-amber-400', icon: '🥇' },
    { name: 'Platinum', min: 1000, max: 999999, color: 'from-cyan-500 to-teal-400', icon: '💎' },
  ];
  const tierIdx = Math.max(0, TIERS.findIndex(t => totalPoints >= t.min && totalPoints <= t.max));
  const currentTier = TIERS[tierIdx];
  const nextTier = TIERS[tierIdx + 1];
  const progressPct = nextTier
    ? Math.round(((totalPoints - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
    : 100;

  const breakdown = [
    { icon: '📋', label: 'Reports Submitted', count: complaints.length, rate: 10 },
    { icon: '✅', label: 'Issues Resolved', count: resolvedCount, rate: 50 },
    { icon: '🎓', label: 'Training Milestones', count: Math.floor(trainingProgress / 25), rate: 25 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-1">Rewards &amp; Points</h2>
        <p className="text-gray-600">Earn points for civic participation and unlock achievement badges</p>
      </div>

      {/* Hero Points Card */}
      <div className={`bg-gradient-to-r ${currentTier.color} rounded-2xl p-6 text-white shadow-lg`}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-sm font-medium opacity-80 mb-1 uppercase tracking-wider">{currentTier.icon} {currentTier.name} Tier</div>
            <div className="text-6xl font-black mb-1">{totalPoints.toLocaleString()}</div>
            <div className="text-sm opacity-80">Total Points Earned</div>
          </div>
          {nextTier ? (
            <div className="bg-white/15 rounded-xl p-4 min-w-[170px]">
              <div className="text-sm opacity-90 mb-1">Next: {nextTier.icon} {nextTier.name}</div>
              <div className="text-lg font-bold mb-2">{(nextTier.min - totalPoints).toLocaleString()} pts to go</div>
              <div className="w-full bg-white/25 rounded-full h-2">
                <div className="bg-white h-2 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-xs opacity-70 mt-1">{progressPct}% to {nextTier.name}</div>
            </div>
          ) : (
            <div className="bg-white/15 rounded-xl p-4">
              <div className="text-sm opacity-90">🏆 Maximum Tier Reached!</div>
              <div className="text-lg font-bold mt-1">Elite Member</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Reports', value: complaints.length, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
          { label: 'Issues Resolved', value: resolvedCount, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
          { label: 'Badges Earned', value: earnedBadges.length, bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.text} border ${s.border} rounded-xl p-4 text-center`}>
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Points Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Points Breakdown</h3>
        <div className="space-y-3">
          {breakdown.map(item => (
            <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                  <p className="text-xs text-gray-500">{item.count} × {item.rate} pts each</p>
                </div>
              </div>
              <span className="text-lg font-bold text-emerald-600">+{item.count * item.rate}</span>
            </div>
          ))}
          <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="font-bold text-gray-900">Total Points</span>
            <span className="text-xl font-bold text-emerald-700">{totalPoints}</span>
          </div>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Achievement Badges</h3>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {earnedBadges.length} / {REWARD_BADGES.length} earned
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {REWARD_BADGES.map(badge => {
            const earned = badge.condition(complaints, trainingProgress);
            return (
              <div
                key={badge.id}
                className={`flex flex-col items-center p-4 rounded-xl border-2 text-center transition-all duration-300 ${
                  earned ? 'border-emerald-200 bg-emerald-50 shadow-sm' : 'border-gray-100 bg-gray-50 grayscale opacity-50'
                }`}
              >
                <span className="text-3xl mb-2">{badge.icon}</span>
                <span className="text-sm font-semibold text-gray-900">{badge.label}</span>
                <span className="text-xs text-gray-500 mt-1 leading-tight">{badge.desc}</span>
                {earned && (
                  <span className="mt-2 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    ✓ Earned
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* How to Earn More */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How to Earn More Points</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: '📋', action: 'Submit a Report', pts: '+10 pts', desc: 'Report any civic waste issue with photo evidence' },
            { icon: '✅', action: 'Issue Gets Resolved', pts: '+50 pts', desc: 'Earn a bonus when your reported issue is resolved' },
            { icon: '🎓', action: 'Complete Training', pts: '+25 pts', desc: 'Per 25% milestone completed in the training modules' },
          ].map(item => (
            <div key={item.action} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-start gap-3 border border-gray-100">
              <span className="text-2xl mt-0.5 flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{item.action}</p>
                <p className="text-emerald-600 font-bold text-base">{item.pts}</p>
                <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};