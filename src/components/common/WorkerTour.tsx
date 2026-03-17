/**
 * WorkerTour
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders nothing — imports Shepherd CSS once and fires the worker tour hook.
 * Mount inside WorkerDashboard.
 */

import 'shepherd.js/dist/css/shepherd.css';
import { useWorkerTour } from '../../hooks/useWorkerTour';
import type { UserProfile } from '../../contexts/AuthContext';

interface WorkerTourProps {
  userProfile: UserProfile;
}

export default function WorkerTour({ userProfile }: WorkerTourProps) {
  useWorkerTour(userProfile);
  return null;
}
