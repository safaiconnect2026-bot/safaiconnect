import React, { useState, useEffect } from 'react';
import {
    User as UserIcon,
    Mail,
    Phone,
    MapPin,
    Shield,
    Edit3,
    Save,
    X,
    Calendar,
    Lock,
    Bell,
    Globe,
    Camera,
    Building2,
    Briefcase,
    CreditCard,
    Home,
    ChevronDown,
    Award,
    Loader2,
} from 'lucide-react';
import { User } from '../../App';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';

interface ProfilePageProps {
    user: User;
}

const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
    { code: 'mr', label: 'Marathi', native: 'मराठी' },
    { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ur', label: 'Urdu', native: 'اردو' },
];

const WORKER_TYPES = ['Driver', 'Collector', 'Supervisor', 'Team Lead'];

const ROLE_BADGE: Record<string, string> = {
    superadmin: 'bg-purple-100 text-purple-800 border-purple-200',
    admin: 'bg-blue-100 text-blue-800 border-blue-200',
    worker: 'bg-green-100 text-green-800 border-green-200',
    citizen: 'bg-orange-100 text-orange-800 border-orange-200',
};

const ROLE_GRADIENT: Record<string, string> = {
    superadmin: 'from-purple-600 to-indigo-700',
    admin: 'from-blue-600 to-cyan-700',
    worker: 'from-emerald-600 to-teal-700',
    citizen: 'from-orange-500 to-amber-600',
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
    const { t, language, setLanguage } = useLanguage();
    const { error: toastError, success: toastSuccess } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [memberSince, setMemberSince] = useState<string>('—');
    const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');

        if (passwordForm.new.length < 6) {
            setPasswordError('New password must be at least 6 characters.');
            return;
        }
        if (passwordForm.new !== passwordForm.confirm) {
            setPasswordError('New passwords do not match.');
            return;
        }
        if (passwordForm.current === passwordForm.new) {
            setPasswordError('New password must be different from current password.');
            return;
        }

        const currentUser = auth.currentUser;
        if (!currentUser || !currentUser.email) {
            toastError('No authenticated user found. Please log in again.');
            return;
        }

        setChangingPassword(true);
        try {
            const credential = EmailAuthProvider.credential(currentUser.email, passwordForm.current);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, passwordForm.new);
            toastSuccess('Password changed successfully!');
            setShowPasswordModal(false);
            setPasswordForm({ current: '', new: '', confirm: '' });
        } catch (err: any) {
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setPasswordError('Current password is incorrect.');
            } else if (err.code === 'auth/too-many-requests') {
                setPasswordError('Too many attempts. Please try again later.');
            } else {
                setPasswordError(err.message || 'Failed to change password. Please try again.');
            }
        } finally {
            setChangingPassword(false);
        }
    };

    const [form, setForm] = useState({
        name: user.name,
        phone: user.phone || '',
        address: user.address || '',
        zone: user.assignedZone || '',
        // Superadmin / Admin
        department: '',
        designation: '',
        govtId: '',
        officeAddress: '',
        region: '',
        state: '',
        city: '',
        reportingTo: '',
        // Worker
        workerType: '',
        // Citizen
        ward: '',
        citizenID: user.citizenID || '',
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.id));
                if (snap.exists()) {
                    const d = snap.data();
                    const ts = d.memberSince || d.createdAt;
                    if (ts) {
                        try {
                            const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
                            setMemberSince(date.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));
                        } catch { /* ignore */ }
                    }
                    setForm(prev => ({
                        ...prev,
                        name: d.name || user.name,
                        phone: d.phone || '',
                        address: d.address || '',
                        zone: d.assignedZone || d.area || '',
                        department: d.department || '',
                        designation: d.designation || '',
                        govtId: d.govtId || '',
                        officeAddress: d.officeAddress || '',
                        region: d.region || '',
                        state: d.state || '',
                        city: d.city || '',
                        reportingTo: d.reportingTo || '',
                        workerType: d.workerType || '',
                        ward: d.ward || '',
                        citizenID: d.citizenID || user.citizenID || '',
                    }));
                }
            } catch (e) {
                console.error('Profile fetch error:', e);
            }
        };
        fetchProfile();
    }, [user.id]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const data: Record<string, any> = {
                name: form.name,
                phone: form.phone,
                address: form.address,
            };
            if (user.role === 'superadmin') {
                Object.assign(data, {
                    department: form.department,
                    designation: form.designation,
                    govtId: form.govtId,
                    officeAddress: form.officeAddress,
                    region: form.region,
                    state: form.state,
                    city: form.city,
                });
            } else if (user.role === 'admin') {
                Object.assign(data, {
                    designation: form.designation,
                    department: form.department,
                });
            } else if (user.role === 'worker') {
                Object.assign(data, {
                    workerType: form.workerType,
                    designation: form.designation,
                });
            } else if (user.role === 'citizen') {
                Object.assign(data, { ward: form.ward });
            }
            await updateDoc(doc(db, 'users', user.id), data);
            setIsEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Error updating profile:', error);
            toastError('Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePromoteToSuperadmin = () => {
        setShowPromoteConfirm(true);
    };

    const confirmPromoteToSuperadmin = async () => {
        setShowPromoteConfirm(false);
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.id), { role: 'Superadmin' });
            toastSuccess('Account elevated to Superadmin successfully! Please refresh the page.');
            window.location.reload();
        } catch (error) {
            console.error('Error promoting:', error);
            toastError('Failed to elevate account. You might not have sufficient permissions.');
        } finally {
            setIsSaving(false);
        }
    };

    // Editable input field
    const f = (label: string, key: keyof typeof form, icon: React.ReactNode, type = 'text', placeholder = '') => (
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>
                <input
                    type={type}
                    disabled={!isEditing}
                    value={form[key] as string}
                    onChange={(e) => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={isEditing ? placeholder : '—'}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 text-sm transition-all duration-200
                        ${isEditing
                            ? 'border-green-400 bg-white focus:ring-4 focus:ring-green-100 focus:outline-none'
                            : 'border-gray-100 bg-gray-50 text-gray-700 cursor-default'}`}
                />
            </div>
        </div>
    );

    // Read-only display field
    const ro = (label: string, value: string, icon: React.ReactNode, note = 'System-assigned') => (
        <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
            <div className="flex items-center gap-2 pl-3 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm text-gray-700">
                <span className="text-gray-400 flex-shrink-0">{icon}</span>
                <span className="font-mono truncate">{value || '—'}</span>
                <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{note}</span>
            </div>
        </div>
    );

    const gradient = ROLE_GRADIENT[user.role] || 'from-emerald-600 to-teal-700';
    const badge = ROLE_BADGE[user.role] || 'bg-gray-100 text-gray-700 border-gray-200';

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className={`bg-gradient-to-r ${gradient} rounded-2xl p-6 text-white shadow-lg`}>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    <div className="relative flex-shrink-0">
                        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center border-4 border-white/30 backdrop-blur-sm">
                            <UserIcon className="w-10 h-10 text-white" />
                        </div>
                        {isEditing && (
                            <button
                                className="absolute bottom-0 right-0 bg-white text-green-600 rounded-full p-1.5 shadow-md hover:bg-green-50 transition-colors"
                                title="Change photo"
                            >
                                <Camera className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="text-center sm:text-left flex-1 min-w-0">
                        <h2 className="text-2xl font-bold">{form.name || user.name}</h2>
                        <p className="text-white/80 text-sm mt-0.5">{user.email}</p>
                        {(form.designation || form.department) && (
                            <p className="text-white/70 text-sm mt-0.5">
                                {form.designation}{form.department ? ` — ${form.department}` : ''}
                            </p>
                        )}
                        <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-2">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30">
                                {t(`role_${user.role}`) || user.role}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white border border-white/30 font-mono">
                                ID: {user.id.slice(-8).toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-colors border border-white/30"
                            >
                                <Edit3 className="w-4 h-4" />
                                {t('edit_profile')}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-white text-green-700 rounded-xl text-sm font-medium hover:bg-green-50 transition-colors shadow disabled:opacity-70"
                                >
                                    <Save className="w-4 h-4" />
                                    {isSaving ? 'Saving...' : t('save_profile')}
                                </button>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-colors border border-white/30"
                                >
                                    <X className="w-4 h-4" />
                                    {t('cancel_profile')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {saved && (
                <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 animate-in fade-in">
                    ✅ {t('profile_updated_success')}
                </div>
            )}

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Information */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-green-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{t('personal_info')}</h3>
                    </div>
                    {f(t('full_name'), 'name', <UserIcon className="w-4 h-4" />, 'text', 'Your full name')}
                    {/* Email is always read-only */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('email_address')}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><Mail className="w-4 h-4" /></span>
                            <input
                                type="email"
                                disabled
                                value={user.email}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-700 cursor-default text-sm"
                            />
                        </div>
                    </div>
                    {f(t('phone_number'), 'phone', <Phone className="w-4 h-4" />, 'tel', '+91 9000000000')}
                    {user.role === 'citizen'
                        ? f('Home Address', 'address', <Home className="w-4 h-4" />, 'text', 'Your residential address')
                        : f(t('home_address'), 'address', <MapPin className="w-4 h-4" />, 'text', 'Your address')
                    }
                </div>

                {/* Work / Role-Specific Information */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900">{t('work_info')}</h3>
                    </div>

                    {/* Role badge - always shown */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('role_label')}</label>
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl">
                            <Shield className="w-4 h-4 text-gray-400" />
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badge}`}>
                                {t(`role_${user.role}`) || user.role}
                            </span>
                            <span className="text-xs text-gray-400 ml-auto">{t('assigned_by_system')}</span>
                        </div>
                    </div>

                    {/* ── SUPERADMIN fields ── */}
                    {user.role === 'superadmin' && (
                        <>
                            {f('Department', 'department', <Building2 className="w-4 h-4" />, 'text', 'e.g. Sanitation Dept')}
                            {f('Designation', 'designation', <Briefcase className="w-4 h-4" />, 'text', 'e.g. Chief Sanitation Officer')}
                            {f('Govt ID / Official Code', 'govtId', <CreditCard className="w-4 h-4" />, 'text', 'Government ID number')}
                            {f('Region', 'region', <Globe className="w-4 h-4" />, 'text', 'e.g. Vidarbha')}
                            {f('State', 'state', <MapPin className="w-4 h-4" />, 'text', 'e.g. Maharashtra')}
                            {f('City / District', 'city', <MapPin className="w-4 h-4" />, 'text', 'e.g. Nagpur')}
                            {f('Office Address', 'officeAddress', <Building2 className="w-4 h-4" />, 'text', 'Official office address')}
                        </>
                    )}

                    {/* ── ADMIN fields ── */}
                    {user.role === 'admin' && (
                        <>
                            {ro('Assigned Zone / Ward', form.zone, <MapPin className="w-4 h-4" />)}
                            {f('Designation', 'designation', <Briefcase className="w-4 h-4" />, 'text', 'e.g. Zone Manager')}
                            {f('Department', 'department', <Building2 className="w-4 h-4" />, 'text', 'e.g. Ward 15 Administration')}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Reporting To</label>
                                <div className="flex items-center gap-2 pl-3 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm text-gray-700">
                                    <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <span>{form.reportingTo || 'Super Administrator'}</span>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ── WORKER fields ── */}
                    {user.role === 'worker' && (
                        <>
                            {ro('Assigned Zone', form.zone, <MapPin className="w-4 h-4" />)}
                            {ro('Worker ID', user.id.slice(-8).toUpperCase(), <CreditCard className="w-4 h-4" />)}
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Worker Type</label>
                                {isEditing ? (
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                                            <Briefcase className="w-4 h-4" />
                                        </span>
                                        <select
                                            value={form.workerType}
                                            onChange={(e) => setForm(p => ({ ...p, workerType: e.target.value }))}
                                            className="w-full pl-10 pr-10 py-3 rounded-xl border-2 border-green-400 bg-white text-sm focus:ring-4 focus:ring-green-100 focus:outline-none appearance-none"
                                        >
                                            <option value="">Select type...</option>
                                            {WORKER_TYPES.map(wt => <option key={wt} value={wt}>{wt}</option>)}
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 pl-3 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm text-gray-700">
                                        <Briefcase className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <span>{form.workerType || '—'}</span>
                                    </div>
                                )}
                            </div>
                            {f('Designation', 'designation', <Award className="w-4 h-4" />, 'text', 'Official designation title')}
                        </>
                    )}

                    {/* ── CITIZEN fields ── */}
                    {user.role === 'citizen' && (
                        <>
                            {ro('Citizen ID', form.citizenID || user.id.slice(-8).toUpperCase(), <CreditCard className="w-4 h-4" />)}
                            {f('Ward / Zone', 'ward', <MapPin className="w-4 h-4" />, 'text', 'Your ward or zone number')}
                        </>
                    )}

                    {/* Member Since — always shown */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('member_since')}</label>
                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl text-sm text-gray-600">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span>{memberSince}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Globe className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900">{t('preferences')}</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('language')}</label>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-green-400 focus:ring-4 focus:ring-green-100 focus:outline-none transition-all"
                        >
                            {LANGUAGES.map(l => (
                                <option key={l.code} value={l.code}>{l.label} — {l.native}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{t('notifications')}</label>
                        <div className="flex items-center justify-between px-4 py-3 border-2 border-gray-200 rounded-xl">
                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                <Bell className="w-4 h-4 text-gray-400" />
                                {t('push_notifications')}
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                <div className="w-10 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:bg-green-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Lock className="w-5 h-5 text-red-500" />
                    <h3 className="text-lg font-semibold text-gray-900">{t('security')}</h3>
                </div>

                {user.name === 'SUPERADMIN' && user.role !== 'superadmin' && (
                    <div className="mb-6 p-4 bg-purple-50 border border-purple-100 rounded-xl animate-in fade-in zoom-in duration-500">
                        <h4 className="text-purple-900 font-bold mb-1 flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            Administrative Action
                        </h4>
                        <p className="text-purple-700 text-sm mb-4">
                            Your name is set to SUPERADMIN. You can elevate this account to full Super Administrator status.
                        </p>
                        <button
                            onClick={handlePromoteToSuperadmin}
                            disabled={isSaving}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition-colors shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
                        >
                            <Shield className="w-5 h-5" />
                            {isSaving ? 'Processing...' : 'Elevate to Superadmin'}
                        </button>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={() => { setShowPasswordModal(true); setPasswordForm({ current: '', new: '', confirm: '' }); setPasswordError(''); }}
                        className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                    >
                        <Lock className="w-4 h-4" />
                        {t('change_password')}
                    </button>
                    <button className="flex items-center gap-2 px-5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors">
                        <Shield className="w-4 h-4" />
                        {t('two_factor_auth')}
                    </button>
                </div>

                {/* Change Password Modal */}
                {showPasswordModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in" onClick={() => setShowPasswordModal(false)}>
                        <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-5 border-b border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
                                <button onClick={() => setShowPasswordModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                            <form onSubmit={handleChangePassword} className="p-5 space-y-4">
                                {passwordError && (
                                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                                        {passwordError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={passwordForm.current}
                                        onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                        placeholder="Enter current password"
                                        autoComplete="current-password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={passwordForm.new}
                                        onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                        placeholder="At least 6 characters"
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        value={passwordForm.confirm}
                                        onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                        placeholder="Re-enter new password"
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="flex gap-3 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={changingPassword}
                                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                                        {changingPassword ? 'Changing…' : 'Change Password'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* Promote to Superadmin Confirmation Modal */}
            {showPromoteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
                        <div className="p-6 text-center">
                            <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-7 h-7 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 mb-2">Elevate to Superadmin?</h3>
                            <p className="text-sm text-gray-500 mb-6">
                                This will grant <span className="font-semibold text-gray-700">full system access</span> to this account, including the ability to manage all users and data. This action cannot be easily undone.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setShowPromoteConfirm(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmPromoteToSuperadmin}
                                    disabled={isSaving}
                                    className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                                    Yes, Elevate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
