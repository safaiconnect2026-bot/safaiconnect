/**
 * OnboardingChecklist
 * ─────────────────────────────────────────────────────────────────────────────
 * A floating "Getting Started" panel that appears on all dashboards.
 *
 * Features:
 *  • Role-specific checklist items (citizen / worker / admin / zonal-admin / superadmin)
 *  • Persists checked state in localStorage per user
 *  • Progress bar showing completion percentage
 *  • "Restart Tour" button that clears the tour-seen flag and reloads
 *  • Dismissible — collapses to a small "?" FAB in the bottom-right corner
 *
 * Usage:
 *   <OnboardingChecklist userId={user.id} role={user.role} />
 */

import React, { useState, useCallback, useMemo } from 'react';
import { CheckCircle, Circle, ChevronUp, ChevronDown, X, HelpCircle, RotateCcw } from 'lucide-react';
import { clearTourSeen, type TourRole } from '../../lib/tourUtils';
import { useLanguage } from '../../contexts/LanguageContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  labelKey: string;
  descKey: string;
}

interface OnboardingChecklistProps {
  userId: string;
  role: string;
}

// ── Role-based checklist items ────────────────────────────────────────────────

const CHECKLISTS: Record<string, ChecklistItem[]> = {
  citizen: [
    { id: 'report', labelKey: 'checklist_citizen_report_label', descKey: 'checklist_citizen_report_desc' },
    { id: 'scanner', labelKey: 'checklist_citizen_scanner_label', descKey: 'checklist_citizen_scanner_desc' },
    { id: 'track', labelKey: 'checklist_citizen_track_label', descKey: 'checklist_citizen_track_desc' },
    { id: 'recycle', labelKey: 'checklist_citizen_recycle_label', descKey: 'checklist_citizen_recycle_desc' },
    { id: 'reward', labelKey: 'checklist_citizen_reward_label', descKey: 'checklist_citizen_reward_desc' },
  ],
  'green-champion': [
    { id: 'report', labelKey: 'checklist_citizen_report_label', descKey: 'checklist_citizen_report_desc' },
    { id: 'scanner', labelKey: 'checklist_citizen_scanner_label', descKey: 'checklist_citizen_scanner_desc' },
    { id: 'leaderboard', labelKey: 'checklist_champion_leaderboard_label', descKey: 'checklist_champion_leaderboard_desc' },
    { id: 'recycle', labelKey: 'checklist_citizen_recycle_label', descKey: 'checklist_citizen_recycle_desc' },
    { id: 'training', labelKey: 'checklist_champion_training_label', descKey: 'checklist_champion_training_desc' },
  ],
  worker: [
    { id: 'tasks', labelKey: 'checklist_worker_tasks_label', descKey: 'checklist_worker_tasks_desc' },
    { id: 'proof', labelKey: 'checklist_worker_proof_label', descKey: 'checklist_worker_proof_desc' },
    { id: 'attendance', labelKey: 'checklist_worker_attendance_label', descKey: 'checklist_worker_attendance_desc' },
    { id: 'training', labelKey: 'checklist_worker_training_label', descKey: 'checklist_worker_training_desc' },
    { id: 'digitalid', labelKey: 'checklist_worker_digitalid_label', descKey: 'checklist_worker_digitalid_desc' },
  ],
  admin: [
    { id: 'overview', labelKey: 'checklist_admin_overview_label', descKey: 'checklist_admin_overview_desc' },
    { id: 'complaint', labelKey: 'checklist_admin_complaint_label', descKey: 'checklist_admin_complaint_desc' },
    { id: 'worker', labelKey: 'checklist_admin_worker_label', descKey: 'checklist_admin_worker_desc' },
    { id: 'verify', labelKey: 'checklist_admin_verify_label', descKey: 'checklist_admin_verify_desc' },
    { id: 'salary', labelKey: 'checklist_admin_salary_label', descKey: 'checklist_admin_salary_desc' },
  ],
  'zonal-admin': [
    { id: 'overview', labelKey: 'checklist_zonal_overview_label', descKey: 'checklist_zonal_overview_desc' },
    { id: 'complaints', labelKey: 'checklist_zonal_complaints_label', descKey: 'checklist_zonal_complaints_desc' },
    { id: 'workers', labelKey: 'checklist_zonal_workers_label', descKey: 'checklist_zonal_workers_desc' },
    { id: 'verify', labelKey: 'checklist_zonal_verify_label', descKey: 'checklist_zonal_verify_desc' },
    { id: 'wards', labelKey: 'checklist_zonal_wards_label', descKey: 'checklist_zonal_wards_desc' },
  ],
  superadmin: [
    { id: 'overview', labelKey: 'checklist_super_overview_label', descKey: 'checklist_super_overview_desc' },
    { id: 'admins', labelKey: 'checklist_super_admins_label', descKey: 'checklist_super_admins_desc' },
    { id: 'locations', labelKey: 'checklist_super_locations_label', descKey: 'checklist_super_locations_desc' },
    { id: 'reports', labelKey: 'checklist_super_reports_label', descKey: 'checklist_super_reports_desc' },
    { id: 'inventory', labelKey: 'checklist_super_inventory_label', descKey: 'checklist_super_inventory_desc' },
  ],
};

