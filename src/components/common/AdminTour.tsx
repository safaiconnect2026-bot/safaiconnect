/**
 * AdminTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders nothing — imports Shepherd CSS once and fires the admin tour hook.
 * Mount inside AdminDashboard.
 */

import 'shepherd.js/dist/css/shepherd.css';
import { useAdminTour } from '../../hooks/useAdminTour';
import type { UserProfile } from '../../contexts/AuthContext';

interface AdminTourProps {
  userProfile: UserProfile;
}

export default function AdminTour({ userProfile }: AdminTourProps) {
  useAdminTour(userProfile);
  return null;
}
