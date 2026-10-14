import { useState, useEffect } from 'react'
import { INITIAL_DISPATCHERS } from '../../data/dispatchers'

interface Props {
  onClose: () => void
  onCreated: (load: CreatedLoad) => void
}

export interface CreatedLoad {
  id: string
  broker: string
  brokerEmail: string
  dispatcher: string
  commodity: string
  miles: number
  weight: string
  rate: number
  paymentTerms: string
  stops: {
    type: StopType
    facility: string
    address: string
    city: string
    state: string
    date: string
    windowFrom: string
    windowTo: string
    ref: string
  }[]
}

// ── Types ────────────────────────────────────────────────────────────────────

type Step = 0 | 1 | 2 | 3

const STEPS = [
  { label: 'Customer + broker', short: 'Customer' },
  { label: 'Stops', short: 'Stops' },
  { label: 'Rate + line items', short: 'Rate' },
  { label: 'Billing + factoring', short: 'Billing' },
]

type StopType = 'PICKUP' | 'DROP-OFF'

interface Stop {
  id: string
  type: StopType
  facility: string
  address: string
  city: string
  state: string
  date: string
  windowFrom: string
  windowTo: string
  ref: string
  notes: string
}

interface LineItem {
  id: string
  description: string
  amount: string
}

interface Form {
  // Step 1
  broker: string
  brokerMC: string
  brokerRef: string
  dispatcher: string
  addInline: boolean
  inlineName: string
  inlineMC: string
  inlineEmail: string
  inlineTerms: string
  // Step 2
  stops: Stop[]
  ratConUploaded: boolean
  ratConFile: string
  estimatedMiles: string
  // Step 3
  commodity: string
  weight: string
  dims: string
  rate: string
  lineItems: LineItem[]
  // Step 4
  factored: boolean
  factoringCompany: string
  billTo: string
  paymentTerms: string
}

const BROKERS = [
  { name: 'Summit Freight', mc: 'MC 845210', email: 'ap@summitfreight.example', terms: 'Net 30' },
  { name: 'Northline Brokerage', mc: 'MC 603118', email: 'ar@northline.example', terms: 'Net 30' },
  { name: 'Crossroads Logistics', mc: 'MC 771904', email: 'pay@crossroads.example', terms: 'Quick pay' },
  { name: 'Blue Ridge Transport', mc: 'MC 512377', email: 'billing@blueridge.example', terms: 'Net 45' },
  { name: 'Gulfline Freight', mc: 'MC 699045', email: 'ap@gulfline.example', terms: 'Net 30' },
]

const FACILITIES = [
  'Lone Star Distribution · Dallas, TX',
  'Riverside Foods DC · Memphis, TN',
  'Gulf Coast Cold Storage · Houston, TX',
  'Metro Retail Hub · Atlanta, GA',
  'Tulsa Paper Mill · Tulsa, OK',
  'Front Range DC · Denver, CO',
]

const COMMODITIES = ['General freight', 'Goods', 'Manufacturing goods', 'Foods', 'Others']
const FACTORING_COS = ['Apex Capital Funding', 'OTR Solutions', 'Triumph Business Capital', 'RTS Financial']

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8) }

function generateLoadId() { return `LD-${Math.floor(10484 + Math.random() * 200)}` }

