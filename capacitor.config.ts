import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.safaiconnect.app',
  appName: 'Safai Connect',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#10b981',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
