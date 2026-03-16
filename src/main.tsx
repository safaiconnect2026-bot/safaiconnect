import React from 'react'
import { createRoot } from 'react-dom/client';
import App from './App.tsx'
import './index.css'
import { LanguageProvider } from './contexts/LanguageContext.tsx'
import './i18n'; // Import i18n configuration
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { registerSW } from 'virtual:pwa-register';

// Register the PWA service worker so the app is actually installable
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline.')
  },
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);