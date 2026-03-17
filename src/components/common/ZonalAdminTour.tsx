/**
 * ZonalAdminTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders nothing — imports Shepherd CSS once and fires the zonal-admin tour hook.
 * Mount inside ZonalAdminDashboard.
 */

import 'shepherd.js/dist/css/shepherd.css';
import { useZonalAdminTour } from '../../hooks/useZonalAdminTour';
import type { UserProfile } from '../../contexts/AuthContext';

interface ZonalAdminTourProps {
  userProfile: UserProfile;
}

export default function ZonalAdminTour({ userProfile }: ZonalAdminTourProps) {
  useZonalAdminTour(userProfile);
  return null;
}
