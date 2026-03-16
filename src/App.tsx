import { useState } from 'react';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import SuperadminDashboard from './components/dashboards/SuperadminDashboard';
import AdminDashboard from './components/dashboards/AdminDashboard';
import WorkerDashboard from './components/dashboards/WorkerDashboard';
import GreenChampionDashboard from './components/dashboards/GreenChampionDashboard';
import CitizenDashboard from './components/dashboards/CitizenDashboard';
import ZonalAdminDashboard from './components/dashboards/ZonalAdminDashboard';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { auth } from './lib/firebase';
import { signOut } from 'firebase/auth';
import { SpeedInsights } from '@vercel/speed-insights/react';

export type UserRole = 'superadmin' | 'admin' | 'zonal-admin' | 'green-champion' | 'worker' | 'citizen';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  address?: string;
  citizenID?: string;
  assignedZone?: string;
  zoneId?: string;
  cityId?: string;
  wardId?: string;
  preferences?: {
    notifications?: boolean;
    language?: string;
  };
}

const LS_VIEW_KEY = 'currentView_safai';

type ViewState = 'landing' | 'login' | 'signup';

function App() {
  const { currentUser, userProfile, loading, noDocument } = useAuth();

  const [currentView, setCurrentView] = useState<ViewState>(() => {
    return (localStorage.getItem(LS_VIEW_KEY) as ViewState) || 'landing';
  });

  const handleSetView = (view: ViewState) => {
    setCurrentView(view);
    localStorage.setItem(LS_VIEW_KEY, view);
  };

  const handleLogin = () => {
    // Login is handled entirely by Firebase/AuthContext now
    // No more localAuthFallback — the role comes from Firestore via AuthContext
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
    handleSetView('landing');
  };

  // Show loading spinner while Firebase resolves the auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If not logged in, show public pages
  if (!currentUser) {
    switch (currentView) {
      case 'login':
        return (
          <LoginPage
            onLogin={handleLogin}
            onNavigateToSignup={() => handleSetView('signup')}
            onBack={() => handleSetView('landing')}
          />
        );
      case 'signup':
        return (
          <SignupPage
            onSignupSuccess={(_email) => {
              // Don't redirect - user is already authenticated after signup
              // AuthContext will detect the auth state and show dashboard
              console.log('✅ Signup successful, waiting for auth state...');
            }}
            onNavigateToLogin={() => handleSetView('login')}
          />
        );
      case 'landing':
      default:
        return <LandingPage onGetStarted={() => handleSetView('login')} />;
    }
  }

  // Logged in but the Firestore user document does not exist — account not fully set up
  if (noDocument) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-2xl font-bold">!</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Not Found</h2>
          <p className="text-gray-500 text-sm mb-4">
            Your account ({currentUser?.email}) is authenticated but has no profile in the database.
            Please contact your administrator or sign up again.
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Logged in but Firestore profile not loaded yet
  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated, clear any stored view state to prevent navigation issues
  // This ensures that after login/signup, the user sees their dashboard
  if (currentUser && userProfile) {
    const storedView = localStorage.getItem(LS_VIEW_KEY);
    if (storedView && storedView !== 'landing') {
      localStorage.removeItem(LS_VIEW_KEY);
    }
  }

  // Build the activeUser from Firestore profile — this is the ONLY source of truth for role

  // Normalize role to lowercase for consistent comparison
  const normalizedRole = (userProfile.role?.toLowerCase() || 'citizen') as UserRole;
  
  // DEBUG: Log role information to help diagnose routing issues
  console.log('🔍 ROLE DEBUG:', {
    rawFirestoreRole: userProfile.role,
    normalizedRole: normalizedRole,
    userEmail: userProfile.email,
    userId: userProfile.uid
  });

  const activeUser: User = {
    id: userProfile.uid,
    email: userProfile.email,
    name: userProfile.name,
    role: normalizedRole,
    phone: userProfile.phone,
    address: userProfile.address,
    citizenID: userProfile.citizenID,
    assignedZone: userProfile.assignedZone || userProfile.area,
    zoneId: userProfile.zoneId,
    cityId: userProfile.cityId,
    wardId: userProfile.wardId,
    preferences: userProfile.preferences,
  };

  const renderDashboard = () => {
    console.log('🎯 Rendering dashboard for role:', activeUser.role);
    
    switch (activeUser.role) {
      case 'superadmin': 
        console.log('✅ Loading SuperadminDashboard');
        return <SuperadminDashboard user={activeUser} onLogout={handleLogout} />;
      case 'admin':      
        console.log('✅ Loading AdminDashboard');
        return <AdminDashboard user={activeUser} onLogout={handleLogout} />;
      case 'zonal-admin':
        console.log('✅ Loading ZonalAdminDashboard');
        return <ZonalAdminDashboard user={activeUser} onLogout={handleLogout} />;
      case 'worker':     
        console.log('✅ Loading WorkerDashboard');
        return <WorkerDashboard user={activeUser} onLogout={handleLogout} />;
      case 'green-champion':
        console.log('✅ Loading GreenChampionDashboard');
        return <GreenChampionDashboard user={activeUser} onLogout={handleLogout} />;
      case 'citizen':
        console.log('✅ Loading CitizenDashboard');
        return <CitizenDashboard user={activeUser} onLogout={handleLogout} />;
      default:
        console.warn('⚠️ Unknown role, defaulting to CitizenDashboard:', activeUser.role);
        return <CitizenDashboard user={activeUser} onLogout={handleLogout} />;
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <div>
          {renderDashboard()}
        </div>
      </div>
      <SpeedInsights />
    </ThemeProvider>
  );
}

export default App;