function getPayWeek(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const daysToMon = day === 0 ? 6 : day - 1
  const mon = new Date(d); mon.setDate(d.getDate() - daysToMon)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (dt: Date) => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(mon)} – ${fmt(sun)}`
}

function pickupCount(stops: Stop[]) { return stops.filter(s => s.type === 'PICKUP').length }
function dropoffCount(stops: Stop[]) { return stops.filter(s => s.type === 'DROP-OFF').length }

function makeStop(type: StopType): Stop {
  return { id: uid(), type, facility: '', address: '', city: '', state: '', date: '', windowFrom: '', windowTo: '', ref: '', notes: '' }
}

const defaultForm: Form = {
  broker: '', brokerMC: '', brokerRef: '', dispatcher: '',
  addInline: false, inlineName: '', inlineMC: '', inlineEmail: '', inlineTerms: 'Net 30',
  stops: [makeStop('PICKUP'), makeStop('DROP-OFF')],
  ratConUploaded: false, ratConFile: '', estimatedMiles: '',
  commodity: '', weight: '', dims: '', rate: '',
  lineItems: [{ id: uid(), description: '', amount: '' }],
  factored: false, factoringCompany: '', billTo: '', paymentTerms: 'Net 30',
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function CreateLoadFlow({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(0)
  const [form, setForm] = useState<Form>(defaultForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [created, setCreated] = useState(false)
  const [loadId] = useState(generateLoadId)

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  function validate(s: Step): boolean {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (!form.broker && !form.addInline) e.broker = 'Select a broker or add one inline'
      if (!form.dispatcher) e.dispatcher = 'Select the dispatcher responsible for this load'
      if (form.addInline) {
        if (!form.inlineName) e.inlineName = 'Company name required'
        if (!form.inlineMC) e.inlineMC = 'MC # required'
        if (!form.inlineEmail) e.inlineEmail = 'Bill To email required'
      }
    }
    if (s === 1) {
      form.stops.forEach((stop, i) => {
        if (!stop.address) e[`stop_${i}_address`] = 'Address required'
        if (!stop.date) e[`stop_${i}_date`] = 'Date required'
        if (!stop.windowFrom || !stop.windowTo) e[`stop_${i}_window`] = 'Time window required'
      })
      if (pickupCount(form.stops) === 0) e.stops = 'At least one pickup is required'
      if (dropoffCount(form.stops) === 0) e.stops = 'At least one drop-off is required'
    }
    if (s === 2) {
      if (!form.commodity) e.commodity = 'Commodity required'
      if (!form.rate) e.rate = 'Rate required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate(step)) return
    setStep(s => Math.min(s + 1, 3) as Step)
    setErrors({})
  }

  function back() {
    if (step === 0) { onClose(); return }
    setStep(s => Math.max(s - 1, 0) as Step)
    setErrors({})
  }

  function submit() {
    if (!validate(step)) return
    setCreated(true)
    onCreated({
      id: loadId,
      broker: activeBroker?.name || 'Direct customer',
      brokerEmail: activeBroker?.email || form.inlineEmail || form.billTo,
      dispatcher: form.dispatcher,
      commodity: form.commodity || 'General freight',
      miles: Number(form.estimatedMiles) || 0,
      weight: form.weight ? `${form.weight} lb` : '—',
      rate: Number(form.rate) || 0,
      paymentTerms: form.paymentTerms,
      stops: form.stops.map(stop => ({
        type: stop.type,
        facility: stop.facility || `${stop.city}, ${stop.state}`,
        address: stop.address,
        city: stop.city,
        state: stop.state,
        date: stop.date,
        windowFrom: stop.windowFrom,
        windowTo: stop.windowTo,
        ref: stop.ref,
      })),
    })
  }

  const activeBroker = form.addInline
    ? { name: form.inlineName || 'New broker', mc: form.inlineMC, terms: form.inlineTerms, email: form.inlineEmail }
    : BROKERS.find(b => b.name === form.broker)

  const firstPickup = form.stops.find(s => s.type === 'PICKUP')

  if (created) {
    return (
      <Overlay onClose={onClose}>
        <div className="flex flex-col items-center justify-center h-full px-8 text-center">
          <div className="w-16 h-16 rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center mb-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="w-8 h-8">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-xs font-mono text-emerald-400 font-semibold tracking-wider mb-2">LOAD CREATED</div>
          <div className="font-mono text-3xl font-bold text-[#e8edf5] mb-1">{loadId}</div>
          <div className="text-sm text-[#64748b] mb-0.5">
            {firstPickup?.city && firstPickup?.state
              ? `${firstPickup.city}, ${firstPickup.state} → ${form.stops.find(s => s.type === 'DROP-OFF')?.city || '—'}, ${form.stops.find(s => s.type === 'DROP-OFF')?.state || ''}`
              : 'Route pending'}
          </div>
          <div className="text-xs text-[#475569] mb-1">{activeBroker?.name || '—'} · Dispatcher: {form.dispatcher} · {form.commodity || 'General freight'}</div>
          {form.rate && <div className="text-xs font-mono text-amber-400 mb-8">${parseFloat(form.rate).toLocaleString('en', { minimumFractionDigits: 2 })}</div>}

          <div className="rounded border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-300 text-left w-full max-w-xs mb-6 font-mono">
            Status: New request · Assign driver + truck from Load Manager
          </div>

          <div className="w-full max-w-xs space-y-3">
            <button onClick={onClose} className="w-full py-3 rounded font-semibold text-sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              Open in Load Manager
            </button>
            <button onClick={() => { setCreated(false); setStep(0); setForm(defaultForm) }} className="w-full py-2.5 rounded text-sm text-[#64748b] border border-[#1e2d47] hover:text-[#94a3b8] transition-colors">
              Create another load
            </button>
          </div>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex flex-col h-full">
        {/* Header / breadcrumb */}
        <div className="shrink-0 px-6 py-3.5 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="text-xs text-[#475569]">
            Load Manager <span className="mx-1">/</span>
            <span className="text-[#e8edf5] font-semibold">New load</span>
            <span className="font-mono text-[#64748b] ml-2">{loadId} · draft</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="shrink-0 px-6 py-3 border-b border-[#1e2d47] flex items-center gap-1">
          {STEPS.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <div key={s.short} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all select-none ${
                    active ? 'border' : done ? '' : ''
                  }`}
                  style={
                    active
                      ? { background: '#1d4ed820', color: '#60a5fa', border: '1px solid #3b82f640' }
                      : done
                      ? { color: '#10b981' }
                      : { color: '#475569' }
                  }
                >
                  {done ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ) : (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${active ? 'bg-blue-500 text-white' : 'bg-[#1e2d47] text-[#64748b]'}`}>
                      {i + 1}
                    </div>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{s.short}</span>
                </div>
                {i < STEPS.length - 1 && <div className="w-4 h-px bg-[#1e2d47]" />}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 0 && <Step1Customer form={form} set={set} errors={errors} />}
          {step === 1 && <Step2Stops form={form} set={set} errors={errors} loadId={loadId} activeBroker={activeBroker} />}
          {step === 2 && <Step3Rate form={form} set={set} errors={errors} />}
          {step === 3 && <Step4Billing form={form} set={set} errors={errors} activeBroker={activeBroker} />}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between gap-3" style={{ background: 'var(--card)' }}>
          <button onClick={back} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors">
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          <div className="flex items-center gap-3">
            <button className="text-sm text-[#475569] hover:text-[#64748b] transition-colors">Save draft</button>
            {step < 3 ? (
              <button onClick={next} className="px-5 py-2.5 rounded text-sm font-semibold transition-all hover:opacity-90" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                Continue to {STEPS[step + 1].short} →
              </button>
            ) : (
              <button onClick={submit} className="px-5 py-2.5 rounded text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">
                Create load
              </button>
            )}
          </div>
        </div>
      </div>
    </Overlay>
  )
}

// ── Overlay ───────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[720px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  )
}

// ── Step 1: Customer + broker ─────────────────────────────────────────────────

function Step1Customer({ form, set, errors }: {
  form: Form
  set: <K extends keyof Form>(k: K, v: Form[K]) => void
  errors: Record<string, string>
}) {
  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">Customer + broker</h2>
        <p className="text-xs text-[#64748b] mt-0.5">Who is tendering this load and paying the invoice?</p>
      </div>

      {/* Broker list */}
      {!form.addInline && (
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-2">Select broker <span className="text-amber-400">*</span></label>
          <div className="space-y-2">
            {BROKERS.map(b => (
              <button
                key={b.name}
                type="button"
                onClick={() => { set('broker', b.name); set('brokerMC', b.mc); set('paymentTerms', b.terms) }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded border text-left transition-all ${form.broker === b.name ? 'border-blue-500/50' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
                style={{ background: form.broker === b.name ? '#1d4ed815' : 'var(--card)' }}
              >
                <div>
                  <div className={`text-sm font-medium ${form.broker === b.name ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{b.name}</div>
                  <div className="text-xs text-[#475569] mt-0.5">{b.mc} · {b.terms} · {b.email}</div>
                </div>
                {form.broker === b.name && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" className="w-4 h-4 shrink-0">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { set('addInline', true); set('broker', '') }}
              className="w-full flex items-center gap-2 px-4 py-3 rounded border border-dashed border-[#2a3a54] text-sm text-[#64748b] hover:text-[#94a3b8] hover:border-[#3a4a64] transition-all text-left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M12 4v16m-8-8h16" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Add broker inline
            </button>
          </div>
          {errors.broker && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.broker}</p>}
        </div>
      )}

      {/* Inline broker form */}
      {form.addInline && (
        <div className="rounded border border-amber-500/25 p-4 space-y-3" style={{ background: '#f59e0b08' }}>
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-amber-300 font-mono">NEW BROKER · DRAFT</div>
            <button onClick={() => set('addInline', false)} className="text-xs text-[#475569] hover:text-[#64748b]">← Back to list</button>
          </div>
          <FormRow>
            <Field label="Company name" required error={errors.inlineName}>
              <input value={form.inlineName} onChange={e => set('inlineName', e.target.value)} placeholder="e.g. Summit Freight LLC" className={inp} />
            </Field>
            <Field label="MC #" required error={errors.inlineMC}>
              <input value={form.inlineMC} onChange={e => set('inlineMC', e.target.value)} placeholder="MC 000000" className={inp} />
            </Field>
          </FormRow>
          <Field label="Bill To email" required error={errors.inlineEmail}>
            <input type="email" value={form.inlineEmail} onChange={e => set('inlineEmail', e.target.value)} placeholder="ap@broker.example" className={inp} />
          </Field>
          <FormRow>
            <Field label="Payment terms">
              <select value={form.inlineTerms} onChange={e => set('inlineTerms', e.target.value)} className={inp}>
                {['Quick pay', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Factored loads">
              <select className={inp}><option>Yes · via factor</option><option>No</option></select>
            </Field>
          </FormRow>
          <div className="rounded bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
            This broker will be saved as a draft and must pass FMCSA authority + credit verification before going live.
          </div>
        </div>
      )}

      {/* Broker reference */}
      <Field label="Broker reference / PO #">
        <input value={form.brokerRef} onChange={e => set('brokerRef', e.target.value)} placeholder="e.g. PO-55821 (optional)" className={inp} />
      </Field>

      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-2">Responsible dispatcher <span className="text-amber-400">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          {INITIAL_DISPATCHERS.filter(dispatcher => dispatcher.status === 'Active').map(dispatcher => (
            <button
              key={dispatcher.id}
              type="button"
              onClick={() => set('dispatcher', dispatcher.name)}
              className={`flex items-center gap-3 rounded border px-3 py-3 text-left ${
                form.dispatcher === dispatcher.name ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47] hover:border-[#2a3a54]'
              }`}
            >
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${form.dispatcher === dispatcher.name ? 'bg-amber-500 text-[#070c18]' : 'bg-[#1e2d47] text-[#64748b]'}`}>{dispatcher.initials}</span>
              <span><span className="block text-sm font-medium text-[#e8edf5]">{dispatcher.name}</span><span className="block text-xs text-[#475569] mt-0.5">{dispatcher.region} · {dispatcher.activeLoads} active</span></span>
            </button>
          ))}
        </div>
        {errors.dispatcher && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.dispatcher}</p>}
      </div>
    </div>
  )
}

// ── Step 2: Stops ─────────────────────────────────────────────────────────────

function Step2Stops({ form, set, errors, loadId, activeBroker }: {
  form: Form
  set: <K extends keyof Form>(k: K, v: Form[K]) => void
  errors: Record<string, string>
  loadId: string
  activeBroker: { name: string; mc?: string; terms?: string } | undefined
}) {
  function updateStop(id: string, key: keyof Stop, val: string) {
    set('stops', form.stops.map(s => s.id === id ? { ...s, [key]: val } : s))
  }

  function addStop() {
    const hasPickup = pickupCount(form.stops) > 0
    const hasDropoff = dropoffCount(form.stops) > 0
    const newType: StopType = hasPickup && !hasDropoff ? 'DROP-OFF' : hasDropoff && !hasPickup ? 'PICKUP' : 'DROP-OFF'
    set('stops', [...form.stops, makeStop(newType)])
  }

  function removeStop(id: string) {
    if (form.stops.length <= 2) return
    set('stops', form.stops.filter(s => s.id !== id))
  }

  function toggleStopType(id: string) {
    set('stops', form.stops.map(s => s.id === id ? { ...s, type: s.type === 'PICKUP' ? 'DROP-OFF' : 'PICKUP' } : s))
  }

  const firstPickup = form.stops.find(s => s.type === 'PICKUP')
  const payWeek = getPayWeek(firstPickup?.date || '')
  const pCount = pickupCount(form.stops)
  const dCount = dropoffCount(form.stops)
  const mileEstimate = form.estimatedMiles || (form.stops.every(s => s.date) ? '—' : '—')

  function simulateRatConUpload() {
    set('ratConUploaded', true)
    set('ratConFile', 'RateCon_LD-' + loadId.split('-')[1] + '.pdf')
    // Simulate auto-fill
    if (!form.stops[0].address) {
      set('stops', form.stops.map((s, i) => i === 0 ? {
        ...s, facility: 'Lone Star Distribution', address: '4100 Irving Blvd', city: 'Dallas', state: 'TX',
        date: '2026-09-29', windowFrom: '08:00', windowTo: '11:00', ref: 'PU-55821'
      } : i === 1 ? {
        ...s, facility: 'Riverside Foods DC', address: '2200 Channel Ave', city: 'Memphis', state: 'TN',
        date: '2026-09-30', windowFrom: '06:00', windowTo: '14:00', ref: 'PO-771204'
      } : s))
      set('estimatedMiles', '452')
    }
  }

  return (
    <div className="h-full overflow-hidden flex">
      {/* Left: stop cards */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-w-0">
        <div>
          <h2 className="text-base font-semibold text-[#e8edf5]">Stops</h2>
          <p className="text-xs text-[#64748b] mt-0.5">Add all pickup and drop-off locations. Time zones set automatically from address.</p>
        </div>

        {errors.stops && <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-3 py-2 rounded">{errors.stops}</p>}

        {form.stops.map((stop, i) => {
          const stopLabel = stop.type === 'PICKUP'
            ? `PICKUP ${form.stops.filter((s, j) => s.type === 'PICKUP' && j <= i).length}`
            : `DROP-OFF ${form.stops.filter((s, j) => s.type === 'DROP-OFF' && j <= i).length}`
          const stopColor = stop.type === 'PICKUP' ? '#10b981' : '#3b82f6'

          return (
            <div key={stop.id} className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
              {/* Stop header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStopType(stop.id)}
                    className="text-xs font-bold px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: `${stopColor}20`, color: stopColor, border: `1px solid ${stopColor}40` }}
                    title="Click to toggle pickup/drop-off"
                  >
                    {stopLabel}
                  </button>
                  {stop.facility && <span className="text-sm font-semibold text-[#e8edf5]">{stop.facility}</span>}
                </div>
                <div className="flex items-center gap-2">
                  {(stop.city && stop.state) && (
                    <span className="text-xs text-[#475569]">Time zone set from address: Central</span>
                  )}
                  {form.stops.length > 2 && (
                    <button onClick={() => removeStop(stop.id)} className="text-[#475569] hover:text-red-400 transition-colors ml-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Stop fields */}
              <div className="px-4 py-4 space-y-3">
                {/* Facility */}
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1">Facility name</label>
                  <div className="relative">
                    <input
                      value={stop.facility}
                      onChange={e => updateStop(stop.id, 'facility', e.target.value)}
                      placeholder="Facility name (optional)"
                      className={inp}
                      list={`facilities-${stop.id}`}
                    />
                    <datalist id={`facilities-${stop.id}`}>
                      {FACILITIES.map(f => <option key={f} value={f.split(' · ')[0]} />)}
                    </datalist>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-medium text-[#64748b] mb-1">Address <span className="text-amber-400">*</span></label>
                  <input
                    value={stop.address}
                    onChange={e => updateStop(stop.id, 'address', e.target.value)}
                    placeholder="Street address"
                    className={`${inp} ${errors[`stop_${i}_address`] ? 'border-red-500/50' : ''}`}
                  />
                  {errors[`stop_${i}_address`] && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors[`stop_${i}_address`]}</p>}
                </div>

                {/* City / State */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-[#64748b] mb-1">City</label>
                    <input value={stop.city} onChange={e => updateStop(stop.id, 'city', e.target.value)} placeholder="Dallas" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">State</label>
                    <input value={stop.state} onChange={e => updateStop(stop.id, 'state', e.target.value.toUpperCase().slice(0, 2))} placeholder="TX" className={inp} />
                  </div>
                </div>

                {/* Date / Window */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Date <span className="text-amber-400">*</span></label>
                    <input
                      type="date"
                      value={stop.date}
                      onChange={e => updateStop(stop.id, 'date', e.target.value)}
                      className={`${inp} ${errors[`stop_${i}_date`] ? 'border-red-500/50' : ''}`}
                    />
                    {errors[`stop_${i}_date`] && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors[`stop_${i}_date`]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">
                      Window (from – to) <span className="text-amber-400">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        value={stop.windowFrom}
                        onChange={e => updateStop(stop.id, 'windowFrom', e.target.value)}
                        className={`${inp} flex-1 ${errors[`stop_${i}_window`] ? 'border-red-500/50' : ''}`}
                      />
                      <span className="text-[#475569] text-xs">–</span>
                      <input
                        type="time"
                        value={stop.windowTo}
                        onChange={e => updateStop(stop.id, 'windowTo', e.target.value)}
                        className={`${inp} flex-1 ${errors[`stop_${i}_window`] ? 'border-red-500/50' : ''}`}
                      />
                    </div>
                    {errors[`stop_${i}_window`] && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors[`stop_${i}_window`]}</p>}
                  </div>
                </div>

                {/* Ref / Notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Reference / PO #</label>
                    <input value={stop.ref} onChange={e => updateStop(stop.id, 'ref', e.target.value)} placeholder="PU-55821" className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#64748b] mb-1">Private notes (optional)</label>
                    <input value={stop.notes} onChange={e => updateStop(stop.id, 'notes', e.target.value)} placeholder="Dock 14, check in at guard shack" className={inp} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Add stop */}
        <button
          type="button"
          onClick={addStop}
          className="flex items-center gap-2 px-4 py-2.5 rounded border border-dashed border-[#2a3a54] text-sm text-[#64748b] hover:text-[#94a3b8] hover:border-[#3a4a64] transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M12 4v16m-8-8h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          + Add stop
        </button>

        <div className="h-2" />
      </div>

      {/* Right: Import rate con + Load summary */}
      <div className="w-64 shrink-0 border-l border-[#1e2d47] p-4 space-y-4 overflow-y-auto hidden sm:block">
        {/* Import rate confirmation */}
        <div className="rounded border-2 border-dashed border-amber-500/40 p-4" style={{ background: '#f59e0b08' }}>
          <div className="text-xs font-semibold text-[#e8edf5] mb-1">Import rate confirmation</div>
          {!form.ratConUploaded ? (
            <>
              <div className="text-xs text-[#64748b] mb-3 leading-relaxed">Drop the broker's PDF to fill stops, rate and reference numbers. You review before saving.</div>
              <button
                onClick={simulateRatConUpload}
                className="w-full py-2 rounded text-xs font-semibold"
                style={{ background: '#f59e0b', color: '#0d1117' }}
              >
                Upload PDF
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {form.ratConFile}
              </div>
              <div className="text-xs text-[#64748b]">Stops and rate auto-filled. Review below.</div>
              <button onClick={() => { set('ratConUploaded', false); set('ratConFile', '') }} className="text-xs text-[#475569] hover:text-[#64748b]">Remove</button>
            </div>
          )}
        </div>

        {/* Load summary */}
        <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
          <div className="px-3 py-2.5 border-b border-[#1e2d47]">
            <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">Load summary</div>
          </div>
          <div className="px-3 py-3 space-y-2.5 text-xs">
            <SummaryRow label="Broker" value={activeBroker?.name || '—'} />
            <SummaryRow label="Dispatcher" value={form.dispatcher || '—'} />
            <SummaryRow
              label="Stops"
              value={pCount > 0 || dCount > 0
                ? `${pCount} pickup${pCount !== 1 ? 's' : ''} · ${dCount} drop-off${dCount !== 1 ? 's' : ''}`
                : '—'}
            />
            <SummaryRow
              label="Estimated miles"
              value={form.estimatedMiles ? `${parseInt(form.estimatedMiles).toLocaleString()} mi` : '—'}
            />
            <SummaryRow
              label="Pay week (first pickup)"
              value={payWeek}
            />
            <SummaryRow
              label="Rate confirmation"
              value={form.ratConUploaded ? form.ratConFile : 'Not uploaded'}
              valueColor={form.ratConUploaded ? '#10b981' : undefined}
            />
          </div>
        </div>

        {/* Est miles override */}
        <div>
          <label className="block text-xs text-[#64748b] mb-1">Estimated miles (override)</label>
          <input
            type="number"
            value={form.estimatedMiles}
            onChange={e => set('estimatedMiles', e.target.value)}
            placeholder="e.g. 452"
            className={inp}
          />
        </div>
      </div>
    </div>
  )
}

// ── Step 3: Rate + line items ──────────────────────────────────────────────────

function Step3Rate({ form, set, errors }: {
  form: Form
  set: <K extends keyof Form>(k: K, v: Form[K]) => void
  errors: Record<string, string>
}) {
  function addLineItem() {
    set('lineItems', [...form.lineItems, { id: uid(), description: '', amount: '' }])
  }
  function updateLineItem(id: string, key: 'description' | 'amount', val: string) {
    set('lineItems', form.lineItems.map(li => li.id === id ? { ...li, [key]: val } : li))
  }
  function removeLineItem(id: string) {
    if (form.lineItems.length <= 1) return
    set('lineItems', form.lineItems.filter(li => li.id !== id))
  }

  const totalLineItems = form.lineItems.reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0)
  const totalRate = (parseFloat(form.rate) || 0) + totalLineItems

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">Rate + line items</h2>
        <p className="text-xs text-[#64748b] mt-0.5">Commercial rate is carrier-controlled and not visible to drivers or fleet companies.</p>
      </div>

      {/* Commodity */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-2">Commodity type <span className="text-amber-400">*</span></label>
        <div className="flex flex-wrap gap-2">
          {COMMODITIES.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => set('commodity', c)}
              className={`px-3 py-2 rounded border text-xs font-medium transition-all ${form.commodity === c ? 'border-amber-500/50 text-amber-300' : 'border-[#1e2d47] text-[#64748b] hover:border-[#2a3a54] hover:text-[#94a3b8]'}`}
              style={{ background: form.commodity === c ? '#f59e0b10' : 'var(--card)' }}
            >
              {c}
            </button>
          ))}
        </div>
        {errors.commodity && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.commodity}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Weight (lbs)">
          <input type="number" value={form.weight} onChange={e => set('weight', e.target.value)} placeholder="38500" className={inp} />
        </Field>
        <Field label="Load dimensions (optional)">
          <input value={form.dims} onChange={e => set('dims', e.target.value)} placeholder='e.g. 48" × 40" × 60"' className={inp} />
        </Field>
      </div>

      <Divider />

      {/* Rate */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-2">Line-haul rate (USD) <span className="text-amber-400">*</span></label>
        <div className="relative max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] text-sm">$</span>
          <input
            type="number"
            step="0.01"
            value={form.rate}
            onChange={e => set('rate', e.target.value)}
            placeholder="2,450.00"
            className={`${inp} pl-7 ${errors.rate ? 'border-red-500/50' : ''}`}
          />
        </div>
        {errors.rate && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.rate}</p>}
      </div>

      {/* Line items */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-2">Additional line items (optional)</label>
        <div className="space-y-2">
          {form.lineItems.map(li => (
            <div key={li.id} className="flex items-center gap-2">
              <input
                value={li.description}
                onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                placeholder="e.g. Fuel surcharge, Detention, Lumper"
                className={`${inp} flex-1`}
              />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={li.amount}
                  onChange={e => updateLineItem(li.id, 'amount', e.target.value)}
                  placeholder="0.00"
                  className={`${inp} pl-7`}
                />
              </div>
              {form.lineItems.length > 1 && (
                <button onClick={() => removeLineItem(li.id)} className="text-[#475569] hover:text-red-400 transition-colors shrink-0">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addLineItem} className="mt-2 text-xs text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M12 4v16m-8-8h16" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Add line item
        </button>
      </div>

      {/* Total */}
      {(form.rate || totalLineItems > 0) && (
        <div className="rounded border border-[#1e2d47] p-4 max-w-xs" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-mono text-[#475569] font-semibold uppercase tracking-wide mb-2">Rate summary</div>
          <div className="space-y-1.5 text-sm">
            {form.rate && (
              <div className="flex justify-between">
                <span className="text-[#64748b]">Line-haul</span>
                <span className="font-mono text-[#e8edf5]">${parseFloat(form.rate || '0').toFixed(2)}</span>
              </div>
            )}
            {form.lineItems.filter(li => li.amount).map(li => (
              <div key={li.id} className="flex justify-between">
                <span className="text-[#64748b]">{li.description || 'Line item'}</span>
                <span className="font-mono text-[#94a3b8]">+${parseFloat(li.amount).toFixed(2)}</span>
              </div>
            ))}
            {(totalLineItems > 0 || form.rate) && (
              <>
                <div className="border-t border-[#1e2d47] pt-1.5 flex justify-between">
                  <span className="font-semibold text-[#94a3b8]">Total</span>
                  <span className="font-mono font-bold text-[#e8edf5]">${totalRate.toFixed(2)}</span>
                </div>
                {form.estimatedMiles && parseFloat(form.rate || '0') > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#475569]">Rate per mile</span>
                    <span className="font-mono text-[#64748b]">
                      ${(parseFloat(form.rate) / parseInt(form.estimatedMiles)).toFixed(2)}/mi
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Billing + factoring ───────────────────────────────────────────────

function Step4Billing({ form, set, errors, activeBroker }: {
  form: Form
  set: <K extends keyof Form>(k: K, v: Form[K]) => void
  errors: Record<string, string>
  activeBroker: { name: string; mc?: string; terms?: string } | undefined
}) {
  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">Billing + factoring</h2>
        <p className="text-xs text-[#64748b] mt-0.5">How will the invoice be paid — direct from the broker, or via your factoring company?</p>
      </div>

      {/* Factored / Non-factored */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-2">Billing method</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { val: false, label: 'Non-factored', sub: 'Invoice goes directly to the broker', icon: '🏦' },
            { val: true, label: 'Factored', sub: 'Invoice goes to your factoring company', icon: '⚡' },
          ].map(opt => (
            <button
              key={String(opt.val)}
              type="button"
              onClick={() => set('factored', opt.val)}
              className={`px-4 py-4 rounded border text-left transition-all ${form.factored === opt.val ? 'border-amber-500/50' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
              style={{ background: form.factored === opt.val ? '#f59e0b08' : 'var(--card)' }}
            >
              <div className="text-lg mb-1">{opt.icon}</div>
              <div className={`text-sm font-semibold ${form.factored === opt.val ? 'text-amber-300' : 'text-[#94a3b8]'}`}>{opt.label}</div>
              <div className="text-xs text-[#475569] mt-0.5 leading-relaxed">{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Factored: factoring company */}
      {form.factored && (
        <div className="rounded border border-[#1e2d47] p-4 space-y-3" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">Factoring company</div>
          <div className="space-y-2">
            {FACTORING_COS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => set('factoringCompany', f)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded border text-left transition-all ${form.factoringCompany === f ? 'border-amber-500/50' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
                style={{ background: form.factoringCompany === f ? '#f59e0b08' : 'var(--muted)' }}
              >
                <span className={`text-sm ${form.factoringCompany === f ? 'text-amber-300' : 'text-[#94a3b8]'}`}>{f}</span>
                {form.factoringCompany === f && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="w-4 h-4"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </button>
            ))}
          </div>
          <div className="text-xs text-amber-300/70 font-mono">Notice of assignment will be sent to the broker automatically on approval.</div>
        </div>
      )}

      {/* Non-factored: Bill To */}
      {!form.factored && (
        <div className="rounded border border-[#1e2d47] p-4 space-y-3" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">Bill To</div>
          <div className="flex items-center justify-between px-4 py-3 rounded border border-blue-500/30" style={{ background: '#1d4ed810' }}>
            <div>
              <div className="text-sm font-semibold text-[#e8edf5]">{activeBroker?.name || 'Broker (set in step 1)'}</div>
              {activeBroker?.mc && <div className="text-xs text-[#64748b] mt-0.5">{activeBroker.mc}</div>}
            </div>
            <span className="text-xs text-blue-400 font-mono">Auto-set from broker</span>
          </div>
        </div>
      )}

      {/* Payment terms */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-2">Payment terms</label>
        <div className="flex flex-wrap gap-2">
          {['Quick pay', 'Net 15', 'Net 30', 'Net 45', 'Net 60'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('paymentTerms', t)}
              className={`px-3 py-2 rounded border text-xs font-medium transition-all ${form.paymentTerms === t ? 'border-amber-500/50 text-amber-300' : 'border-[#1e2d47] text-[#64748b] hover:border-[#2a3a54] hover:text-[#94a3b8]'}`}
              style={{ background: form.paymentTerms === t ? '#f59e0b10' : 'var(--card)' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Summary preview */}
      <div className="rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
        <div className="px-4 py-3 border-b border-[#1e2d47]">
          <div className="text-xs font-mono font-semibold text-[#475569] uppercase tracking-wide">Load review</div>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs">
          <SummaryRow label="Broker" value={activeBroker?.name || '—'} />
          <SummaryRow label="Dispatcher" value={form.dispatcher || '—'} />
          <SummaryRow label="Billing" value={form.factored ? `Factored · ${form.factoringCompany || 'Select company'}` : `Non-factored · ${activeBroker?.name || 'Direct'}`} />
          <SummaryRow label="Terms" value={form.paymentTerms} />
          <SummaryRow label="Status after creation" value="New request" valueColor="#64748b" />
        </div>
      </div>

      <div className="rounded border border-blue-500/20 px-4 py-3 text-xs text-[#64748b] font-mono" style={{ background: '#3b82f608' }}>
        After creation, assign a driver + truck from the Load Manager board.
      </div>
    </div>
  )
}

// ── Shared components ─────────────────────────────────────────────────────────

const inp = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none focus:border-amber-500/40 transition-colors'

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">
        {label}{required && <span className="text-amber-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1 font-mono">{error}</p>}
    </div>
  )
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}

function Divider() { return <div className="border-t border-[#1e2d47]" /> }

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#64748b] shrink-0">{label}</span>
      <span className="text-right font-medium" style={{ color: valueColor || '#94a3b8' }}>{value}</span>
    </div>
  )
}
