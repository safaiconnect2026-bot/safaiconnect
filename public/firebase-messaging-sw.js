// Firebase Messaging Service Worker
// Handles background push notifications when app is not in focus
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBQJyhPX6KKabrtyZIIFApJnbuvaGx9xv0",
  authDomain: "safaiconnect.firebaseapp.com",
  projectId: "safaiconnect",
  storageBucket: "safaiconnect.firebasestorage.app",
  messagingSenderId: "646493037655",
  appId: "1:646493037655:web:8bd824355c6b2ea2082f12",
});

const messaging = firebase.messaging();

// Handle background messages (app not in foreground)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Safai Connect';
  const body = payload.notification?.body ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data ?? {},
  });
});
