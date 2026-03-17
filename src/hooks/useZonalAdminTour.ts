/**
 * useZonalAdminTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Shepherd.js onboarding tour for first-time Zonal Admin / City Admin users.
 *
 * Steps:
 *  1. Welcome modal
 *  2. Zone Overview — heatmap analytics & performance metrics
 *  3. Complaints — zone-level complaint triage
 *  4. Workers — zone worker performance
 *  5. Work Verification — approve zone work submissions
 *  6. Manage Wards — zone/ward hierarchy administration
 */

import { useEffect, useRef } from 'react';
import Shepherd, { Tour, type StepOptions } from 'shepherd.js';
import type { UserProfile } from '../contexts/AuthContext';
import {
  markTourSeen,
  hasTourBeenSeen,
  backBtn,
  nextBtn,
  skipBtn,
  doneBtn,
} from '../lib/tourUtils';

const ROLE = 'zonal-admin' as const;
const START_DELAY_MS = 1_500;

// ── Step definitions ──────────────────────────────────────────────────────────

function buildSteps(tour: Tour, userName: string): StepOptions[] {
  const firstName = userName.split(' ')[0] || 'there';

  return [
    // ── Step 1: Welcome ───────────────────────────────────────────────────
    {
      id: 'zonal-welcome',
      title: `Welcome, ${firstName}! 🗺️`,
      text: `
        <p>You have <strong>Zonal Admin access</strong> — responsible for
        overseeing sanitation operations across your entire zone.</p>
        <p style="margin-top:8px">This tour walks you through your zone's
        <strong>analytics</strong>, <strong>complaint pipeline</strong>,
        <strong>worker oversight</strong>, and <strong>ward management</strong>
        tools.</p>
      `,
      classes: 'safai-tour-step safai-tour-step--centered safai-tour-step--zonal',
      cancelIcon: { enabled: true },
      buttons: [
        skipBtn(tour),
        { text: "Let's go →", action: () => tour.next(), classes: 'shepherd-btn-primary shepherd-btn-lg' },
      ],
    },

    // ── Step 2: Zone Overview ─────────────────────────────────────────────
    {
      id: 'zonal-overview',
      title: 'Zone Performance Overview 📈',
      text: `
        <p>Your zone's live performance dashboard — track
        <strong>total complaints</strong>, <strong>resolution rate</strong>,
        <strong>active workers</strong>, and <strong>pending verifications</strong>
        across all wards in one view.</p>
        <p style="margin-top:8px">The <em>waste heatmap</em> shows which
        wards have the highest complaint density so you can prioritise resources.</p>
      `,
      attachTo: { element: '[data-tour="nav-overview"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--zonal',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 3: Zone Complaints ───────────────────────────────────────────
    {
      id: 'zonal-complaints',
      title: 'Zone Complaints 📋',
      text: `
        <p>All complaints raised across your zone appear here.</p>
        <p style="margin-top:8px">You can <strong>escalate</strong> unresolved
        complaints, <strong>reassign</strong> tasks between wards, and
        <em>filter by ward</em> to focus on specific problem areas.</p>
      `,
      attachTo: { element: '[data-tour="nav-complaints"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--zonal',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 4: Zone Workers ──────────────────────────────────────────────
    {
      id: 'zonal-workers',
      title: 'Zone Worker Performance 👷',
      text: `
        <p>Monitor all sanitation workers in your zone — their
        <strong>task completion rates</strong>, <strong>attendance</strong>,
        and <strong>citizen ratings</strong>.</p>
        <p style="margin-top:8px">Identify top performers and workers who
        need additional <em>training or support</em>.</p>
      `,
      attachTo: { element: '[data-tour="nav-workers"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--zonal',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 5: Work Verification ─────────────────────────────────────────
    {
      id: 'zonal-verification',
      title: 'Work Verification ✅',
      text: `
        <p>Review and <strong>approve or reject</strong> completed work
        submissions from all workers in your zone.</p>
        <p style="margin-top:8px">Each submission includes
        <em>geo-tagged photos</em> and a timestamp — giving you full
        accountability before closing a complaint.</p>
      `,
      attachTo: { element: '[data-tour="nav-verification"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--zonal',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 6: Manage Wards ──────────────────────────────────────────────
    {
      id: 'zonal-wards',
      title: 'Manage Wards 🗺️',
      text: `
        <p>Add, edit, or reorganise the <strong>wards within your zone</strong>.</p>
        <p style="margin-top:8px">Assign ward-level admins, adjust geographic
        boundaries, and configure <em>service schedules</em> — all changes
        propagate instantly to mobile workers in the field.</p>
      `,
      attachTo: { element: '[data-tour="nav-wards"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--zonal',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), doneBtn(tour, 'Start managing 🗺️')],
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useZonalAdminTour(userProfile: UserProfile | null): void {
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    const role = userProfile.role?.toLowerCase() ?? '';
    if (role !== 'zonal-admin' && role !== 'city-admin' && role !== 'zonal_admin') return;
    if (hasTourBeenSeen(ROLE, userProfile.preferences?.hasSeenTour)) return;

    const timerId = setTimeout(() => {
      const anchor = document.querySelector('[data-tour="nav-overview"]');
      if (!anchor) {
        setTimeout(() => startTour(userProfile), 2_000);
        return;
      }
      startTour(userProfile);
    }, START_DELAY_MS);

    return () => {
      clearTimeout(timerId);
      if (tourRef.current) {
        tourRef.current.off('complete');
        tourRef.current.off('cancel');
        if (tourRef.current.isActive()) tourRef.current.cancel();
        tourRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  function startTour(profile: UserProfile): void {
    if (tourRef.current?.isActive()) return;

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'safai-tour-step safai-tour-step--zonal',
        cancelIcon: { enabled: true },
        scrollTo: { behavior: 'smooth', block: 'center' },
        floatingUIOptions: { middleware: [] },
      },
    });

    const onDone = async () => {
      await markTourSeen(profile.uid, ROLE);
    };

    tour.on('complete', onDone);
    tour.on('cancel', onDone);
    tour.addSteps(buildSteps(tour, profile.name));
    tourRef.current = tour;
    tour.start();
  }
}
