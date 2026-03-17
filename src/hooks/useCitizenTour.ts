/**
 * useCitizenTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds and starts a Shepherd.js onboarding tour for first-time Citizen
 * (and Green Champion) users.
 *
 * Trigger logic (Firebase-integrated):
 *  1. Waits until Firebase confirms the user is logged in (userProfile loaded).
 *  2. Checks `userProfile.preferences.hasSeenTour` in Firestore — if true, skip.
 *  3. Falls back to localStorage('safai_tour_seen') for offline resilience.
 *  4. On tour complete OR cancel, marks the tour as seen in both Firestore and
 *     localStorage so it never shows again.
 *
 * DOM attachment:
 *  Each sidebar step attaches to a `data-tour="<id>"` attribute that is added
 *  by the SidebarItem `tourId` prop in Sidebar.tsx.
 */

import { useEffect, useRef } from 'react';
import Shepherd, { Tour, type StepOptions, type StepOptionsAttachTo, type PopperPlacement } from 'shepherd.js';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from '../contexts/AuthContext';

// ── CSS is imported once in CitizenTour.tsx to avoid duplicate injection ──

const LS_KEY = 'safai_tour_seen';

// Roles that should see the citizen onboarding tour
const TOUR_ROLES = new Set(['citizen', 'green-champion']);

// Delay (ms) after userProfile loads before starting the tour.
// Gives React time to finish rendering the sidebar DOM.
const START_DELAY_MS = 1_500;

/** Persist "tour seen" to Firestore + localStorage */
async function markTourSeen(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      'preferences.hasSeenTour': true,
    });
  } catch {
    // Offline or permission error — localStorage fallback is sufficient
  }
  localStorage.setItem(LS_KEY, '1');
}

/** Returns true if this user has already completed the tour */
function hasAlreadySeen(userProfile: UserProfile): boolean {
  if (localStorage.getItem(LS_KEY) === '1') return true;
  if (userProfile.preferences?.hasSeenTour === true) return true;
  return false;
}

// ── Shared button factory ──────────────────────────────────────────────────

function backBtn(tour: Tour) {
  return {
    text: '← Back',
    secondary: true,
    action: () => tour.back(),
    classes: 'shepherd-btn-back',
  };
}

function nextBtn(tour: Tour, label = 'Next →') {
  return {
    text: label,
    action: () => tour.next(),
    classes: 'shepherd-btn-primary',
  };
}

function skipBtn(tour: Tour) {
  return {
    text: 'Skip tour',
    secondary: true,
    action: () => tour.cancel(),
    classes: 'shepherd-btn-skip',
  };
}

// ── Step definitions ───────────────────────────────────────────────────────

