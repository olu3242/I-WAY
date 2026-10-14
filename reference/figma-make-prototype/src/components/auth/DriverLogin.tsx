import { useState } from 'react'
import { useAuth, TEST_ACCOUNTS } from '../../context/AuthContext'

interface Props {
  onSuccess: () => void
  onSignup: () => void
  onBack: () => void
}

export default function DriverLogin({ onSuccess, onSignup, onBack }: Props) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTestAccounts, setShowTestAccounts] = useState(false)

  const driverAccounts = TEST_ACCOUNTS.filter((a) => a.appType === 'driver')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600))
    const result = login(email, password, 'driver')
    setLoading(false)
    if (result.success) onSuccess()
    else setError(result.error || 'Invalid credentials.')
  }

  return (
    <MobileFrame>
      <div className="flex flex-col h-full">
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
          <span className="text-xs font-semibold text-[#e8edf5]">9:41</span>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[#e8edf5]">
              <path d="M1.5 8.5a13 13 0 0121 0M5 12a10 10 0 0114 0M8.5 15.5a7 7 0 017 0M12 19h.01" />
            </svg>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-3 text-[#e8edf5]">
              <rect x="1" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="8.5" width="11" height="7" rx="1" />
              <path d="M21 10v4a2 2 0 000-4z" />
            </svg>
          </div>
        </div>

        {/* Back */}
        <div className="px-6 pt-2 pb-4 shrink-0">
          <button onClick={onBack} className="flex items-center gap-1.5 text-emerald-400 text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
            iWay Home
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-10 mt-2">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white">
                <path d="M8 17a2 2 0 100-4 2 2 0 000 4zM18 17a2 2 0 100-4 2 2 0 000 4zM5 5h-.75A2.25 2.25 0 002 7.25v9.5A2.25 2.25 0 004.25 19H5m0-14v14m0-14h9l3 6h2.25A2.25 2.25 0 0121.5 13v3.75A2.25 2.25 0 0119.25 19H18m-13 0h8m-8 0H5"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#e8edf5]">iWay Driver</h1>
            <p className="text-sm text-[#64748b] mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@company.com"
                required
                className="w-full px-4 py-3.5 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none"
                style={{ borderColor: email ? '#10b98180' : undefined }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3.5 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none pr-12"
                  style={{ borderColor: password ? '#10b98180' : undefined }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#475569]"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                    {showPassword
                      ? <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" strokeLinecap="round" strokeLinejoin="round" />
                      : <><path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /></>
                    }
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="button" className="text-xs text-emerald-400">Forgot password?</button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}
            >
              {loading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Biometric hint */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1e2d47]" />
            <span className="text-xs text-[#475569]">or</span>
            <div className="flex-1 h-px bg-[#1e2d47]" />
          </div>

          <button className="w-full py-3.5 rounded-xl border border-[#1e2d47] flex items-center justify-center gap-3 text-sm text-[#64748b] hover:text-[#94a3b8] hover:border-[#2a3a54] transition-all" style={{ background: 'var(--card)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-emerald-400">
              <path d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign in with biometrics
          </button>

          <p className="text-center text-sm text-[#64748b] mt-6">
            New driver?{' '}
            <button onClick={onSignup} className="font-medium text-emerald-400">Create account</button>
          </p>

          {/* Test accounts toggle */}
          <button
            onClick={() => setShowTestAccounts(!showTestAccounts)}
            className="w-full mt-6 text-xs text-[#475569] font-mono text-center"
          >
            {showTestAccounts ? '▲ Hide' : '▼ Show'} test accounts
          </button>
          {showTestAccounts && (
            <div className="mt-3 space-y-2">
              {driverAccounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => { setEmail(acc.email); setPassword(acc.password) }}
                  className="w-full text-left rounded-xl border border-[#1e2d47] px-3 py-2.5 text-xs"
                  style={{ background: 'var(--card)' }}
                >
                  <div className="font-medium text-[#94a3b8]">{acc.name}</div>
                  <div className="text-[#475569] font-mono mt-0.5">{acc.email} · {acc.password}</div>
                  <div className="text-emerald-400/70 mt-0.5">{acc.driverType?.replace('_', ' ')}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Home indicator */}
        <div className="flex justify-center pb-2 pt-1 shrink-0">
          <div className="w-32 h-1 rounded-full bg-[#e8edf5]/20" />
        </div>
      </div>
    </MobileFrame>
  )
}

export function MobileFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 50% 40%, #0d1a2e 0%, #030507 70%)', padding: '20px' }}
    >
      {/* Desktop: phone frame */}
      <div className="hidden sm:block relative">
        {/* Outer phone shell */}
        <div
          className="relative rounded-[52px] p-[10px]"
          style={{ background: 'linear-gradient(145deg, #1a1a1a, #0a0a0a)', boxShadow: '0 40px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.04)' }}
        >
          {/* Screen */}
          <div
            className="relative overflow-hidden"
            style={{ width: 390, height: 844, borderRadius: 44, background: 'var(--background)' }}
          >
            {/* Dynamic island */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-8 rounded-full z-10" style={{ background: '#000' }} />
            {children}
          </div>
          {/* Side buttons */}
          <div className="absolute left-[-3px] top-28 w-[3px] h-10 rounded-l" style={{ background: '#1a1a1a' }} />
          <div className="absolute left-[-3px] top-44 w-[3px] h-14 rounded-l" style={{ background: '#1a1a1a' }} />
          <div className="absolute left-[-3px] top-64 w-[3px] h-14 rounded-l" style={{ background: '#1a1a1a' }} />
          <div className="absolute right-[-3px] top-44 w-[3px] h-20 rounded-r" style={{ background: '#1a1a1a' }} />
        </div>
      </div>

      {/* Mobile: full screen */}
      <div className="sm:hidden fixed inset-0 overflow-hidden" style={{ background: 'var(--background)' }}>
        {children}
      </div>
    </div>
  )
}
