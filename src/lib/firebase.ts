// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, isSupported, Messaging } from 'firebase/messaging';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBQJyhPX6KKabrtyZIIFApJnbuvaGx9xv0",
    authDomain: "safaiconnect.firebaseapp.com",
    projectId: "safaiconnect",
    storageBucket: "safaiconnect.firebasestorage.app",
    messagingSenderId: "646493037655",
    appId: "1:646493037655:web:8bd824355c6b2ea2082f12",
    measurementId: "G-HB8DPD6TKM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
googleProvider.addScope('email');
googleProvider.addScope('profile');
export const db = getFirestore(app);

// Messaging – only works in browsers that support it (lazy-initialized)
let _messaging: Messaging | null = null;
let _messagingReady: Promise<Messaging | null> | null = null;

function getMessagingInstance(): Promise<Messaging | null> {
    if (!_messagingReady) {
        _messagingReady = isSupported()
            .then(yes => {
                if (yes) {
                    _messaging = getMessaging(app);
                    return _messaging;
                }
                return null;
            })
            .catch(() => null);
    }
    return _messagingReady;
}

export { getMessagingInstance };