function buildSteps(tour: Tour, userName: string): StepOptions[] {
  const firstName = userName.split(' ')[0] || 'there';

  // On mobile the sidebar flies in from the left — sidebar nav buttons are
  // scrolled into view by Shepherd's scrollTo: true option. We use 'auto'
  // placement so FloatingUI picks the best position (avoids off-screen clips).
  const sidebarAttachOpts: StepOptionsAttachTo = {
    element: '',   // set per-step below
    on: 'right' as PopperPlacement,
  };

  return [
    // ── Step 1: Welcome (centered modal, no attachTo) ──────────────────────
    {
      id: 'welcome',
      title: `Welcome, ${firstName}! 🌱`,
      text: `
        <p>You're now part of the <strong>Swachh Bharat Mission</strong>.</p>
        <p style="margin-top:8px">This 30-second tour shows you the four most
        powerful features so you can start making your neighbourhood cleaner
        <em>right now</em>.</p>
      `,
      classes: 'safai-tour-step safai-tour-step--centered',
      cancelIcon: { enabled: true },
      buttons: [
        skipBtn(tour),
        { ...nextBtn(tour, "Let's go →"), classes: 'shepherd-btn-primary shepherd-btn-lg' },
      ],
    },

    // ── Step 2: Report Issue ───────────────────────────────────────────────
    {
      id: 'report-issue',
      title: 'Report a Problem 📸',
      text: `
        <p>Spotted an overflowing bin, missed collection, or illegal dumping?</p>
        <p style="margin-top:8px">Tap <strong>Report Issue</strong> to file a
        complaint with a photo and your GPS location — a municipal worker will
        be assigned within hours.</p>
      `,
      attachTo: { ...sidebarAttachOpts, element: '[data-tour="nav-report"]' },
      classes: 'safai-tour-step',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 3: AI Waste Scanner ───────────────────────────────────────────
    {
      id: 'waste-scanner',
      title: 'AI Waste Scanner 🤖',
      text: `
        <p>Not sure which bin to use? Take a photo of any waste item.</p>
        <p style="margin-top:8px">Our <strong>GPT-4o powered AI</strong> identifies
        the waste type, the correct bin colour, and full disposal instructions —
        even when there are multiple items in the same photo.</p>
      `,
      attachTo: { ...sidebarAttachOpts, element: '[data-tour="nav-scanner"]' },
      classes: 'safai-tour-step safai-tour-step--ai',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 4: Track Status ───────────────────────────────────────────────
    {
      id: 'track-status',
      title: 'Track Your Reports 📋',
      text: `
        <p>Every complaint you file is tracked in real time — from
        <em>Submitted</em> → <em>Assigned</em> → <em>Resolved</em>.</p>
        <p style="margin-top:8px">Once resolved, you can
        <strong>rate the worker's effort</strong> with a 1–5 star review.</p>
      `,
      attachTo: { ...sidebarAttachOpts, element: '[data-tour="nav-track"]' },
      classes: 'safai-tour-step',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 5: Rewards ────────────────────────────────────────────────────
    {
      id: 'rewards',
      title: 'Earn Points & Badges 🏆',
      text: `
        <p>Every report you submit earns you <strong>reward points</strong>.
        Collect points to unlock badges — <em>First Step</em>, <em>Active Reporter</em>,
        <em>Super Citizen</em>, and more.</p>
        <p style="margin-top:8px">Climb the community leaderboard and turn
        civic action into recognition!</p>
      `,
      attachTo: { ...sidebarAttachOpts, element: '[data-tour="nav-rewards"]' },
      classes: 'safai-tour-step',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [
        backBtn(tour),
        {
          text: 'Start exploring 🌟',
          action: () => tour.complete(),
          classes: 'shepherd-btn-primary shepherd-btn-lg',
        },
      ],
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useCitizenTour(userProfile: UserProfile | null): void {
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    // Wait for Firebase to provide the user profile
    if (!userProfile) return;

    // Only run for citizen-type roles
    if (!TOUR_ROLES.has(userProfile.role?.toLowerCase() ?? '')) return;

    // Skip if already completed
    if (hasAlreadySeen(userProfile)) return;

    const timerId = setTimeout(() => {
      // Double-check DOM is ready (sidebar buttons must exist)
      const reportBtn = document.querySelector('[data-tour="nav-report"]');
      if (!reportBtn) {
        // Sidebar not rendered yet (e.g. mobile collapsed); retry once
        setTimeout(() => startTour(userProfile), 2_000);
        return;
      }
      startTour(userProfile);
    }, START_DELAY_MS);

    return () => {
      clearTimeout(timerId);
      // Cleanup tour instance on unmount/re-render
      if (tourRef.current) {
        tourRef.current.off('complete');
        tourRef.current.off('cancel');
        if (tourRef.current.isActive()) tourRef.current.cancel();
        tourRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]); // re-run only if the logged-in user changes

  function startTour(profile: UserProfile): void {
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      // On mobile the default width can clip — cap it via CSS variable
      defaultStepOptions: {
        classes: 'safai-tour-step',
        cancelIcon: { enabled: true },
        // Smooth scroll to highlighted element on every step
        scrollTo: { behavior: 'smooth', block: 'center' },
        // FloatingUI: fall back to any available space if 'right' is off-screen
        floatingUIOptions: {
          middleware: [],
        },
      },
    });

    const onDone = async () => {
      await markTourSeen(profile.uid);
    };

    tour.on('complete', onDone);
    tour.on('cancel', onDone);   // treat Skip the same as Done

    tour.addSteps(buildSteps(tour, profile.name));
    tourRef.current = tour;
    tour.start();
  }
}
