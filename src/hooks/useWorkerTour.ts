/**
 * useWorkerTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Shepherd.js onboarding tour for first-time Worker users.
 *
 * Steps:
 *  1. Welcome modal
 *  2. My Tasks — view assigned complaints
 *  3. Submit Proof — geo-tagged before/after photos
 *  4. Attendance — daily check-in/out
 *  5. Training — safety & hygiene modules
 *
 * DOM anchors (data-tour="<id>") are set via the tourId prop on SidebarItem.
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

const ROLE = 'worker' as const;
const START_DELAY_MS = 1_500;

// ── Step definitions ──────────────────────────────────────────────────────────

function buildSteps(tour: Tour, userName: string): StepOptions[] {
  const firstName = userName.split(' ')[0] || 'there';

  return [
    // ── Step 1: Welcome ───────────────────────────────────────────────────
    {
      id: 'worker-welcome',
      title: `Welcome, ${firstName}! 👷`,
      text: `
        <p>You're now connected to the <strong>SafaiConnect</strong> workforce platform.</p>
        <p style="margin-top:8px">This quick tour shows you the <strong>5 core tools</strong>
        you'll use every day — from checking your tasks to submitting proof of completed work.</p>
      `,
      classes: 'safai-tour-step safai-tour-step--centered safai-tour-step--worker',
      cancelIcon: { enabled: true },
      buttons: [
        skipBtn(tour),
        { text: "Let's go →", action: () => tour.next(), classes: 'shepherd-btn-primary shepherd-btn-lg' },
      ],
    },

    // ── Step 2: My Tasks ──────────────────────────────────────────────────
    {
      id: 'worker-tasks',
      title: 'Your Assigned Tasks 📋',
      text: `
        <p>All citizen complaints assigned to you appear here.</p>
        <p style="margin-top:8px">Each task shows the <strong>complaint type</strong>,
        <strong>location</strong>, and current status. Tap a task to start working
        and change its status to <em>In Progress</em>.</p>
      `,
      attachTo: { element: '[data-tour="nav-tasks"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--worker',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 3: Submit Proof ──────────────────────────────────────────────
    {
      id: 'worker-proof',
      title: 'Submit Photo Proof 📸',
      text: `
        <p>After completing a task, upload <strong>before & after photos</strong> here.</p>
        <p style="margin-top:8px">Every photo is automatically <em>geo-tagged</em>
        with your GPS coordinates — creating tamper-proof evidence that supervisors
        and admins can verify.</p>
      `,
      attachTo: { element: '[data-tour="nav-proof"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--worker',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 4: Attendance ────────────────────────────────────────────────
    {
      id: 'worker-attendance',
      title: 'Daily Attendance ✅',
      text: `
        <p>Mark your attendance with <strong>Check In</strong> at the start of
        your shift and <strong>Check Out</strong> when you finish.</p>
        <p style="margin-top:8px">Attendance records are used for
        <em>salary calculation</em> — missed check-ins could affect your pay.</p>
      `,
      attachTo: { element: '[data-tour="nav-attendance"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--worker',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 5: Training ──────────────────────────────────────────────────
    {
      id: 'worker-training',
      title: 'Safety Training 🎓',
      text: `
        <p>Complete <strong>health, safety & hygiene</strong> training modules here.</p>
        <p style="margin-top:8px">Earn <em>XP points</em> and certificates.
        Keeping your training current is required for work clearance and
        unlocks better task assignments.</p>
      `,
      attachTo: { element: '[data-tour="nav-training"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--worker',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), doneBtn(tour, 'Start working 🚛')],
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWorkerTour(userProfile: UserProfile | null): void {
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role?.toLowerCase() !== 'worker') return;
    if (hasTourBeenSeen(ROLE, userProfile.preferences?.hasSeenTour)) return;

    const timerId = setTimeout(() => {
      const anchor = document.querySelector('[data-tour="nav-tasks"]');
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
    // Prevent duplicate tours
    if (tourRef.current?.isActive()) return;

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'safai-tour-step safai-tour-step--worker',
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
