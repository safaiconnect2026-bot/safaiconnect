import React, { useState } from 'react';
import {
  ClipboardList,
  Users,
  GraduationCap,
  DollarSign,
  UserCheck,
  LayoutDashboard,
  UserCircle,
  Settings,
  MapPin,
} from 'lucide-react';
import { User } from '../../App';
import Layout from '../common/Layout';
import { useLanguage } from '../../contexts/LanguageContext';
import TrainingSystem from '../training/TrainingSystem';
import ProfilePage from '../common/ProfilePage';

// Import active Tab Components
import OverviewTab from './admin/OverviewTab';
import ComplaintsTab from './admin/ComplaintsTab';
import WorkersTab from './admin/WorkersTab';
import VerificationTab from './admin/VerificationTab';
import SalaryTab from './admin/SalaryTab';
import ManageAreasTab from './admin/ManageAreasTab';
import SettingsTab from './tabs/SettingsTab';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');

  const sidebarItems = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: t('overview'), active: activeTab === 'overview', onClick: () => setActiveTab('overview') },
    { icon: <ClipboardList className="w-5 h-5" />, label: t('complaints'), active: activeTab === 'complaints', onClick: () => setActiveTab('complaints') },
    { icon: <Users className="w-5 h-5" />, label: t('workers'), active: activeTab === 'workers', onClick: () => setActiveTab('workers') },
    { icon: <UserCheck className="w-5 h-5" />, label: t('work_verification'), active: activeTab === 'verification', onClick: () => setActiveTab('verification') },
    { icon: <GraduationCap className="w-5 h-5" />, label: t('training'), active: activeTab === 'training', onClick: () => setActiveTab('training') },
    { icon: <DollarSign className="w-5 h-5" />, label: t('salary_tracking'), active: activeTab === 'salary', onClick: () => setActiveTab('salary') },
    { icon: <MapPin className="w-5 h-5" />, label: t('manage_areas') || 'Manage Areas', active: activeTab === 'areas', onClick: () => setActiveTab('areas') },
    { icon: <Settings className="w-5 h-5" />, label: t('settings'), active: activeTab === 'settings', onClick: () => setActiveTab('settings') },
    { icon: <UserCircle className="w-5 h-5" />, label: t('profile'), active: activeTab === 'profile', onClick: () => setActiveTab('profile') },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab onNavigate={setActiveTab} />;
      case 'complaints':
        return <ComplaintsTab />;
      case 'workers':
        return <WorkersTab />;
      case 'verification':
        return <VerificationTab />;
      case 'training':
        return <TrainingSystem user={user} />;
      case 'salary': return <SalaryTab onNavigate={setActiveTab} />;
      case 'areas': return <ManageAreasTab />;
      case 'settings': return <SettingsTab user={user} />;
      case 'profile': return <ProfilePage user={user} />;
      default: return <OverviewTab onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout user={user} onLogout={onLogout} sidebarItems={sidebarItems} onProfileClick={() => setActiveTab('profile')}>
      {renderContent()}
    </Layout>
  );
};

export default AdminDashboard;