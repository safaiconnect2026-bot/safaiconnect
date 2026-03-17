import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface ScopedComplaint {
  id: string;
  [key: string]: any;
}

/**
 * Real-time complaints feed scoped to the current user's role and Location DNA.
 *
 * - citizen     → own complaints only (citizenId == uid)
 * - worker      → complaints in their ward (wardId)
 * - zonal-admin → complaints in their zone (zoneId)
 * - admin       → complaints in their city (cityId)
 * - superadmin  → all complaints (no filter)
 */
export function useScopedComplaints() {
  const { userProfile } = useAuth();
  const [complaints, setComplaints] = useState<ScopedComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) {
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [];

    switch (userProfile.role) {
      case 'citizen':
      case 'green-champion':
        constraints.push(where('citizenId', '==', userProfile.uid));
        break;
      case 'worker':
        if (!userProfile.wardId) {
          setComplaints([]);
          setLoading(false);
          return;
        }
        constraints.push(where('wardId', '==', userProfile.wardId));
        break;
      case 'zonal-admin':
        if (!userProfile.zoneId) {
          setComplaints([]);
          setLoading(false);
          return;
        }
        constraints.push(where('zoneId', '==', userProfile.zoneId));
        break;
      case 'admin':
        if (!userProfile.cityId) {
          setComplaints([]);
          setLoading(false);
          return;
        }
        constraints.push(where('cityId', '==', userProfile.cityId));
        break;
      case 'superadmin':
        // No filter — global access
        break;
      default:
        constraints.push(where('citizenId', '==', userProfile.uid));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, 'complaints'), ...constraints);
    setLoading(true);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setComplaints(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [userProfile]);

  return { complaints, loading, error };
}
