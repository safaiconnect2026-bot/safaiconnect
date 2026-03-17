import React, { ReactNode, useEffect, useRef } from 'react';
import { LogOut, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface SidebarItem {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  /** Shepherd.js tour anchor — rendered as data-tour="<tourId>" on the button */
  tourId?: string;
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
  const sidebarRef = useRef<HTMLElement>(null);

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

  // Focus trap when mobile overlay is open
  useEffect(() => {
    if (!isOpen) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    const focusable = Array.from(
      sidebar.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    first.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [isOpen]);

  return (
    <>
      {/* Mobile Overlay — starts below header so header stays interactive */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 top-16 bg-black/50 z-40 transition-opacity duration-300"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        aria-label={t('navigation') || 'Navigation'}
        className={[
          'fixed left-0 top-16 z-40',
          'h-[calc(100dvh-4rem)] md:h-[calc(100vh-4rem)]',
          isCollapsed ? 'md:w-20 w-[280px]' : 'w-[280px] md:w-80',
          'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-lg flex flex-col',
          'transform transition-all duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        {/* Mobile sidebar header with close button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <img src="/logo.png" alt="SafaiConnect" className="h-8 w-auto max-w-[120px] object-contain" />
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop/tablet logo — full when expanded, icon-only when collapsed */}
        <div className={`hidden md:flex items-center border-b border-gray-100 dark:border-gray-700 ${isCollapsed ? 'justify-center px-2 py-3' : 'px-5 py-3'}`}>
          {isCollapsed ? (
            <img src="/pwa-192x192.png" alt="SafaiConnect" className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <img src="/logo.png" alt="SafaiConnect" className="h-9 w-auto max-w-[130px] object-contain" />
          )}
        </div>

        <nav className="p-4 sm:p-6 flex-1 overflow-y-auto overscroll-contain touch-pan-y mt-2">
          <ul className="space-y-2" role="list">
            {items.map((item, index) => (
              <li key={index}>
                <button
                  onClick={() => {
                    item.onClick?.();
                    onClose();
                  }}
                  {...(item.tourId ? { 'data-tour': item.tourId } : {})}
                  aria-label={item.label}
                  aria-current={item.active ? 'page' : undefined}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200',
                    isCollapsed ? 'md:justify-center md:px-0' : '',
                    item.active
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                  ].join(' ')}
                  title={isCollapsed ? item.label : undefined}
                >
                  <div className={`flex-shrink-0 ${item.active ? 'text-white' : 'text-gray-500'}`}>
                    {item.icon}
                  </div>
                  <span className={`font-medium truncate ${isCollapsed ? 'md:hidden' : ''}`}>{item.label}</span>
                  {item.active && !isCollapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" aria-hidden="true" />
                  )}
                  {item.active && isCollapsed && (
                    <div className="hidden md:block absolute right-2 w-1.5 h-1.5 rounded-full bg-white/50" aria-hidden="true" />
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
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex w-full items-center justify-center gap-3 px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!isCollapsed && <span className="font-medium text-sm">Collapse</span>}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              aria-label={t('logout') || 'Logout'}
              className={[
                "flex items-center gap-3 px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors",
                isCollapsed ? "md:justify-center md:px-0" : "w-full text-left"
              ].join(' ')}
              title={isCollapsed ? t('logout') : undefined}
            >
              <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className={`font-medium ${isCollapsed ? 'md:hidden' : ''}`}>{t('logout')}</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
