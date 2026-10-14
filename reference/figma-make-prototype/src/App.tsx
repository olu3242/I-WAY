import { useState } from 'react'
import { AuthProvider, useAuth, AppView } from './context/AuthContext'
import { OperationsProvider } from './context/OperationsContext'
import LandingPage from './components/LandingPage'
import DriverApp from './components/DriverApp'
import CarrierAdmin from './components/CarrierAdmin'
import FleetPortal from './components/FleetPortal'
import PlatformAdmin from './components/PlatformAdmin'
import DriverLogin from './components/auth/DriverLogin'
import DriverSignup from './components/auth/DriverSignup'
import PortalLogin from './components/auth/PortalLogin'
import PortalSignup from './components/auth/PortalSignup'

type AuthScreen = 'login' | 'signup'

function AppInner() {
  const { user, isAuthenticated } = useAuth()
  const [view, setView] = useState<AppView>('landing')
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login')

  const navigate = (next: AppView) => {
    setView(next)
    setAuthScreen('login')
    window.scrollTo(0, 0)
  }

  // If user is authenticated and their app matches current view, show the app
  const isAuthedForView = isAuthenticated && user?.appType === view

  // Landing — no auth needed
  if (view === 'landing') {
    return <LandingPage onNavigate={navigate} />
  }

  // Driver App — requires driver auth
  if (view === 'driver') {
    if (!isAuthedForView) {
      if (authScreen === 'signup') {
        return (
          <DriverSignup
            onSuccess={() => { /* user is now set via AuthContext */ }}
            onLogin={() => setAuthScreen('login')}
            onBack={() => navigate('landing')}
          />
        )
      }
      return (
        <DriverLogin
          onSuccess={() => { /* user now set */ }}
          onSignup={() => setAuthScreen('signup')}
          onBack={() => navigate('landing')}
        />
      )
    }
    return <DriverApp onNavigate={navigate} />
  }

  // Carrier Admin — requires carrier auth
  if (view === 'carrier') {
    if (!isAuthedForView) {
      if (authScreen === 'signup') {
        return (
          <PortalSignup
            appType="carrier"
            onSuccess={() => { /* user now set */ }}
            onLogin={() => setAuthScreen('login')}
            onBack={() => navigate('landing')}
          />
        )
      }
      return (
        <PortalLogin
          appType="carrier"
          onSuccess={() => { /* user now set */ }}
          onBack={() => navigate('landing')}
          onSignup={() => setAuthScreen('signup')}
        />
      )
    }
    return <CarrierAdmin onNavigate={navigate} />
  }

  // Fleet Portal — requires fleet auth
  if (view === 'fleet') {
    if (!isAuthedForView) {
      if (authScreen === 'signup') {
        return (
          <PortalSignup
            appType="fleet"
            onSuccess={() => { /* user now set */ }}
            onLogin={() => setAuthScreen('login')}
            onBack={() => navigate('landing')}
          />
        )
      }
      return (
        <PortalLogin
          appType="fleet"
          onSuccess={() => { /* user now set */ }}
          onBack={() => navigate('landing')}
          onSignup={() => setAuthScreen('signup')}
        />
      )
    }
    return <FleetPortal onNavigate={navigate} />
  }

  // Platform Admin — requires admin auth, no public signup
  if (view === 'admin') {
    if (!isAuthedForView) {
      return (
        <PortalLogin
          appType="admin"
          onSuccess={() => { /* user now set */ }}
          onBack={() => navigate('landing')}
        />
      )
    }
    return <PlatformAdmin onNavigate={navigate} />
  }

  return <LandingPage onNavigate={navigate} />
}

export default function App() {
  return (
    <OperationsProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </OperationsProvider>
  )
}
