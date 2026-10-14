import { useState } from 'react'
import { useAuth, AppView } from '../../context/AuthContext'

const APP_META: Partial<Record<AppView, { label: string; color: string; tag: string; roleOptions: string[] }>> = {
  carrier: {
    label: 'Carrier Admin Portal',
    color: '#f59e0b',
    tag: 'APPLICATION 2',
    roleOptions: ['Dispatcher', 'Operations Manager', 'Carrier Admin', 'Accountant'],
  },
  fleet: {
    label: 'Fleet Company Portal',
    color: '#3b82f6',
    tag: 'APPLICATION 3',
    roleOptions: ['Fleet Administrator', 'Fleet Manager', 'Maintenance Coordinator'],
  },
  admin: {
    label: 'iWay Platform Admin',
    color: '#a855f7',
    tag: 'APPLICATION 4',
    roleOptions: ['Platform Operator', 'Platform Admin', 'Risk Analyst', 'Support Agent'],
  },
}

interface Props {
  appType: AppView
  onSuccess: () => void
  onLogin: () => void
  onBack: () => void
}

export default function PortalSignup({ appType, onSuccess, onLogin, onBack }: Props) {
  const { signup } = useAuth()
  const meta = APP_META[appType]
  if (!meta) return null

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: meta.roleOptions[0],
    company: '', password: '', confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.phone) { setError('Please fill all fields.'); return }
    setError('')
    setStep(2)
  }

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    const result = signup({
      name: form.name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      password: form.password,
      appType,
      carrier: appType === 'carrier' ? form.company : undefined,
      fleetCompany: appType === 'fleet' ? form.company : undefined,
    })
    setLoading(false)
    if (result.success) onSuccess()
    else setError(result.error || 'Signup failed.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-md">
        <button onClick={step === 1 ? onBack : () => setStep(1)} className="flex items-center gap-2 text-[#64748b] hover:text-[#94a3b8] transition-colors text-sm mb-8">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {step === 1 ? 'Back to sign in' : 'Back'}
        </button>

        {/* Header */}
        <div className="mb-8">
          <div className="text-xs font-mono mb-1" style={{ color: meta.color }}>{meta.tag}</div>
          <h1 className="text-2xl font-semibold text-[#e8edf5]">Create account</h1>
          <p className="text-sm text-[#64748b] mt-1">{meta.label}</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
                style={{ background: s <= step ? meta.color : '#1e2d47', color: s <= step ? (appType === 'carrier' ? '#070c18' : '#fff') : '#64748b' }}
              >
                {s < step ? '✓' : s}
              </div>
              <span className="text-xs text-[#64748b]">{s === 1 ? 'Profile' : 'Security'}</span>
              {s < 2 && <div className="w-8 h-px bg-[#1e2d47]" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <Field label="Full Name" value={form.name} onChange={(v) => set('name', v)} placeholder="Jane Smith" color={meta.color} />
              <Field label="Work Email" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="jane@company.com" color={meta.color} />
              <Field label="Phone Number" type="tel" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 (555) 000-0000" color={meta.color} />
              <Field
                label={appType === 'carrier' ? 'Carrier / Company Name' : appType === 'fleet' ? 'Fleet Company Name' : 'Organization'}
                value={form.company}
                onChange={(v) => set('company', v)}
                placeholder={appType === 'carrier' ? 'ABC Transport Co.' : appType === 'fleet' ? 'XYZ Trucking LLC' : 'iWay Ops'}
                color={meta.color}
              />
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => set('role', e.target.value)}
                  className="w-full px-4 py-3 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none"
                >
                  {meta.roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {error && <ErrorBox msg={error} />}
            <button type="submit" className="w-full py-3 rounded font-semibold text-sm" style={{ background: meta.color, color: appType === 'carrier' ? '#070c18' : '#fff' }}>
              Continue →
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleStep2} className="space-y-4">
            <Field label="Password" type="password" value={form.password} onChange={(v) => set('password', v)} placeholder="Min. 6 characters" color={meta.color} />
            <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} placeholder="Re-enter password" color={meta.color} />
            <div className="rounded border border-[#1e2d47] p-4 text-xs text-[#64748b]" style={{ background: 'var(--muted)' }}>
              <div className="font-semibold text-[#94a3b8] mb-1">Account summary</div>
              <div>{form.name} · {form.email}</div>
              <div className="mt-0.5">{form.role}{form.company ? ` · ${form.company}` : ''}</div>
            </div>
            {error && <ErrorBox msg={error} />}
            <button type="submit" disabled={loading} className="w-full py-3 rounded font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: meta.color, color: appType === 'carrier' ? '#070c18' : '#fff' }}>
              {loading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#64748b] mt-6">
          Already have an account?{' '}
          <button onClick={onLogin} className="font-medium" style={{ color: meta.color }}>Sign in</button>
        </p>
      </div>
    </div>
  )
}

function Field({ label, type = 'text', value, onChange, placeholder, color }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; color: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none transition-colors"
        style={{ borderColor: value ? `${color}60` : undefined }}
      />
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 font-mono">{msg}</div>
  )
}
