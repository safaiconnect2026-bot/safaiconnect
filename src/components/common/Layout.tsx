import React, { ReactNode, useState } from 'react';
import { User } from '../../App';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: ReactNode;
  sidebarItems: Array<{
    icon: ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
  }>;
  onProfileClick?: () => void;
}

import { useLanguage } from '../../contexts/LanguageContext';

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, sidebarItems, onProfileClick }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { t } = useLanguage();

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header
        user={user}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onProfileClick={onProfileClick}
      />
      <div className="flex">
        <Sidebar
          items={sidebarItems}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onLogout={handleLogoutClick}
        />
        <main className={`flex-1 ${isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-80'} p-2 sm:p-4 lg:p-8 pt-20 lg:pt-24 transition-all duration-300 w-full overflow-x-hidden`}>
          {children}
        </main>
      </div>

      {/* Logout Confirmation Modal - Moved here to be outside Header stacking context */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 transform transition-all scale-100 border border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 mb-2">{t('confirm_logout')}</h3>
            <p className="text-gray-600 mb-6">
              {t('confirm_logout_msg')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors shadow-sm"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;