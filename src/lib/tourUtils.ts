/**
 * tourUtils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared utilities for all Shepherd.js onboarding tours in SafaiConnect.
 * Used by useWorkerTour, useAdminTour, useZonalAdminTour, useSuperadminTour.
 * The citizen tour (useCitizenTour) has its own inline helpers for compatibility.
 */

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Tour } from 'shepherd.js';

// ── Role-specific localStorage keys ──────────────────────────────────────────

export type TourRole = 'worker' | 'admin' | 'zonal-admin' | 'superadmin';

const LS_KEY_MAP: Record<TourRole, string> = {
  worker:      'safai_tour_seen_worker',
  admin:       'safai_tour_seen_admin',
  'zonal-admin': 'safai_tour_seen_zonal',
  superadmin:  'safai_tour_seen_superadmin',
};

export function getTourLsKey(role: TourRole): string {
  return LS_KEY_MAP[role];
}

// ── Seen-state helpers ────────────────────────────────────────────────────────

/** Returns true if this user has already completed the tour for their role */
export function hasTourBeenSeen(role: TourRole, hasSeenPref?: boolean): boolean {
  if (localStorage.getItem(getTourLsKey(role)) === '1') return true;
  if (hasSeenPref === true) return true;
  return false;
}

/** Persist "tour seen" to Firestore preferences + localStorage */
export async function markTourSeen(uid: string, role: TourRole): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      [`preferences.hasSeenTour_${role}`]: true,
    });
  } catch {
    // Offline or permission error — localStorage fallback is sufficient
  }
  localStorage.setItem(getTourLsKey(role), '1');
}

/** Clear tour seen flag so the tour can be restarted */
export function clearTourSeen(role: TourRole): void {
  localStorage.removeItem(getTourLsKey(role));
}

// ── Shared button factory functions ──────────────────────────────────────────

export function backBtn(tour: Tour) {
  return {
    text: '← Back',
    secondary: true,
    action: () => tour.back(),
    classes: 'shepherd-btn-back',
  };
}

export function nextBtn(tour: Tour, label = 'Next →') {
  return {
    text: label,
    action: () => tour.next(),
    classes: 'shepherd-btn-primary',
  };
}

export function skipBtn(tour: Tour) {
  return {
    text: 'Skip tour',
    secondary: true,
    action: () => tour.cancel(),
    classes: 'shepherd-btn-skip',
  };
}

export function doneBtn(tour: Tour, label = 'Get started →') {
  return {
    text: label,
    action: () => tour.complete(),
    classes: 'shepherd-btn-primary shepherd-btn-lg',
  };
}
