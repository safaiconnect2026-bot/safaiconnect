/**
 * useAdminTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Shepherd.js onboarding tour for first-time Admin (Municipal Admin) users.
 *
 * Steps:
 *  1. Welcome modal
 *  2. Overview — key metrics at a glance
 *  3. Complaints — manage & triage citizen reports
 *  4. Workers — assign workers to tasks
 *  5. Work Verification — approve completed work
 *  6. Salary Tracking — payroll management
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

const ROLE = 'admin' as const;
const START_DELAY_MS = 1_500;

// ── Step definitions ──────────────────────────────────────────────────────────

function buildSteps(tour: Tour, userName: string): StepOptions[] {
  const firstName = userName.split(' ')[0] || 'there';

  return [
    // ── Step 1: Welcome ───────────────────────────────────────────────────
    {
      id: 'admin-welcome',
      title: `Welcome, ${firstName}! 🏛️`,
      text: `
        <p>You have <strong>Admin access</strong> to SafaiConnect — the municipal
        waste management platform.</p>
        <p style="margin-top:8px">This tour covers the <strong>6 key sections</strong>
        that help you manage complaints, assign workers, verify work, and track
        your ward's performance — all in one place.</p>
      `,
      classes: 'safai-tour-step safai-tour-step--centered safai-tour-step--admin',
      cancelIcon: { enabled: true },
      buttons: [
        skipBtn(tour),
        { text: "Let's go →", action: () => tour.next(), classes: 'shepherd-btn-primary shepherd-btn-lg' },
      ],
    },

    // ── Step 2: Overview ──────────────────────────────────────────────────
    {
      id: 'admin-overview',
      title: 'Dashboard Overview 📊',
      text: `
        <p>Your command centre — see live stats on
        <strong>open complaints</strong>, <strong>active workers</strong>,
        <strong>resolution rate</strong>, and more.</p>
        <p style="margin-top:8px">Quick-action shortcuts let you jump to
        urgent items without navigating through menus.</p>
      `,
      attachTo: { element: '[data-tour="nav-overview"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--admin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 3: Complaints ────────────────────────────────────────────────
    {
      id: 'admin-complaints',
      title: 'Complaint Management 📋',
      text: `
        <p>All citizen complaints for your area land here.</p>
        <p style="margin-top:8px">Filter by <strong>status</strong>,
        <strong>category</strong>, or <strong>ward</strong>. Use
        <em>Assign Worker</em> on any unassigned complaint to route it to
        the right sanitation team immediately.</p>
      `,
      attachTo: { element: '[data-tour="nav-complaints"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--admin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 4: Workers ───────────────────────────────────────────────────
    {
      id: 'admin-workers',
      title: 'Worker Management 👷',
      text: `
        <p>View all sanitation workers in your area, their
        <strong>current workload</strong>, <strong>attendance</strong>,
        and <strong>performance ratings</strong>.</p>
        <p style="margin-top:8px">You can assign, reassign, or remove
        workers from tasks — and see their real-time location on the map.</p>
      `,
      attachTo: { element: '[data-tour="nav-workers"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--admin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 5: Work Verification ─────────────────────────────────────────
    {
      id: 'admin-verification',
      title: 'Work Verification ✅',
      text: `
        <p>When a worker marks a task complete, their <strong>geo-tagged
        photos</strong> appear here for your review.</p>
        <p style="margin-top:8px">Approve or reject each submission.
        <em>Approved</em> work triggers the complaint to be closed and
        the citizen to receive a resolution notification.</p>
      `,
      attachTo: { element: '[data-tour="nav-verification"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--admin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 6: Salary Tracking ───────────────────────────────────────────
    {
      id: 'admin-salary',
      title: 'Salary Tracking 💰',
      text: `
        <p>Review worker <strong>attendance records</strong> and generate
        monthly salary reports.</p>
        <p style="margin-top:8px">All data is pulled automatically from
        attendance check-ins and completed tasks — giving you an
        <em>audit-ready payroll summary</em> with one click.</p>
      `,
      attachTo: { element: '[data-tour="nav-salary"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--admin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), doneBtn(tour, 'Start managing 🏛️')],
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAdminTour(userProfile: UserProfile | null): void {
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role?.toLowerCase() !== 'admin') return;
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
        classes: 'safai-tour-step safai-tour-step--admin',
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
