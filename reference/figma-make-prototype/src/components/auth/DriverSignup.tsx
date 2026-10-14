import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { MobileFrame } from './DriverLogin'

interface Props {
  onSuccess: () => void
  onLogin: () => void
  onBack: () => void
}

const STEPS = ['Account', 'Profile', 'License', 'Documents', 'Review']

export default function DriverSignup({ onSuccess, onLogin, onBack }: Props) {
  const { signup } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '',
    driverType: 'CARRIER_DRIVER' as 'CARRIER_DRIVER' | 'FLEET_DRIVER',
    carrier: 'ABC Transport Co.',
    fleetCompany: '',
    address: '', city: '', state: '', zip: '',
    cdlNumber: '', cdlClass: 'Class A', cdlState: 'TX', cdlExpiry: '',
    medExpiry: '',
    emergencyName: '', emergencyPhone: '',
  })

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }))

  const next = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (step < STEPS.length - 1) setStep((s) => s + 1)
  }

  const back = () => {
    if (step === 0) onBack()
    else setStep((s) => s - 1)
  }

  const handleSubmit = async () => {
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    const result = signup({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      appType: 'driver',
      role: form.driverType === 'CARRIER_DRIVER' ? 'Carrier Driver' : 'Fleet Company Driver',
      driverType: form.driverType,
      carrier: form.carrier,
      fleetCompany: form.driverType === 'FLEET_DRIVER' ? form.fleetCompany : undefined,
      cdlNumber: form.cdlNumber,
    })
    setLoading(false)
    if (result.success) onSuccess()
    else setError(result.error || 'Signup failed.')
  }

  return (
    <MobileFrame>
      <div className="flex flex-col h-full">
        {/* Status bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 shrink-0">
          <span className="text-xs font-semibold text-[#e8edf5]">9:41</span>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-[#e8edf5]"><path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-3 text-[#e8edf5]">
              <rect x="1" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="8.5" width="11" height="7" rx="1" />
              <path d="M21 10v4a2 2 0 000-4z" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div className="px-6 pt-2 pb-3 shrink-0">
          <button onClick={back} className="flex items-center gap-1.5 text-emerald-400 text-sm mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {step === 0 ? 'Sign in' : STEPS[step - 1]}
          </button>
          <div className="text-xs text-emerald-400 font-mono mb-1">STEP {step + 1} OF {STEPS.length}</div>
          <h2 className="text-lg font-bold text-[#e8edf5]">{STEPS[step]}</h2>
        </div>

        {/* Progress bar */}
        <div className="px-6 pb-4 shrink-0">
          <div className="h-1 bg-[#1e2d47] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'linear-gradient(90deg, #10b981, #059669)' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {step === 0 && (
            <form onSubmit={next} className="space-y-4">
              <MobileField label="Full Name" value={form.name} onChange={(v) => set('name', v)} placeholder="John Smith" required />
              <MobileField label="Email" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="john@example.com" required />
              <MobileField label="Phone Number" type="tel" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 (555) 000-0000" required />
              <MobileField label="Password" type="password" value={form.password} onChange={(v) => set('password', v)} placeholder="Min. 6 characters" required />
              <MobileField label="Confirm Password" type="password" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} placeholder="Re-enter password" required />
              {error && <ErrorBox msg={error} />}
              <SubmitBtn label="Continue →" />
            </form>
          )}

          {step === 1 && (
            <form onSubmit={next} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-2">Driver Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['CARRIER_DRIVER', 'FLEET_DRIVER'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set('driverType', t)}
                      className="py-3 px-4 rounded-xl border text-xs font-medium transition-all"
                      style={{
                        borderColor: form.driverType === t ? '#10b981' : '#1e2d47',
                        background: form.driverType === t ? '#10b98115' : 'var(--card)',
                        color: form.driverType === t ? '#10b981' : '#64748b',
                      }}
                    >
                      {t === 'CARRIER_DRIVER' ? 'Carrier Driver' : 'Fleet Driver'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-2">Carrier</label>
                <select value={form.carrier} onChange={(e) => set('carrier', e.target.value)} className="w-full px-4 py-3.5 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none">
                  <option>ABC Transport Co.</option>
                  <option>Lone Star Freight</option>
                  <option>Great Plains Trucking</option>
                </select>
              </div>
              {form.driverType === 'FLEET_DRIVER' && (
                <MobileField label="Fleet Company" value={form.fleetCompany} onChange={(v) => set('fleetCompany', v)} placeholder="XYZ Trucking LLC" required />
              )}
              <MobileField label="Street Address" value={form.address} onChange={(v) => set('address', v)} placeholder="123 Main St" />
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="Dallas" />
                <MobileField label="State" value={form.state} onChange={(v) => set('state', v)} placeholder="TX" />
              </div>
              <MobileField label="Emergency Contact Name" value={form.emergencyName} onChange={(v) => set('emergencyName', v)} placeholder="Jane Smith" />
              <MobileField label="Emergency Contact Phone" type="tel" value={form.emergencyPhone} onChange={(v) => set('emergencyPhone', v)} placeholder="+1 (555) 000-0001" />
              <SubmitBtn label="Continue →" />
            </form>
          )}

          {step === 2 && (
            <form onSubmit={next} className="space-y-4">
              <MobileField label="CDL Number" value={form.cdlNumber} onChange={(v) => set('cdlNumber', v)} placeholder="CDL-TX-0000000" required />
              <div>
                <label className="block text-xs font-medium text-[#94a3b8] mb-2">CDL Class</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Class A', 'Class B', 'Class C'].map((c) => (
                    <button key={c} type="button" onClick={() => set('cdlClass', c)}
                      className="py-3 rounded-xl border text-xs font-medium transition-all"
                      style={{ borderColor: form.cdlClass === c ? '#10b981' : '#1e2d47', background: form.cdlClass === c ? '#10b98115' : 'var(--card)', color: form.cdlClass === c ? '#10b981' : '#64748b' }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <MobileField label="CDL State" value={form.cdlState} onChange={(v) => set('cdlState', v)} placeholder="TX" />
              <MobileField label="CDL Expiration Date" type="date" value={form.cdlExpiry} onChange={(v) => set('cdlExpiry', v)} required />
              <MobileField label="Medical Certificate Expiry" type="date" value={form.medExpiry} onChange={(v) => set('medExpiry', v)} />
              <SubmitBtn label="Continue →" />
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-[#64748b]">Upload your required documents. You can add more after account creation.</p>
              {[
                { label: 'CDL (Front)', required: true },
                { label: 'Medical Certificate', required: true },
                { label: 'MVR Report', required: false },
                { label: 'Social Security Card', required: false },
              ].map((doc) => (
                <div key={doc.label} className="flex items-center justify-between rounded-xl border border-[#1e2d47] px-4 py-4" style={{ background: 'var(--card)' }}>
                  <div>
                    <div className="text-sm font-medium text-[#94a3b8]">{doc.label}</div>
                    <div className="text-xs text-[#475569] mt-0.5">{doc.required ? 'Required' : 'Optional'}</div>
                  </div>
                  <button className="flex items-center gap-2 text-xs text-emerald-400 border border-emerald-500/30 px-3 py-2 rounded-lg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5"><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Upload
                  </button>
                </div>
              ))}
              <button onClick={() => setStep(4)} className="w-full py-4 rounded-xl font-semibold text-sm text-white" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                Continue →
              </button>
              <button onClick={() => setStep(4)} className="w-full py-3 text-xs text-[#64748b]">
                Skip for now (upload after approval)
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                <div className="text-xs font-mono text-emerald-400 font-semibold mb-4">ACCOUNT SUMMARY</div>
                <div className="space-y-2.5 text-sm">
                  {[
                    ['Name', form.name || '—'],
                    ['Email', form.email || '—'],
                    ['Phone', form.phone || '—'],
                    ['Driver Type', form.driverType.replace('_', ' ')],
                    ['Carrier', form.carrier],
                    form.fleetCompany ? ['Fleet Company', form.fleetCompany] : null,
                    ['CDL', form.cdlNumber || '—'],
                    ['CDL Class', form.cdlClass],
                  ].filter((r): r is string[] => r !== null).map(([k, v]) => (
                    <div key={String(k)} className="flex justify-between">
                      <span className="text-[#64748b]">{String(k)}</span>
                      <span className="text-[#94a3b8] font-mono text-xs">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-300">
                After creating your account, the Carrier will review and approve your profile before you become dispatch eligible.
              </div>

              {error && <ErrorBox msg={error} />}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}
              >
                {loading && <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                {loading ? 'Creating account…' : 'Create Driver Account'}
              </button>
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

function MobileField({ label, type = 'text', value, onChange, placeholder, required }: { label: string; type?: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#94a3b8] mb-2">{label}{required && <span className="text-emerald-400 ml-1">*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3.5 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none transition-colors"
        style={{ borderColor: value ? '#10b98160' : undefined }}
      />
    </div>
  )
}

function SubmitBtn({ label }: { label: string }) {
  return (
    <button type="submit" className="w-full py-4 rounded-xl font-semibold text-sm text-white mt-2" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
      {label}
    </button>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">{msg}</div>
}
