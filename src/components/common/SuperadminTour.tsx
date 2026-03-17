/**
 * SuperadminTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders nothing — imports Shepherd CSS once and fires the superadmin tour hook.
 * Mount inside SuperadminDashboard.
 */

import 'shepherd.js/dist/css/shepherd.css';
import { useSuperadminTour } from '../../hooks/useSuperadminTour';
import type { UserProfile } from '../../contexts/AuthContext';

interface SuperadminTourProps {
  userProfile: UserProfile;
}

export default function SuperadminTour({ userProfile }: SuperadminTourProps) {
  useSuperadminTour(userProfile);
  return null;
}
