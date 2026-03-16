import React, { useState, useEffect } from 'react';
import { Trophy, Star, Award, Leaf } from 'lucide-react';
import { User } from '../../App';
import CitizenDashboard from './CitizenDashboard';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface GreenChampionDashboardProps {
  user: User;
  onLogout: () => void;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  rewardPoints: number;
  role: string;
}

const GreenChampionBanner: React.FC<{ user: User }> = ({ user }) => {
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy('rewardPoints', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const entries: LeaderboardEntry[] = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || 'Anonymous',
        rewardPoints: d.data().rewardPoints || 0,
        role: d.data().role || 'Citizen',
      }));
      const userRank = entries.findIndex(e => e.id === user.id) + 1;
      setRank(userRank > 0 ? userRank : null);
    });
    return () => unsub();
  }, [user.id]);

  return (
    <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-4 py-3 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 rounded-full p-2">
          <Leaf className="w-5 h-5" />
        </div>
        <div>
          <p className="font-bold text-sm">Green Champion</p>
          <p className="text-green-100 text-xs">{user.name}</p>
        </div>
        <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
          <Award className="w-4 h-4 text-yellow-300" />
          <span className="text-xs font-semibold">Champion</span>
        </div>
      </div>
      <div className="text-right">
        {rank !== null && (
          <div className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <span className="font-bold text-sm">#{rank} Leaderboard</span>
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
          <span className="text-xs">Active Champion</span>
        </div>
      </div>
    </div>
  );
};

const GreenChampionDashboard: React.FC<GreenChampionDashboardProps> = ({ user, onLogout }) => {
  return (
    <div className="flex flex-col min-h-screen">
      <GreenChampionBanner user={user} />
      <div className="flex-1">
        <CitizenDashboard user={user} onLogout={onLogout} isChampion={true} />
      </div>
    </div>
  );
};

export default GreenChampionDashboard;