// ── localStorage helpers ──────────────────────────────────────────────────────

function getLsKey(userId: string, role: string) {
  return `safai_checklist_${role}_${userId}`;
}

function loadChecked(userId: string, role: string): Set<string> {
  try {
    const raw = localStorage.getItem(getLsKey(userId, role));
    if (raw) return new Set<string>(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set<string>();
}

function saveChecked(userId: string, role: string, checked: Set<string>) {
  localStorage.setItem(getLsKey(userId, role), JSON.stringify([...checked]));
}

// ── Component ─────────────────────────────────────────────────────────────────

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ userId, role }) => {
  const { t } = useLanguage();
  const normalizedRole = role?.toLowerCase() ?? 'citizen';
  const items = CHECKLISTS[normalizedRole] ?? CHECKLISTS['citizen'];

  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(userId, normalizedRole));
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    return localStorage.getItem(`safai_checklist_dismissed_${userId}`) === '1';
  });

  const completedCount = useMemo(() => items.filter(i => checked.has(i.id)).length, [items, checked]);
  const progress = Math.round((completedCount / items.length) * 100);
  const allDone = completedCount === items.length;

  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveChecked(userId, normalizedRole, next);
      return next;
    });
  }, [userId, normalizedRole]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem(`safai_checklist_dismissed_${userId}`, '1');
  };

  const handleRestartTour = () => {
    // Map app roles to TourRole keys
    const tourRoleMap: Record<string, TourRole> = {
      worker: 'worker',
      admin: 'admin',
      'zonal-admin': 'zonal-admin',
      zonal_admin: 'zonal-admin',
      superadmin: 'superadmin',
    };
    const tourRole = tourRoleMap[normalizedRole];
    if (tourRole) clearTourSeen(tourRole);
    else {
      // citizen / green-champion use the legacy LS key
      localStorage.removeItem('safai_tour_seen');
    }
    window.location.reload();
  };

  // If the user dismissed the checklist, show a small FAB only
  if (isDismissed) {
    return (
      <button
        onClick={() => { setIsDismissed(false); setIsOpen(true); localStorage.removeItem(`safai_checklist_dismissed_${userId}`); }}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        title={t('getting_started')}
        aria-label={t('getting_started')}
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-24px)]">
      {/* Collapsed FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full shadow-lg text-sm font-semibold transition-all hover:scale-105"
        >
          <HelpCircle className="w-4 h-4" />
          <span>{t('getting_started')}</span>
          {!allDone && (
            <span className="bg-white/30 rounded-full px-1.5 py-0.5 text-xs font-bold">
              {completedCount}/{items.length}
            </span>
          )}
          {allDone && <span className="text-xs">✓ {t('done')}</span>}
          <ChevronUp className="w-4 h-4" />
        </button>
      )}

      {/* Expanded panel */}
      {isOpen && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-3 flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-sm">{t('getting_started')}</h3>
              <p className="text-emerald-100 text-xs mt-0.5">{t('checklist_progress').replace('{{done}}', String(completedCount)).replace('{{total}}', String(items.length))}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
                aria-label={t('collapse_sidebar')}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={handleDismiss}
                className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
                aria-label={t('close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Checklist items */}
          <ul className="px-3 py-2 max-h-72 overflow-y-auto space-y-1">
            {items.map(item => {
              const isChecked = checked.has(item.id);
              return (
                <li key={item.id}>
                  <button
                    onClick={() => toggle(item.id)}
                    className={[
                      'w-full flex items-start gap-3 px-2 py-2.5 rounded-xl text-left transition-all',
                      isChecked
                        ? 'bg-emerald-50 dark:bg-emerald-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700',
                    ].join(' ')}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {isChecked
                        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                        : <Circle className="w-4 h-4 text-gray-300 dark:text-gray-500" />
                      }
                    </div>
                    <div>
                      <p className={`text-xs font-semibold leading-tight ${isChecked ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                        {t(item.labelKey)}
                      </p>
                      {!isChecked && (
                        <p className="text-gray-400 dark:text-gray-500 text-[11px] mt-0.5 leading-relaxed">
                          {t(item.descKey)}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Footer */}
          <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            {allDone
              ? <p className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">🎉 {t('all_tasks_complete')}</p>
              : <p className="text-gray-400 text-xs">{t('tasks_remaining').replace('{{count}}', String(items.length - completedCount))}</p>
            }
            <button
              onClick={handleRestartTour}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors font-medium"
              title={t('restart_tour')}
            >
              <RotateCcw className="w-3 h-3" />
              {t('restart_tour')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingChecklist;
