import React, { ReactNode, useEffect } from 'react';
import { LogOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarItem {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  items: SidebarItem[];
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  items,
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  onLogout
}) => {
  const { t } = useLanguage();
  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed left-0 top-16 z-40',
          'h-[calc(100vh-4rem)]',
          isCollapsed ? 'lg:w-20 w-80' : 'w-80',
          'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-sm flex flex-col',
          'transform transition-all duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <nav className="p-4 sm:p-6 flex-1 overflow-y-auto overscroll-contain touch-pan-y mt-2">
          <ul className="space-y-2">
            {items.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => {
                    item.onClick?.();
                    // Don't close mobile menu if we're just toggling something else,
                    // but since items are navigation, we should close it.
                    onClose();
                  }}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
                    isCollapsed ? 'lg:justify-center lg:px-0' : '',
                    item.active
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                  ].join(' ')}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`flex-shrink-0 ${item.active ? 'text-white' : 'text-gray-500'}`}>
                    {item.icon}
                  </div>
                  <span className={`font-medium truncate ${isCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  {item.active && !isCollapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />
                  )}
                  {item.active && isCollapsed && (
                    <div className="hidden lg:block absolute right-2 w-1.5 h-1.5 rounded-full bg-white/50" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Area for Collapse Toggle and Logout */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-2 bg-white dark:bg-gray-800 z-10">
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center justify-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!isCollapsed && <span className="font-medium text-sm">Collapse</span>}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className={[
                "flex items-center gap-3 px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors",
                isCollapsed ? "lg:justify-center lg:px-0" : "w-full text-left"
              ].join(' ')}
              title={isCollapsed ? t('logout') : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={`font-medium ${isCollapsed ? 'lg:hidden' : ''}`}>{t('logout')}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
