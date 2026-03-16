import React, { useState } from 'react';
import {
  ClipboardList,
  Users,
  UserCheck,
  LayoutDashboard,
  UserCircle,
  Settings,
  MapPin,
} from 'lucide-react';
import { User } from '../../App';
import Layout from '../common/Layout';
import { useLanguage } from '../../contexts/LanguageContext';
import ProfilePage from '../common/ProfilePage';

import ZonalOverviewTab from './zonal/ZonalOverviewTab';
import ZonalComplaintsTab from './zonal/ZonalComplaintsTab';
import ZonalWorkersTab from './zonal/ZonalWorkersTab';
import ZonalVerificationTab from './zonal/ZonalVerificationTab';
import ManageAreasTab from './admin/ManageAreasTab';
import SettingsTab from './tabs/SettingsTab';

interface ZonalAdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const ZonalAdminDashboard: React.FC<ZonalAdminDashboardProps> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');

  const zoneId = user.zoneId || '';
  const cityId = user.cityId || '';

  const sidebarItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: t('overview') || 'Overview', active: activeTab === 'overview', onClick: () => setActiveTab('overview') },
    { icon: <ClipboardList className="w-5 h-5" />, label: t('complaints') || 'Complaints', active: activeTab === 'complaints', onClick: () => setActiveTab('complaints') },
    { icon: <Users className="w-5 h-5" />, label: t('workers') || 'Workers', active: activeTab === 'workers', onClick: () => setActiveTab('workers') },
    { icon: <UserCheck className="w-5 h-5" />, label: t('work_verification') || 'Work Verification', active: activeTab === 'verification', onClick: () => setActiveTab('verification') },
    { icon: <MapPin className="w-5 h-5" />, label: t('manage_wards') || 'Manage Wards', active: activeTab === 'wards', onClick: () => setActiveTab('wards') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings') || 'Settings', active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile') || 'Profile', active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ZonalOverviewTab zoneId={zoneId} onNavigate={setActiveTab} />;
      case 'complaints':
        return <ZonalComplaintsTab zoneId={zoneId} />;
      case 'workers':
        return <ZonalWorkersTab zoneId={zoneId} />;
      case 'verification':
        return <ZonalVerificationTab zoneId={zoneId} />;
      case 'wards':
        return <ManageAreasTab cityId={cityId} />;
      case 'settings':
        return <SettingsTab user={user} />;
      case 'profile':
        return <ProfilePage user={user} />;
      default:
        return <ZonalOverviewTab zoneId={zoneId} onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} sidebarItems={sidebarItems} onProfileClick={() => setActiveTab('profile')}>
      {renderContent()}
    </Layout>
  );
};

export default ZonalAdminDashboard;
