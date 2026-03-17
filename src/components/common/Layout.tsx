import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { User } from '../../App';
import Header from './Header';
import Sidebar from './Sidebar';
import { useLanguage } from '../../contexts/LanguageContext';

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
  onReportIssue?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, sidebarItems, onProfileClick, onReportIssue }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { t } = useLanguage();
  const modalRef = useRef<HTMLDivElement>(null);

  // Move focus into logout modal when it opens
  useEffect(() => {
    if (showLogoutConfirm) {
      // Small delay to let the modal render first
      const id = setTimeout(() => modalRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [showLogoutConfirm]);

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
        onReportIssue={onReportIssue}
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
        <main className={`flex-1 ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-80'} p-2 sm:p-4 lg:p-8 pt-20 md:pt-24 transition-all duration-300 w-full overflow-x-hidden`}>
          {children}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => { if (e.target === e.currentTarget) setShowLogoutConfirm(false); }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            tabIndex={-1}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 transform transition-all scale-100 border border-gray-100 dark:border-gray-700 outline-none"
          >
            <h3 id="logout-dialog-title" className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              {t('confirm_logout')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('confirm_logout_msg')}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
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
