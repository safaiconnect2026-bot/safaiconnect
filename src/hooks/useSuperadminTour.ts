/**
 * useSuperadminTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Shepherd.js onboarding tour for first-time Super Admin users.
 *
 * Steps:
 *  1. Welcome modal
 *  2. Overview — system-wide platform statistics
 *  3. Admin Management — create & manage city/ward admins
 *  4. User Management — citizens and workers across the platform
 *  5. Location Management — city → zone → ward hierarchy
 *  6. Reports & Analytics — platform-wide data insights
 *  7. Inventory — equipment and resource tracking
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

const ROLE = 'superadmin' as const;
const START_DELAY_MS = 1_500;

// ── Step definitions ──────────────────────────────────────────────────────────

function buildSteps(tour: Tour, userName: string): StepOptions[] {
  const firstName = userName.split(' ')[0] || 'there';

  return [
    // ── Step 1: Welcome ───────────────────────────────────────────────────
    {
      id: 'superadmin-welcome',
      title: `Welcome, ${firstName}! ⚙️`,
      text: `
        <p>You have <strong>Super Admin access</strong> — the highest level of
        control over the entire SafaiConnect platform.</p>
        <p style="margin-top:8px">This tour introduces the
        <strong>7 core management sections</strong> that let you configure cities,
        manage all users, and monitor platform-wide performance from a single
        command centre.</p>
      `,
      classes: 'safai-tour-step safai-tour-step--centered safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      buttons: [
        skipBtn(tour),
        { text: "Let's go →", action: () => tour.next(), classes: 'shepherd-btn-primary shepherd-btn-lg' },
      ],
    },

    // ── Step 2: System Overview ───────────────────────────────────────────
    {
      id: 'superadmin-overview',
      title: 'System-Wide Overview 📊',
      text: `
        <p>Live statistics across <strong>all cities, zones, and wards</strong>
        — total complaints, resolution rates, active users, and
        worker performance.</p>
        <p style="margin-top:8px">The overview refreshes in real time and
        highlights <em>anomalies</em> that need your immediate attention.</p>
      `,
      attachTo: { element: '[data-tour="nav-overview"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 3: Admin Management ──────────────────────────────────────────
    {
      id: 'superadmin-admins',
      title: 'Admin Management 👥',
      text: `
        <p>Create and manage <strong>City Admins</strong> and
        <strong>Zonal Admins</strong> here.</p>
        <p style="margin-top:8px">Assign admins to specific cities or zones,
        set their permissions, and deactivate accounts when needed — giving you
        <em>full control over the entire admin hierarchy</em>.</p>
      `,
      attachTo: { element: '[data-tour="nav-admins"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 4: Citizens & Workers ────────────────────────────────────────
    {
      id: 'superadmin-citizens',
      title: 'User Management 👤',
      text: `
        <p>View, search, and manage all <strong>citizens</strong> and
        <strong>sanitation workers</strong> registered on the platform.</p>
        <p style="margin-top:8px">You can update roles, reset accounts,
        export user data, and monitor activity — with full
        <em>GDPR-compliant data controls</em>.</p>
      `,
      attachTo: { element: '[data-tour="nav-citizens"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 5: Locations ─────────────────────────────────────────────────
    {
      id: 'superadmin-locations',
      title: 'Location Hierarchy 🗺️',
      text: `
        <p>Configure the <strong>City → Zone → Ward</strong> hierarchy
        that drives complaint routing across the entire platform.</p>
        <p style="margin-top:8px">Add new cities, split zones, or
        reorganise wards — every change cascades automatically to
        <em>all dashboards and worker assignments</em>.</p>
      `,
      attachTo: { element: '[data-tour="nav-locations"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 6: Reports ───────────────────────────────────────────────────
    {
      id: 'superadmin-reports',
      title: 'Platform Reports 📈',
      text: `
        <p>Generate <strong>city-level</strong>, <strong>zone-level</strong>,
        and <strong>platform-wide</strong> reports on demand.</p>
        <p style="margin-top:8px">Export data as CSV or PDF for
        <em>government audits</em>, Swachh Bharat Mission compliance,
        and inter-department reviews.</p>
      `,
      attachTo: { element: '[data-tour="nav-reports"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), nextBtn(tour)],
    },

    // ── Step 7: Inventory ─────────────────────────────────────────────────
    {
      id: 'superadmin-inventory',
      title: 'Inventory Management 📦',
      text: `
        <p>Track <strong>equipment</strong>, <strong>vehicles</strong>, and
        <strong>waste management resources</strong> across all cities.</p>
        <p style="margin-top:8px">Set <em>low-stock alerts</em>, log
        maintenance schedules, and ensure every sanitation team has
        the tools they need to operate effectively.</p>
      `,
      attachTo: { element: '[data-tour="nav-inventory"]', on: 'right' },
      classes: 'safai-tour-step safai-tour-step--superadmin',
      cancelIcon: { enabled: true },
      scrollTo: { behavior: 'smooth', block: 'center' },
      modalOverlayOpeningPadding: 6,
      modalOverlayOpeningRadius: 12,
      buttons: [backBtn(tour), doneBtn(tour, 'Start administering ⚙️')],
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSuperadminTour(userProfile: UserProfile | null): void {
  const tourRef = useRef<Tour | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    if (userProfile.role?.toLowerCase() !== 'superadmin') return;
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
        classes: 'safai-tour-step safai-tour-step--superadmin',
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
