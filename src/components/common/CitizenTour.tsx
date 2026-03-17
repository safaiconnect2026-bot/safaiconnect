/**
 * CitizenTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders nothing — exists only to:
 *  1. Import Shepherd.js CSS once (avoids duplicate injection if the hook were
 *     used in multiple components).
 *  2. Call useCitizenTour() with the current user profile.
 *
 * Mount this component once inside CitizenDashboard (and GreenChampionDashboard
 * if you want champions to also see the tour).
 *
 * Custom tour styles live in src/index.css under the `.safai-tour-*` classes
 * so Tailwind's purge pass sees them and they survive production builds.
 */

import 'shepherd.js/dist/css/shepherd.css';
import { useCitizenTour } from '../../hooks/useCitizenTour';
import type { UserProfile } from '../../contexts/AuthContext';

interface CitizenTourProps {
  userProfile: UserProfile;
}

export default function CitizenTour({ userProfile }: CitizenTourProps) {
  useCitizenTour(userProfile);
  return null;
}
