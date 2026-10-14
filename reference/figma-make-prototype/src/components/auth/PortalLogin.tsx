import { useState } from 'react'
import { useAuth, AppView, TEST_ACCOUNTS } from '../../context/AuthContext'

type AppConfig = {
  label: string
  tag: string
  color: string
  borderColor: string
  bgGlow: string
  role: string
  icon: React.ReactNode
}

const APP_CONFIGS: Partial<Record<AppView, AppConfig>> = {
  carrier: {
    label: 'Carrier Admin Portal',
    tag: 'APPLICATION 2',
    color: '#f59e0b',
    borderColor: 'border-amber-500/30',
    bgGlow: '#f59e0b',
    role: 'Dispatchers · Operations · Admin',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  fleet: {
    label: 'Fleet Company Portal',
    tag: 'APPLICATION 3',
    color: '#3b82f6',
    borderColor: 'border-blue-500/30',
    bgGlow: '#3b82f6',
    role: 'Fleet Administrators · Managers',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 .001M13 16l2-6h4l2 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  admin: {
    label: 'iWay Platform Admin',
    tag: 'APPLICATION 4',
    color: '#a855f7',
    borderColor: 'border-purple-500/30',
    bgGlow: '#a855f7',
    role: 'Platform Operations Team',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
}

interface Props {
  appType: AppView
  onSuccess: () => void
  onBack: () => void
  onSignup?: () => void
}

export default function PortalLogin({ appType, onSuccess, onBack, onSignup }: Props) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const config = APP_CONFIGS[appType]
  if (!config) return null

  const testAccounts = TEST_ACCOUNTS.filter((a) => a.appType === appType)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const result = login(email, password, appType)
    setLoading(false)
    if (result.success) {
      onSuccess()
    } else {
      setError(result.error || 'Login failed.')
    }
  }

  const fillAccount = (acc: typeof testAccounts[0]) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--background)' }}>
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[420px] flex-col justify-between p-12 border-r border-[#1e2d47] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10 blur-[80px]" style={{ background: config.bgGlow }} />
        <div className="relative">
          <button onClick={onBack} className="flex items-center gap-2 text-[#64748b] hover:text-[#94a3b8] transition-colors text-sm mb-12">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Back to iWay
          </button>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center border" style={{ background: `${config.color}18`, borderColor: `${config.color}40`, color: config.color }}>
              {config.icon}
            </div>
            <div>
              <div className="font-semibold text-[#e8edf5]">iWay</div>
              <div className="text-xs font-mono" style={{ color: config.color }}>{config.tag}</div>
            </div>
          </div>
          <h1 className="font-display text-3xl text-[#e8edf5] leading-tight mb-3">{config.label}</h1>
          <p className="text-[#64748b] text-sm leading-relaxed">{config.role}</p>
        </div>

        {/* Test accounts */}
        <div className="relative">
          <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Test Accounts</div>
          <div className="space-y-2">
            {testAccounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => fillAccount(acc)}
                className="w-full text-left rounded border border-[#1e2d47] px-3 py-2.5 hover:border-[#2a3a54] transition-all group"
                style={{ background: 'var(--card)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0" style={{ background: `${config.color}20`, color: config.color }}>
                    {acc.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-[#94a3b8] group-hover:text-[#e8edf5] transition-colors truncate">{acc.name}</div>
                    <div className="text-xs text-[#475569] font-mono truncate">{acc.email}</div>
                  </div>
                  <div className="ml-auto shrink-0 text-xs font-mono text-[#475569] group-hover:text-[#64748b]">
                    {acc.password}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-xs text-[#475569] mt-3 font-mono">Click any account to autofill ↑</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <button onClick={onBack} className="text-[#64748b] hover:text-[#94a3b8] transition-colors">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="font-semibold text-[#e8edf5]">{config.label}</div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[#e8edf5]">Sign in</h2>
            <p className="text-sm text-[#64748b] mt-1">Welcome back to {config.label}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className="w-full px-4 py-3 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none transition-colors"
                style={{ borderColor: email ? `${config.color}60` : undefined }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none pr-10 transition-colors"
                  style={{ borderColor: password ? `${config.color}60` : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#64748b] transition-colors"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                      <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-[#64748b] cursor-pointer">
                <input type="checkbox" className="rounded" />
                Remember me
              </label>
              <button type="button" className="transition-colors" style={{ color: config.color }}>
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: config.color, color: appType === 'carrier' ? '#070c18' : '#fff' }}
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {onSignup && (
            <p className="text-center text-sm text-[#64748b] mt-6">
              Don't have an account?{' '}
              <button onClick={onSignup} className="font-medium transition-colors" style={{ color: config.color }}>
                Sign up
              </button>
            </p>
          )}

          {/* Mobile test accounts */}
          <div className="lg:hidden mt-8">
            <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Test Accounts</div>
            <div className="space-y-2">
              {testAccounts.map((acc) => (
                <button key={acc.id} onClick={() => fillAccount(acc)} className="w-full text-left rounded border border-[#1e2d47] px-3 py-2 text-xs" style={{ background: 'var(--card)' }}>
                  <span className="text-[#94a3b8]">{acc.name}</span>
                  <span className="text-[#475569] font-mono ml-2">{acc.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
