import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type AppView = 'landing' | 'driver' | 'carrier' | 'fleet' | 'admin'

export interface AuthUser {
  id: string
  name: string
  email: string
  password: string
  role: string
  appType: AppView
  avatar: string
  carrier?: string
  fleetCompany?: string
  driverType?: 'CARRIER_DRIVER' | 'FLEET_DRIVER'
  phone?: string
  truckUnit?: string
  cdlNumber?: string
}

export const TEST_ACCOUNTS: AuthUser[] = [
  {
    id: 'drv-001',
    name: 'John Smith',
    email: 'john.smith@abctransport.com',
    password: 'driver123',
    role: 'Carrier Driver',
    appType: 'driver',
    avatar: 'JS',
    carrier: 'ABC Transport Co.',
    driverType: 'CARRIER_DRIVER',
    phone: '+1 (214) 555-0142',
    truckUnit: 'T101',
    cdlNumber: 'CDL-TX-4892101',
  },
  {
    id: 'drv-042',
    name: 'James Williams',
    email: 'james.williams@xyztrucking.com',
    password: 'driver123',
    role: 'Fleet Company Driver',
    appType: 'driver',
    avatar: 'JW',
    carrier: 'ABC Transport Co.',
    fleetCompany: 'XYZ Trucking LLC',
    driverType: 'FLEET_DRIVER',
    phone: '+1 (713) 555-0287',
    truckUnit: 'T221',
    cdlNumber: 'CDL-TX-7723409',
  },
  {
    id: 'car-001',
    name: 'Diana Marsh',
    email: 'dispatch@abctransport.com',
    password: 'carrier123',
    role: 'Dispatcher',
    appType: 'carrier',
    avatar: 'DM',
    carrier: 'ABC Transport Co.',
  },
  {
    id: 'car-002',
    name: 'Victor Okafor',
    email: 'admin@abctransport.com',
    password: 'carrier123',
    role: 'Carrier Admin',
    appType: 'carrier',
    avatar: 'VO',
    carrier: 'ABC Transport Co.',
  },
  {
    id: 'flt-001',
    name: 'Rachel Kim',
    email: 'admin@xyztrucking.com',
    password: 'fleet123',
    role: 'Fleet Administrator',
    appType: 'fleet',
    avatar: 'RK',
    fleetCompany: 'XYZ Trucking LLC',
    carrier: 'ABC Transport Co.',
  },
  {
    id: 'flt-002',
    name: 'Marco Silva',
    email: 'manager@deltafleet.com',
    password: 'fleet123',
    role: 'Fleet Manager',
    appType: 'fleet',
    avatar: 'MS',
    fleetCompany: 'Delta Fleet Solutions',
    carrier: 'ABC Transport Co.',
  },
  {
    id: 'plt-001',
    name: 'Platform Admin',
    email: 'ops@iway.io',
    password: 'admin123',
    role: 'Platform Operations',
    appType: 'admin',
    avatar: 'PA',
  },
]

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string, appType: AppView) => { success: boolean; error?: string }
  logout: () => void
  signup: (data: Partial<AuthUser> & { password: string; appType: AppView }) => { success: boolean; error?: string }
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'iway_auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [user])

  const login = (email: string, password: string, appType: AppView) => {
    const account = TEST_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password && a.appType === appType
    )
    if (account) {
      setUser(account)
      return { success: true }
    }
    // Check if wrong app
    const wrongApp = TEST_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    )
    if (wrongApp) {
      return { success: false, error: `This account belongs to the ${appTypeLabel(wrongApp.appType)}, not this portal.` }
    }
    return { success: false, error: 'Invalid email or password.' }
  }

  const logout = () => setUser(null)

  const signup = (data: Partial<AuthUser> & { password: string; appType: AppView }) => {
    const exists = TEST_ACCOUNTS.find((a) => a.email.toLowerCase() === data.email?.toLowerCase())
    if (exists) return { success: false, error: 'An account with this email already exists.' }
    const newUser: AuthUser = {
      id: `usr-${Date.now()}`,
      name: data.name || 'New User',
      email: data.email || '',
      password: data.password,
      role: data.role || defaultRole(data.appType),
      appType: data.appType,
      avatar: (data.name || 'U').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
      carrier: data.carrier,
      fleetCompany: data.fleetCompany,
      driverType: data.driverType,
      phone: data.phone,
    }
    TEST_ACCOUNTS.push(newUser)
    setUser(newUser)
    return { success: true }
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, signup, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

function appTypeLabel(appType: AppView): string {
  const labels: Record<AppView, string> = {
    landing: 'Home',
    driver: 'Driver App',
    carrier: 'Carrier Admin Portal',
    fleet: 'Fleet Company Portal',
    admin: 'Platform Admin',
  }
  return labels[appType]
}

function defaultRole(appType: AppView): string {
  const roles: Record<AppView, string> = {
    landing: 'User',
    driver: 'Driver',
    carrier: 'Dispatcher',
    fleet: 'Fleet Administrator',
    admin: 'Platform Operator',
  }
  return roles[appType]
}
