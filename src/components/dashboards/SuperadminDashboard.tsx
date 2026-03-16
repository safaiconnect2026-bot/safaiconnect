import React, { useState } from 'react';
import {
  BarChart3,
  Users,
  UserCheck,
  HardHat,
  MapPin,
  GraduationCap,
  FileText,
  Package,
  Settings,
  UserCircle,
} from 'lucide-react';
import { User } from '../../App';
import Layout from '../common/Layout';
import TrainingSystem from '../training/TrainingSystem';
import TrainingUploadTab from './tabs/TrainingUploadTab';
import OverviewTab from './tabs/OverviewTab';
import AdminManagementTab from './tabs/AdminManagementTab';
import CitizenManagementTab from './tabs/CitizenManagementTab';
import WorkerManagementTab from './tabs/WorkerManagementTab';
import LocationManagementTab from './tabs/LocationManagementTab';
import ReportsTab from './tabs/ReportsTab';
import InventoryTab from './tabs/InventoryTab';
import SettingsTab from './tabs/SettingsTab';
import ProfilePage from '../common/ProfilePage';
import { useLanguage } from '../../contexts/LanguageContext';

interface SuperadminDashboardProps {
  user: User;
  onLogout: () => void;
}

const SuperadminDashboard: React.FC<SuperadminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const { t } = useLanguage();

  const sidebarItems = [
    { icon: <BarChart3 className="w-5 h-5" />, label: t('overview'), active: activeTab === 'overview', onClick: () => setActiveTab('overview') },
    { icon: <Users className="w-5 h-5" />, label: t('admin_management'), active: activeTab === 'admins', onClick: () => setActiveTab('admins') },
    { icon: <UserCheck className="w-5 h-5" />, label: 'Citizens', active: activeTab === 'citizens', onClick: () => setActiveTab('citizens') },
    { icon: <HardHat className="w-5 h-5" />, label: 'Workers', active: activeTab === 'workers', onClick: () => setActiveTab('workers') },
    { icon: <MapPin className="w-5 h-5" />, label: 'Locations', active: activeTab === 'locations', onClick: () => setActiveTab('locations') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('training'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <FileText className="w-5 h-5" />, label: t('reports'), active: activeTab === 'reports', onClick: () => setActiveTab('reports') },
    { icon: <Package className="w-5 h-5" />, label: t('inventory_management'), active: activeTab === 'inventory', onClick: () => setActiveTab('inventory') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':   return <OverviewTab onNavigate={setActiveTab} />;
      case 'admins':     return <AdminManagementTab />;
      case 'citizens':   return <CitizenManagementTab />;
      case 'workers':    return <WorkerManagementTab />;
      case 'locations':  return <LocationManagementTab />;
      case 'training':   return <SuperadminTrainingWrapper user={user} />;
      case 'reports':    return <ReportsTab />;
      case 'inventory':  return <InventoryTab />;
      case 'settings':   return <SettingsTab user={user} />;
      case 'profile':    return <ProfilePage user={user} />;
      default:           return <OverviewTab />;
    }
  };

  return (
    <Layout
      user={user}
      onLogout={onLogout}
      sidebarItems={sidebarItems}
      onProfileClick={() => setActiveTab('profile')}
    >
      {renderContent()}
    </Layout>
  );
};

// ── Superadmin Training Wrapper (sub-tabs: Exercises + Upload Materials) ─────
const SuperadminTrainingWrapper: React.FC<{ user: User }> = ({ user }) => {
  const [subTab, setSubTab] = useState<'exercises' | 'materials'>('materials');
  return (
    <div className="space-y-6">
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        {[
          { key: 'materials' as const, label: 'Upload Materials' },
          { key: 'exercises' as const, label: 'Training Exercises' },
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
      {subTab === 'materials' ? <TrainingUploadTab user={user} /> : <TrainingSystem user={user} />}
    </div>
  );
};

export default SuperadminDashboard;
