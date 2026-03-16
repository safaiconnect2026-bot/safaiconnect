import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, addDoc, serverTimestamp, doc, writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  type: 'complaint_assigned' | 'complaint_resolved' | 'work_submitted' | 'general';
  read: boolean;
  createdAt: any;
  linkId?: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  addNotification: (
    userId: string,
    message: string,
    type: AppNotification['type'],
    linkId?: string
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  unreadCount: 0,
  markAllRead: async () => {},
  addNotification: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!currentUser) { setNotifications([]); return; }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsub = onSnapshot(q,
      (snap) => {
        setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification)));
      },
      (err) => {
        // Index not yet built — silently ignore, notifications will load once index is ready
        console.warn('Notifications index not ready yet:', err.message);
      }
    );
    return () => unsub();
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!currentUser || notifications.filter(n => !n.read).length === 0) return;
    const batch = writeBatch(db);
    notifications.filter(n => !n.read).forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const addNotification = async (
    userId: string,
    message: string,
    type: AppNotification['type'],
    linkId?: string
  ) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        message,
        type,
        read: false,
        createdAt: serverTimestamp(),
        ...(linkId ? { linkId } : {}),
      });
    } catch (e) {
      console.warn('Could not add notification:', e);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};
