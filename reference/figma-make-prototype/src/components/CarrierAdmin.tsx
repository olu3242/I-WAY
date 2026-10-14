import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import CreateLoadFlow from './carrier/CreateLoadFlow'
import { BrokerNotification, FleetVehicle, getVehicleServiceProjection, useOperations, WorkflowLoad } from '../context/OperationsContext'
import { DispatcherRecord, INITIAL_DISPATCHERS } from '../data/dispatchers'

type AppView = 'landing' | 'driver' | 'carrier' | 'fleet' | 'admin'
interface Props { onNavigate: (view: AppView) => void }

type Screen = 'dashboard' | 'load-manager' | 'dispatchers' | 'fleet-resources' | 'directory' | 'onboarding' | 'compliance' | 'accounting' | 'reports' | 'settings'

const NAV: { id: Screen; label: string; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'load-manager', label: 'Load Manager' },
  { id: 'dispatchers', label: 'Dispatchers' },
  { id: 'fleet-resources', label: 'Asset' },
  { id: 'directory', label: 'Directory' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'accounting', label: 'Accounting' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Settings' },
]

export default function CarrierAdmin({ onNavigate }: Props) {
  const { user, logout } = useAuth()
  const { createLoad } = useOperations()
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [showCreateLoad, setShowCreateLoad] = useState(false)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header className="border-b border-[#1e2d47] px-4 md:px-6 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => onNavigate('landing')} className="text-[#475569] hover:text-[#64748b] transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* iWay logo */}
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
            <path d="M12 3L4 9v12h16V9L12 3z" stroke="#f59e0b" strokeWidth="1.5" fill="#f59e0b20" />
            <path d="M9 21V12h6v9" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="font-semibold text-[#e8edf5] text-sm">iWay Dispatch</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded text-xs text-[#64748b] border border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Current Way Logistics
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2.5 py-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />3 Alerts
          </div>
          <button onClick={() => setShowCreateLoad(true)} className="px-3 py-1.5 rounded text-xs font-semibold hidden sm:block" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            + New load
          </button>
          <button onClick={() => { logout(); onNavigate('landing') }} className="text-xs text-[#475569] hover:text-[#64748b] transition-colors px-2 py-1 rounded border border-[#1e2d47]">Sign out</button>
          <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold text-white">{user?.avatar || 'MO'}</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-48 border-r border-[#1e2d47] p-3 hidden md:flex flex-col gap-0.5 shrink-0" style={{ background: 'var(--card)' }}>
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex items-center px-3 py-2 rounded text-sm transition-all text-left ${
                screen === item.id ? 'font-semibold' : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#111827]'
              }`}
              style={screen === item.id ? { background: '#3b82f620', color: '#60a5fa' } : {}}
            >
              {screen === item.id && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-2 shrink-0" />}
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-3 border-t border-[#1e2d47]">
            <div className="text-xs text-[#475569] px-3 py-1 font-mono">Carrier</div>
            <div className="text-xs text-[#64748b] px-3 font-semibold">Current Way Logistics</div>
          </div>
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {screen === 'dashboard' && <Dashboard setScreen={setScreen} onCreateLoad={() => setShowCreateLoad(true)} />}
          {screen === 'load-manager' && <LoadManager onCreateLoad={() => setShowCreateLoad(true)} />}
          {screen === 'dispatchers' && <DispatchersScreen />}
          {screen === 'fleet-resources' && <FleetResourcesScreen onOnboard={() => setScreen('onboarding')} />}
          {screen === 'directory' && <DirectoryScreen />}
          {screen === 'onboarding' && <OnboardingHub />}
          {screen === 'compliance' && <ComplianceCentre />}
          {screen === 'accounting' && <AccountingScreen />}
          {screen === 'reports' && <ReportsScreen />}
          {screen === 'settings' && <SettingsScreen />}
        </main>
      </div>

      {showCreateLoad && (
        <CreateLoadFlow
          onClose={() => setShowCreateLoad(false)}
          onCreated={(load) => {
            createLoad(load)
            setShowCreateLoad(false)
            setScreen('load-manager')
          }}
        />
      )}
    </div>
  )
}

/* ── Dashboard (Screen 01) ── */
function Dashboard({ setScreen, onCreateLoad }: { setScreen: (s: Screen) => void; onCreateLoad: () => void }) {
  const ACTIVE_LOADS = [
    { id: 'LD-10482', broker: 'Summit Freight', route: 'Dallas, TX → Memphis, TN', driver: 'J. Carter', truck: 'T-104', status: 'In transit', rate: 2450 },
    { id: 'LD-10479', broker: 'Northline Brokerage', route: 'Houston, TX → Atlanta, GA', driver: 'R. Diaz', truck: 'T-112', status: 'Accepted', rate: 3100 },
    { id: 'LD-10477', broker: 'Summit Freight', route: 'Fort Worth, TX → Tulsa, OK', driver: 'A. Bekele', truck: 'T-108', status: 'Assigned', rate: 1280 },
    { id: 'LD-10476', broker: 'Crossroads Logistics', route: 'San Antonio, TX → Phoenix, AZ', driver: 'Unassigned', truck: '—', status: 'New request', rate: 3850 },
    { id: 'LD-10471', broker: 'Northline Brokerage', route: 'Austin, TX → Denver, CO', driver: 'M. Okafor', truck: 'T-101', status: 'In transit', rate: 3420 },
    { id: 'LD-10468', broker: 'Crossroads Logistics', route: 'Dallas, TX → Little Rock, AR', driver: 'J. Carter', truck: 'T-104', status: 'TONU', rate: 250 },
  ]

  const STATUS_COLORS: Record<string, string> = {
    'In transit': '#3b82f6', 'Accepted': '#3b82f6', 'Assigned': '#f59e0b',
    'New request': '#64748b', 'TONU': '#ef4444',
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8edf5]">Dashboard</h1>
          <p className="text-xs text-[#64748b] mt-0.5">Week of Sep 21 – 27, 2026</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center border border-[#1e2d47] rounded overflow-hidden">
            <input placeholder="Search loads, drivers, brokers" className="bg-transparent text-xs text-[#94a3b8] placeholder-[#475569] px-3 py-2 w-52 focus:outline-none" />
            <div className="px-3 py-2 border-l border-[#1e2d47]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-[#475569]"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" /></svg>
            </div>
          </div>
          <button onClick={onCreateLoad} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            + New load
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Active loads', value: '18', sub: '4 need a driver', color: '#e8edf5', bg: 'var(--card)' },
          { label: 'In transit', value: '7', sub: '2 running late vs ETA', color: '#e8edf5', bg: 'var(--card)' },
          { label: 'Unpaid invoices', value: '$42,300', sub: '9 invoices · 3 over 30 days', color: '#e8edf5', bg: 'var(--card)' },
          { label: 'Documents expiring · 30 days', value: '5', sub: '1 already expired', color: '#f59e0b', bg: '#f59e0b0a' },
        ].map((k) => (
          <div key={k.label} className="rounded border border-[#1e2d47] p-4 cursor-pointer hover:border-amber-500/30 transition-all" style={{ background: k.bg }}>
            <div className="text-xs text-[#64748b] mb-1">{k.label}</div>
            <div className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</div>
            <div className="text-xs mt-0.5" style={{ color: k.color === '#f59e0b' ? '#f59e0b99' : '#64748b' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Active loads table */}
        <div className="lg:col-span-2 rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]">
            <div className="text-sm font-semibold text-[#e8edf5]">Active loads <span className="text-xs text-[#64748b] font-normal ml-1">6 of 18</span></div>
            <button onClick={() => setScreen('load-manager')} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Open load board →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2d47]">
                  {['LOAD', 'BROKER', 'ROUTE', 'DRIVER · TRUCK', 'STATUS', 'RATE'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-[#475569] font-medium tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d47]">
                {ACTIVE_LOADS.map((row) => (
                  <tr key={row.id} className="hover:bg-[#111827] transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono text-amber-400">{row.id}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{row.broker}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{row.route}</td>
                    <td className="px-4 py-3 text-[#64748b]">{row.driver === 'Unassigned' ? <span className="text-[#475569] italic">Unassigned</span> : `${row.driver} · ${row.truck}`}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${STATUS_COLORS[row.status]}18`, color: STATUS_COLORS[row.status] }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[row.status] }} />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[#e8edf5] text-right">${row.rate.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Compliance alerts */}
          <div className="rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]">
              <div className="text-sm font-semibold text-[#e8edf5]">Compliance alerts</div>
              <button onClick={() => setScreen('compliance')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
            </div>
            <div className="divide-y divide-[#1e2d47]">
              {[
                { doc: 'DOT medical card', who: 'R. Diaz · driver', status: 'Expired Sep 02', color: '#ef4444' },
                { doc: 'Annual DOT inspection', who: 'T-108 · truck', status: '12 days', color: '#f59e0b' },
                { doc: 'Cargo insurance COI', who: 'Carrier', status: '21 days', color: '#f59e0b' },
                { doc: 'CDL', who: 'A. Bekele · driver', status: '28 days', color: '#f59e0b' },
              ].map((a) => (
                <div key={a.doc} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <div className="text-xs font-medium text-[#94a3b8]">{a.doc}</div>
                    <div className="text-xs text-[#475569] mt-0.5">{a.who}</div>
                  </div>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: `${a.color}18`, color: a.color }}>{a.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pay week */}
          <div className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-sm font-semibold text-[#e8edf5] mb-1">Pay week closes Wed, Sep 30</div>
            <div className="text-xs text-[#64748b] mb-3">12 settlements to preview · 3 loads missing BOL</div>
            <button onClick={() => setScreen('accounting')} className="w-full py-2 rounded text-sm font-semibold text-white" style={{ background: 'var(--primary)' }}>
              Preview settlements
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Load Manager ── */

interface LoadRow {
  id: string; broker: string; route: string; driver: string; truck: string
  pickup: string; status: string; rate: number; dispatcher?: string
}

interface InvoiceRecord {
  invoiceNumber: string
  loadId: string
  destination: string
  delivery: 'broker' | 'factor'
  sentAt: string
  amount: number
  paymentStatus: 'Sent' | 'Partially paid' | 'Paid' | 'Overdue'
  amountPaid: number
  paymentSource?: string
  paymentReference?: string
  paidAt?: string
  dueDate: string
}

const INITIAL_LOADS: LoadRow[] = [
  { id: 'LD-10482', broker: 'Summit Freight', route: 'Dallas, TX → Memphis, TN', driver: 'J. Carter', truck: 'T-104', pickup: 'Sep 29', status: 'In transit', rate: 2450 },
  { id: 'LD-10479', broker: 'Northline Brokerage', route: 'Houston, TX → Atlanta, GA', driver: 'R. Diaz', truck: 'T-112', pickup: 'Sep 28', status: 'Accepted', rate: 3100 },
  { id: 'LD-10477', broker: 'Summit Freight', route: 'Fort Worth, TX → Tulsa, OK', driver: 'A. Bekele', truck: 'T-108', pickup: 'Sep 28', status: 'Assigned', rate: 1280 },
  { id: 'LD-10476', broker: 'Crossroads Logistics', route: 'San Antonio, TX → Phoenix, AZ', driver: '—', truck: '—', pickup: 'Sep 30', status: 'New request', rate: 3850 },
  { id: 'LD-10471', broker: 'Northline Brokerage', route: 'Austin, TX → Denver, CO', driver: 'M. Okafor', truck: 'T-101', pickup: 'Sep 27', status: 'In transit', rate: 3420 },
  { id: 'LD-10468', broker: 'Crossroads Logistics', route: 'Dallas, TX → Little Rock, AR', driver: 'J. Carter', truck: 'T-104', pickup: 'Sep 23', status: 'TONU', rate: 250 },
  { id: 'LD-10459', broker: 'Summit Freight', route: 'Memphis, TN → Houston, TX', driver: 'A. Bekele', truck: 'T-108', pickup: 'Sep 25', status: 'Completed', rate: 3860 },
  { id: 'LD-10441', broker: 'Summit Freight', route: 'Dallas, TX → Shreveport, LA', driver: 'R. Diaz', truck: 'T-112', pickup: 'Sep 20', status: 'Completed', rate: 980 },
]

const STATUS_COLORS: Record<string, string> = {
  'In transit': '#3b82f6', 'Accepted': '#3b82f6', 'Assigned': '#f59e0b',
  'New request': '#64748b', 'TONU': '#ef4444', 'Completed': '#10b981',
}

function LoadManager({ onCreateLoad }: { onCreateLoad: () => void }) {
  const { loads: workflowLoads, notifications, assignLoad } = useOperations()
  const [filter, setFilter] = useState('all')
  const [loads, setLoads] = useState<LoadRow[]>(INITIAL_LOADS)
  const [assigningLoad, setAssigningLoad] = useState<LoadRow | null>(null)
  const [invoicingLoad, setInvoicingLoad] = useState<LoadRow | null>(null)
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<Record<string, InvoiceRecord>>(() => {
    try {
      return JSON.parse(localStorage.getItem('iway_load_invoices') || '{}')
    } catch {
      return {}
    }
  })

  useEffect(() => {
    localStorage.setItem('iway_load_invoices', JSON.stringify(invoices))
  }, [invoices])

  const statuses = ['all', 'New request', 'Assigned', 'Accepted', 'In transit', 'Completed', 'TONU']
  const workflowRows: LoadRow[] = workflowLoads.map(load => ({
    id: load.id,
    broker: load.broker,
    route: load.stops.map(stop => `${stop.city}, ${stop.state}`).filter(location => location !== ', ').join(' → ') || 'Route pending',
    driver: load.driver,
    truck: load.truck,
    pickup: load.stops.find(stop => stop.type === 'PICKUP')?.date || '—',
    status: load.status,
    rate: load.rate,
    dispatcher: load.dispatcher,
  }))
  const allLoads = [...workflowRows, ...loads.filter(load => !workflowLoads.some(workflow => workflow.id === load.id))]
  const filtered = filter === 'all' ? allLoads : allLoads.filter((l) => l.status === filter)
  const selectedLoad = selectedLoadId ? allLoads.find(load => load.id === selectedLoadId) || null : null

  function handleAssigned(loadId: string, driver: string, truck: string) {
    if (workflowLoads.some(load => load.id === loadId)) {
      assignLoad(loadId, driver, truck)
    } else {
      setLoads(prev => prev.map(l => l.id === loadId ? { ...l, driver, truck, status: 'Assigned' } : l))
    }
    setAssigningLoad(null)
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8edf5]">Load Manager</h1>
          <p className="text-xs text-[#64748b] mt-0.5">Active and completed loads</p>
        </div>
        <button onClick={onCreateLoad} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          + Create load
        </button>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${filter === s ? 'bg-amber-500 text-white' : 'border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8]'}`}
          >
            {s === 'all' ? `All (${allLoads.length})` : `${s} (${allLoads.filter((l) => l.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[#e8edf5]">Completed loads ready to invoice</div>
          <div className="text-xs text-[#64748b] mt-0.5">{allLoads.filter(load => load.status === 'Completed').length} completed loads · Generate, download or submit invoices</div>
        </div>
        <button
          onClick={() => setFilter('Completed')}
          className="text-xs px-3 py-2 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
        >
          View completed loads
        </button>
      </div>

      <div className="rounded border border-[#1e2d47] overflow-x-auto" style={{ background: 'var(--card)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d47]">
              {['LOAD', 'BROKER', 'ROUTE', 'DISPATCHER', 'DRIVER · TRUCK', 'PICKUP', 'STATUS', 'RATE', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[#475569] font-medium tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d47]">
            {filtered.map((row) => (
              <tr key={row.id} onClick={() => setSelectedLoadId(row.id)} className="hover:bg-[#111827] transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono text-amber-400">{row.id}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{row.broker}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{row.route}</td>
                <td className="px-4 py-3 text-[#64748b]">{row.dispatcher || 'Carrier dispatch'}</td>
                <td className="px-4 py-3 text-[#64748b]">
                  {row.driver === '—'
                    ? <span className="text-[#ef4444] font-medium">Needs driver</span>
                    : `${row.driver} · ${row.truck}`}
                </td>
                <td className="px-4 py-3 text-[#64748b]">{row.pickup}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${STATUS_COLORS[row.status]}18`, color: STATUS_COLORS[row.status] }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[row.status] }} />{row.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[#e8edf5] text-right">${row.rate.toLocaleString('en', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3">
                  {row.status === 'New request' && (
                    <button
                      onClick={event => { event.stopPropagation(); setAssigningLoad(row) }}
                      className="text-xs font-semibold text-amber-400 border border-amber-500/40 px-3 py-1.5 rounded hover:bg-amber-500/10 transition-colors whitespace-nowrap"
                    >
                      Assign →
                    </button>
                  )}
                  {row.status === 'Assigned' && (
                    <button
                      onClick={event => { event.stopPropagation(); setAssigningLoad(row) }}
                      className="text-xs text-[#64748b] border border-[#1e2d47] px-3 py-1.5 rounded hover:text-[#94a3b8] hover:border-[#2a3a54] transition-colors whitespace-nowrap"
                    >
                      Reassign
                    </button>
                  )}
                  {row.status === 'Completed' && (
                    <button
                      onClick={event => { event.stopPropagation(); setInvoicingLoad(row) }}
                      className={`text-xs font-semibold border px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
                        invoices[row.id]
                          ? 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10'
                          : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'
                      }`}
                    >
                      {invoices[row.id] ? `Invoice · ${invoices[row.id].paymentStatus || 'Sent'}` : 'Generate invoice'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign driver panel */}
      {assigningLoad && (
        <AssignDriverPanel
          load={assigningLoad}
          onClose={() => setAssigningLoad(null)}
          onAssigned={handleAssigned}
        />
      )}
      {invoicingLoad && (
        <InvoicePanel
          load={invoicingLoad}
          existingInvoice={invoices[invoicingLoad.id]}
          onClose={() => setInvoicingLoad(null)}
          onSent={invoice => setInvoices(current => ({ ...current, [invoice.loadId]: invoice }))}
        />
      )}
      {selectedLoad && (
        <LoadDetailsPanel
          load={selectedLoad}
          workflowLoad={workflowLoads.find(workflow => workflow.id === selectedLoad.id)}
          notifications={notifications.filter(notification => notification.loadId === selectedLoad.id)}
          invoice={invoices[selectedLoad.id]}
          onClose={() => setSelectedLoadId(null)}
        />
      )}
    </div>
  )
}

function RenderedSignature({ value }: { value?: string }) {
  return value?.startsWith('data:image') ? <img src={value} alt="Electronic signature" className="max-h-14 max-w-full object-contain object-left" /> : <span className="font-display italic text-xl">{value || 'Pending'}</span>
}

function LoadDetailsPanel({ load, workflowLoad, invoice, notifications, onClose }: {
  load: LoadRow
  workflowLoad?: WorkflowLoad
  invoice?: InvoiceRecord
  notifications: BrokerNotification[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<'overview' | 'stops' | 'documents'>('overview')
  const [previewDocument, setPreviewDocument] = useState<string | null>(null)
  const [trackingEmail, setTrackingEmail] = useState(`tracking@${load.broker.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`)
  const [trackingSent, setTrackingSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const routeParts = load.route.split('→').map(part => part.trim())
  const stops = workflowLoad?.stops.map((stop, index) => ({
    type: stop.type,
    facility: stop.facility,
    address: stop.address,
    city: stop.city,
    state: stop.state,
    date: stop.date,
    window: stop.windowFrom && stop.windowTo ? `${stop.windowFrom} – ${stop.windowTo}` : 'Window pending',
    ref: stop.ref || '—',
    complete: workflowLoad.completedStopIndexes.includes(index),
  })) || routeParts.map((location, index) => ({
    type: index === 0 ? 'PICKUP' as const : 'DROP-OFF' as const,
    facility: index === 0 ? 'Origin facility' : 'Destination facility',
    address: location,
    city: location.split(',')[0] || location,
    state: location.split(',')[1]?.trim() || '',
    date: index === 0 ? load.pickup : 'Following appointment',
    window: index === 0 ? '08:00 – 11:00' : '06:00 – 14:00',
    ref: index === 0 ? `PU-${load.id.replace('LD-', '')}` : `DEL-${load.id.replace('LD-', '')}`,
    complete: load.status === 'Completed' || (load.status === 'In transit' && index === 0),
  }))
  const totalMiles = workflowLoad?.miles || (load.id === 'LD-10441' ? 188 : 452)
  const milesDriven = load.status === 'Completed' ? totalMiles : load.status === 'In transit' ? Math.round(totalMiles * 0.58) : 0
  const milesLeft = Math.max(totalMiles - milesDriven, 0)
  const progress = totalMiles ? Math.round((milesDriven / totalMiles) * 100) : 0
  const currentLocation = load.status === 'Completed'
    ? `${stops[stops.length - 1]?.city}, ${stops[stops.length - 1]?.state}`
    : load.status === 'In transit'
      ? 'I-30 near Texarkana, TX · updated 3 min ago'
      : load.status === 'Accepted'
        ? `En route to ${stops[0]?.city}, ${stops[0]?.state}`
        : load.status === 'Assigned'
          ? 'Driver has not started trip'
          : `${stops[0]?.city}, ${stops[0]?.state}`
  const assignedDriver = AVAILABLE_DRIVERS.find(driver =>
    driver.name === load.driver || driver.name.startsWith(load.driver.replace('.', ''))
  )
  const uploadedDocuments = [
    { name: 'Rate confirmation', detail: `${load.broker} · $${load.rate.toFixed(2)}`, status: 'Uploaded' },
    { name: 'Bill of lading (BOL)', detail: workflowLoad?.bolDocument?.driverSignature && workflowLoad?.bolDocument?.shipperSignature ? `Signed by ${workflowLoad.bolDocument.driverSignature} + ${workflowLoad.bolDocument.shipperSignature}` : stops[0]?.ref || 'Pickup document', status: workflowLoad?.bolDocument?.driverSignature && workflowLoad?.bolDocument?.shipperSignature ? 'Uploaded' : 'Pending driver' },
    { name: 'Proof of delivery (POD)', detail: workflowLoad?.bolDocument?.receiverSignature ? `Receiver signed · ${workflowLoad.bolDocument.receiverSignature}` : stops[stops.length - 1]?.ref || 'Delivery document', status: workflowLoad?.bolDocument?.receiverSignature ? 'Uploaded' : 'Pending delivery' },
    { name: 'Pickup photos', detail: '2 images · seal and loaded trailer', status: load.status === 'In transit' || load.status === 'Completed' ? 'Uploaded' : 'Pending driver' },
    { name: 'Delivery photos', detail: '3 images · signed POD and empty trailer', status: load.status === 'Completed' ? 'Uploaded' : 'Pending delivery' },
  ]

  function sendTrackingLink() {
    if (!trackingEmail.includes('@')) {
      setEmailError('Enter a valid broker email address')
      return
    }
    setEmailError('')
    setTrackingSent(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full lg:w-[920px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="shrink-0 px-6 py-4 border-b border-[#1e2d47]">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8]" aria-label="Close load details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg>
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-amber-400">{load.id}</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${STATUS_COLORS[load.status]}18`, color: STATUS_COLORS[load.status] }}>{load.status}</span>
                {invoice && <span className={`text-xs px-2 py-0.5 rounded-full ${invoice.paymentStatus === 'Paid' ? 'bg-emerald-500/15 text-emerald-400' : invoice.paymentStatus === 'Partially paid' ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'}`}>Invoice · {invoice.paymentStatus || 'Sent'}</span>}
              </div>
              <div className="text-xs text-[#64748b] mt-0.5">{load.broker} · {load.route}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#64748b]">Load rate</div>
              <div className="font-mono text-lg font-bold text-[#e8edf5]">${load.rate.toFixed(2)}</div>
            </div>
          </div>
          <div className="flex gap-1 mt-4">
            {[
              { id: 'overview' as const, label: 'Overview + tracking' },
              { id: 'stops' as const, label: `Stops · ${stops.length}` },
              { id: 'documents' as const, label: `Documents · ${uploadedDocuments.filter(document => document.status === 'Uploaded').length}` },
            ].map(item => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`px-4 py-2 rounded text-xs font-semibold ${tab === item.id ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' : 'text-[#64748b] border border-transparent'}`}>{item.label}</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-3">
                {[
                  ['Driver · truck', load.driver === '—' ? 'Unassigned' : `${load.driver} · ${load.truck}`],
                  ['Pickup', load.pickup],
                  ['Dispatcher', load.dispatcher || 'Carrier dispatch'],
                  ['Broker · rate', `${load.broker} · $${load.rate.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
                    <div className="text-xs text-[#475569]">{label}</div>
                    <div className="text-sm font-semibold text-[#e8edf5] mt-1">{value}</div>
                  </div>
                ))}
              </div>

              <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-sm font-semibold text-[#e8edf5]">Assigned driver</div><div className="text-xs text-[#64748b] mt-0.5">Primary driver responsible for this load</div></div>
                  <span className={`text-xs px-2 py-1 rounded ${load.driver === '—' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/15 text-blue-400'}`}>{load.driver === '—' ? 'Unassigned' : load.status}</span>
                </div>
                {load.driver === '—' ? (
                  <div className="rounded border border-dashed border-[#1e2d47] py-6 text-center text-sm text-[#475569]">No driver has been assigned to this load.</div>
                ) : (
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center text-sm font-bold shrink-0">
                      {assignedDriver?.initials || load.driver.split(' ').map(part => part[0]).join('').slice(0, 2)}
                    </span>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-[#e8edf5]">{load.driver}</div>
                      <div className="text-xs text-[#64748b] mt-0.5">{assignedDriver?.phone || 'Phone not available'} · {assignedDriver?.cdl || 'CDL record on file'}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                      <span className="text-[#475569]">Truck</span><span className="font-mono text-[#e8edf5]">{load.truck}</span>
                      <span className="text-[#475569]">Driver status</span><span className="text-emerald-400">{assignedDriver?.status || 'Assigned'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-5 gap-4">
                <div className="col-span-3 rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-[#475569] uppercase tracking-wide">Current location</div>
                      <div className="text-base font-semibold text-[#e8edf5] mt-1">{currentLocation}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${load.status === 'In transit' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{load.status === 'In transit' ? 'Live GPS' : load.status}</span>
                  </div>
                  <div className="mt-5">
                    <div className="flex justify-between text-xs mb-2"><span className="text-[#64748b]">{milesDriven} mi driven</span><span className="text-[#94a3b8]">{load.status === 'Completed' ? `${totalMiles} total miles` : `${milesLeft} mi left`}</span></div>
                    <div className="h-2 rounded-full bg-[#1e2d47] overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full" style={{ width: `${progress}%` }} /></div>
                    <div className="text-xs text-[#475569] mt-2">{progress}% of planned route completed · {totalMiles} planned miles</div>
                  </div>
                </div>
                <div className="col-span-2 rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                  <div className="text-sm font-semibold text-[#e8edf5]">Live tracking link</div>
                  <div className="text-xs text-[#64748b] mt-1">Email the broker a secure link with the current location and route progress.</div>
                  <input value={trackingEmail} onChange={event => { setTrackingEmail(event.target.value); setTrackingSent(false) }} placeholder="broker@example.com" className="w-full mt-3 px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40" />
                  {emailError && <div className="text-xs text-red-400 mt-1">{emailError}</div>}
                  <button onClick={sendTrackingLink} className={`w-full mt-3 py-2.5 rounded text-xs font-semibold ${trackingSent ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                    {trackingSent ? 'Tracking link sent' : 'Send current location + live link'}
                  </button>
                  {trackingSent && <div className="text-[10px] text-[#475569] mt-2 font-mono">track.iway.io/{load.id.toLowerCase()}</div>}
                </div>
              </div>

              <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                <div className="flex items-center justify-between mb-4">
                  <div><div className="text-sm font-semibold text-[#e8edf5]">Route progress</div><div className="text-xs text-[#64748b] mt-0.5">{stops.filter(stop => stop.complete).length} of {stops.length} stops completed</div></div>
                  <button onClick={() => setTab('stops')} className="text-xs text-blue-400">View all stop details →</button>
                </div>
                <div className="flex items-center">
                  {stops.map((stop, index) => (
                    <div key={`${stop.facility}-${index}`} className="flex items-center flex-1 last:flex-none">
                      <div className="text-center">
                        <div className={`w-7 h-7 mx-auto rounded-full border-2 flex items-center justify-center text-xs font-bold ${stop.complete ? 'bg-emerald-500 border-emerald-500 text-white' : stop.type === 'PICKUP' ? 'border-emerald-400 text-emerald-400' : 'border-blue-400 text-blue-400'}`}>{stop.complete ? '✓' : index + 1}</div>
                        <div className="text-[10px] text-[#64748b] mt-1 max-w-24 truncate">{stop.city}</div>
                      </div>
                      {index < stops.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${stop.complete ? 'bg-emerald-500' : 'bg-[#1e2d47]'}`} />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d47]">
                  <div><div className="text-sm font-semibold text-[#e8edf5]">Broker email notifications</div><div className="text-xs text-[#64748b] mt-0.5">Automatic pickup and delivery notices sent to the broker email in the carrier book of record.</div></div>
                  <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">{workflowLoad?.brokerEmail || 'Broker email not available'}</span>
                </div>
                {notifications.length > 0 ? (
                  <div className="divide-y divide-[#1e2d47]">
                    {notifications.map(notification => (
                      <div key={notification.id} className="flex items-center justify-between gap-4 px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M5 13l4 4L19 7" strokeLinecap="round" /></svg>
                          </span>
                          <div><div className="text-sm font-medium text-[#e8edf5]">{notification.event}</div><div className="text-xs text-[#64748b] mt-0.5">{notification.stop} · sent to {notification.email}</div>{notification.attachment && <div className="text-[10px] font-mono text-blue-400 mt-1">Attachment: {notification.attachment}</div>}</div>
                        </div>
                        <div className="text-right"><div className="text-xs text-emerald-400">{notification.status}</div><div className="text-[10px] text-[#475569] mt-0.5">{notification.sentAt}</div></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-5 text-xs text-[#475569]">Notifications will be sent automatically when the driver completes each pickup and final delivery stop.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'stops' && (
            <div className="space-y-3">
              {stops.map((stop, index) => (
                <div key={`${stop.address}-${index}`} className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${stop.complete ? 'bg-emerald-500 border-emerald-500 text-white' : stop.type === 'PICKUP' ? 'border-emerald-400 text-emerald-400' : 'border-blue-400 text-blue-400'}`}>{stop.complete ? '✓' : index + 1}</div>
                    <div className="flex-1">
                      <div className={`text-xs font-semibold ${stop.type === 'PICKUP' ? 'text-emerald-400' : 'text-blue-400'}`}>{stop.type} · STOP {index + 1} OF {stops.length}</div>
                      <div className="text-base font-semibold text-[#e8edf5] mt-1">{stop.facility}</div>
                      <div className="text-sm text-[#64748b] mt-0.5">{stop.address}</div>
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#1e2d47] text-xs">
                        <div><div className="text-[#475569]">Appointment</div><div className="text-[#94a3b8] mt-1">{stop.date} · {stop.window}</div></div>
                        <div><div className="text-[#475569]">Reference</div><div className="font-mono text-[#94a3b8] mt-1">{stop.ref}</div></div>
                        <div><div className="text-[#475569]">Status</div><div className={`mt-1 ${stop.complete ? 'text-emerald-400' : 'text-amber-400'}`}>{stop.complete ? 'Completed by driver' : 'Upcoming'}</div></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-3">
              <div className="rounded border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-300">Documents and photos uploaded in the Driver App appear here in real time for dispatch and billing.</div>
              {uploadedDocuments.map(document => (
                <div key={document.name} className="flex items-center justify-between rounded border border-[#1e2d47] px-4 py-4" style={{ background: 'var(--card)' }}>
                  <div>
                    <div className="text-sm font-medium text-[#e8edf5]">{document.name}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">{document.detail}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${document.status === 'Uploaded' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{document.status}</span>
                    {document.status === 'Uploaded' && <button onClick={() => setPreviewDocument(document.name)} className="text-xs px-3 py-1.5 rounded border border-blue-500/30 text-blue-400">Open</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {previewDocument && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-8 bg-black/75">
            <div className="w-full max-w-xl max-h-full overflow-y-auto rounded border border-[#1e2d47] shadow-2xl" style={{ background: 'var(--background)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]">
                <div><div className="text-sm font-semibold text-[#e8edf5]">{previewDocument}</div><div className="text-xs text-[#64748b] mt-0.5">{load.id} · Driver upload</div></div>
                <button onClick={() => setPreviewDocument(null)} className="text-[#64748b]" aria-label="Close document"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button>
              </div>
              <div className="m-4 bg-white text-slate-900 min-h-96 p-8">
                <div className="flex justify-between border-b border-slate-200 pb-5"><div><div className="text-xl font-bold">{previewDocument}</div><div className="text-xs text-slate-500 mt-1">Uploaded from iWay Driver App</div></div><div className="font-mono font-bold">{load.id}</div></div>
                <div className="py-6 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Broker</span><span>{load.broker}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Route</span><span>{load.route}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Driver</span><span>{load.driver}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Truck</span><span>{load.truck}</span></div>
                  {previewDocument === 'Rate confirmation' && <div className="flex justify-between border-t border-slate-200 pt-4 font-bold"><span>Agreed rate</span><span>${load.rate.toFixed(2)}</span></div>}
                  {(previewDocument === 'Bill of lading (BOL)' || previewDocument === 'Proof of delivery (POD)') && (
                    <div className="space-y-4 border-t border-slate-200 pt-4">
                      {[['Driver', workflowLoad?.bolDocument?.driverSignature, workflowLoad?.bolDocument?.pickupSignedAt], ['Shipper', workflowLoad?.bolDocument?.shipperSignature, workflowLoad?.bolDocument?.pickupSignedAt], ['Receiver', workflowLoad?.bolDocument?.receiverSignature, workflowLoad?.bolDocument?.deliverySignedAt]].map(([role, signature, signedAt]) => (
                        <div key={role as string}><div className="text-[10px] font-bold text-slate-500">{role as string} ELECTRONIC SIGNATURE</div><div className="mt-1"><RenderedSignature value={signature} /></div><div className="text-[10px] text-slate-400">{signedAt || 'Not signed'}</div></div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-12 border-2 border-dashed border-slate-200 rounded p-8 text-center text-sm text-slate-400">{previewDocument.includes('photos') ? 'Driver-uploaded image preview' : 'Signed document preview'}</div>
              </div>
              <div className="px-4 pb-4"><button onClick={() => window.print()} className="w-full py-2.5 rounded border border-blue-500/30 text-blue-400 text-sm">Print or save PDF</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function createInvoicePdf(load: LoadRow, invoiceNumber: string, destination: string) {
  const clean = (value: string) => value
    .replace(/[^\x20-\x7E]/g, value.includes('→') ? '-' : '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
  const lines = [
    { text: 'iWay Dispatch - Current Way Logistics', size: 18 },
    { text: 'FREIGHT INVOICE', size: 15 },
    { text: `Invoice: ${invoiceNumber}`, size: 11 },
    { text: `Load: ${load.id}`, size: 11 },
    { text: `Bill to: ${destination}`, size: 11 },
    { text: `Broker: ${load.broker}`, size: 11 },
    { text: `Route: ${load.route.replace('→', 'to')}`, size: 11 },
    { text: `Pickup: ${load.pickup}`, size: 11 },
    { text: `Driver / truck: ${load.driver} / ${load.truck}`, size: 11 },
    { text: `Freight charges: $${load.rate.toFixed(2)}`, size: 12 },
    { text: `AMOUNT DUE: $${load.rate.toFixed(2)}`, size: 15 },
    { text: 'Payment terms: Net 30', size: 10 },
    { text: 'Please reference the invoice and load number with payment.', size: 9 },
  ]
  let y = 755
  const content = lines.map(line => {
    const command = `BT /F1 ${line.size} Tf 50 ${y} Td (${clean(line.text)}) Tj ET`
    y -= line.size >= 15 ? 34 : 25
    return command
  }).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoiceNumber}-${load.id}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

function createSupportingPdf(load: LoadRow, title: string, filename: string, detailLines: string[]) {
  const clean = (value: string) => value
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
  const lines = [
    { text: 'iWay Dispatch - Current Way Logistics', size: 18 },
    { text: title.toUpperCase(), size: 15 },
    { text: `Load: ${load.id}`, size: 11 },
    { text: `Broker: ${load.broker}`, size: 11 },
    { text: `Route: ${load.route.replace('→', 'to')}`, size: 11 },
    { text: `Driver / truck: ${load.driver} / ${load.truck}`, size: 11 },
    ...detailLines.map(text => ({ text, size: 11 })),
  ]
  let y = 755
  const content = lines.map(line => {
    const command = `BT /F1 ${line.size} Tf 50 ${y} Td (${clean(line.text)}) Tj ET`
    y -= line.size >= 15 ? 34 : 25
    return command
  }).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n` })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function downloadInvoicePackage(load: LoadRow, invoiceNumber: string, destination: string) {
  createInvoicePdf(load, invoiceNumber, destination)
  createSupportingPdf(load, 'Rate confirmation', `${load.id}-rate-confirmation.pdf`, [
    `Agreed freight rate: $${load.rate.toFixed(2)}`,
    `Pickup date: ${load.pickup}`,
    'Terms: Net 30',
    'Status: Accepted and completed',
  ])
  createSupportingPdf(load, 'Proof of delivery', `${load.id}-proof-of-delivery.pdf`, [
    'Delivery status: Completed',
    'Receiver signature: On file',
    'POD uploaded by driver in the iWay Driver App',
    'Delivery photos: 3 attached to load record',
  ])
}

function InvoicePanel({ load, existingInvoice, onClose, onSent }: {
  load: LoadRow
  existingInvoice?: InvoiceRecord
  onClose: () => void
  onSent: (invoice: InvoiceRecord) => void
}) {
  const [invoiceNumber] = useState(existingInvoice?.invoiceNumber || `INV-${load.id.replace('LD-', '')}`)
  const [delivery, setDelivery] = useState<'broker' | 'factor'>(existingInvoice?.delivery || 'broker')
  const [factor, setFactor] = useState(existingInvoice?.delivery === 'factor' ? existingInvoice.destination : 'Apex Capital Funding')
  const [generated, setGenerated] = useState(!!existingInvoice)
  const [sent, setSent] = useState(!!existingInvoice)
  const [previewAttachment, setPreviewAttachment] = useState<'invoice' | 'rate' | 'pod' | null>(null)
  const [invoiceRecord, setInvoiceRecord] = useState<InvoiceRecord | undefined>(existingInvoice)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentSource, setPaymentSource] = useState<'manual' | 'broker' | 'factor'>(delivery === 'factor' ? 'factor' : 'manual')
  const [paymentError, setPaymentError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const destination = existingInvoice?.destination || (delivery === 'broker' ? load.broker : factor)
  const activeInvoice = invoiceRecord || existingInvoice
  const amountPaid = activeInvoice?.amountPaid || 0
  const balanceDue = Math.max(load.rate - amountPaid, 0)
  const paymentStatus = activeInvoice?.paymentStatus || 'Sent'

  function submitInvoice() {
    const invoice: InvoiceRecord = {
      invoiceNumber,
      loadId: load.id,
      destination,
      delivery,
      sentAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      amount: load.rate,
      paymentStatus: 'Sent',
      amountPaid: 0,
      dueDate: 'Oct 30, 2026',
    }
    setInvoiceRecord(invoice)
    onSent(invoice)
    setSent(true)
  }

  function savePayment(sourceOverride?: string, amountOverride?: number) {
    if (!activeInvoice) return
    const amount = amountOverride ?? Number(paymentAmount)
    if (!amount || amount <= 0) {
      setPaymentError('Enter a payment amount greater than zero')
      return
    }
    if (amount > balanceDue) {
      setPaymentError(`Payment cannot exceed the remaining balance of $${balanceDue.toFixed(2)}`)
      return
    }
    const newAmountPaid = amountPaid + amount
    const updated: InvoiceRecord = {
      ...activeInvoice,
      amountPaid: newAmountPaid,
      paymentStatus: newAmountPaid >= activeInvoice.amount ? 'Paid' : 'Partially paid',
      paymentSource: sourceOverride || (paymentSource === 'manual' ? 'Manual dispatcher entry' : paymentSource === 'broker' ? 'Broker payment integration' : 'Factoring company integration'),
      paymentReference: sourceOverride ? `SYNC-${Date.now().toString().slice(-6)}` : paymentReference || `MAN-${Date.now().toString().slice(-6)}`,
      paidAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    }
    setInvoiceRecord(updated)
    onSent(updated)
    setShowPaymentForm(false)
    setPaymentAmount('')
    setPaymentReference('')
    setPaymentError('')
  }

  function syncPaymentStatus() {
    if (!activeInvoice) return
    setSyncMessage('Checking connected broker, factoring and bank payment feeds…')
    setTimeout(() => {
      if (balanceDue > 0) {
        savePayment(delivery === 'factor' ? 'Factoring API sync' : 'Broker / bank integration sync', balanceDue)
        setSyncMessage('Payment matched automatically by invoice and load number.')
      } else {
        setSyncMessage('Invoice is already fully paid. No new transactions found.')
      }
    }, 500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[600px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="shrink-0 px-6 py-4 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8]" aria-label="Close invoice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="text-sm font-semibold text-[#e8edf5]">Invoice completed load · <span className="font-mono text-amber-400">{load.id}</span></div>
            <div className="text-xs text-[#64748b] mt-0.5">{load.route} · ${load.rate.toFixed(2)}</div>
          </div>
        </div>

        {sent ? (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="flex items-center gap-3 rounded border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 mb-5">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" className="w-5 h-5">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-300">Final invoice submitted</div>
                <div className="text-xs text-emerald-400/70 mt-0.5">
                  Sent to {destination} · {existingInvoice?.sentAt || 'Just now'}
                </div>
              </div>
            </div>

            <div className="rounded border border-[#1e2d47] overflow-hidden">
              <div className="flex items-start justify-between px-5 py-4 border-b border-[#1e2d47]" style={{ background: 'var(--card)' }}>
                <div>
                  <div className="text-xs text-[#64748b] uppercase tracking-wide">Final invoice</div>
                  <div className="text-xl font-mono font-bold text-[#e8edf5] mt-1">{invoiceNumber}</div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Sent</span>
              </div>
              <div className="p-5 space-y-3 text-xs" style={{ background: '#0d1424' }}>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Recipient</span><span className="text-[#e8edf5] text-right">{destination}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Delivery channel</span><span className="text-[#94a3b8]">{delivery === 'factor' ? 'Factoring company' : 'Broker direct'}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Load</span><span className="font-mono text-amber-400">{load.id}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Broker</span><span className="text-[#94a3b8]">{load.broker}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Route</span><span className="text-[#94a3b8] text-right">{load.route}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Driver · truck</span><span className="text-[#94a3b8]">{load.driver} · {load.truck}</span></div>
                <div className="flex justify-between gap-4"><span className="text-[#64748b]">Payment terms</span><span className="text-[#94a3b8]">Net 30</span></div>
                <div className="flex justify-between border-t border-[#1e2d47] pt-4 mt-4">
                  <span className="text-sm font-semibold text-[#e8edf5]">Amount due</span>
                  <span className="text-xl font-mono font-bold text-[#e8edf5]">${load.rate.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded border border-[#1e2d47] overflow-hidden mt-5">
              <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1e2d47]" style={{ background: 'var(--card)' }}>
                <div>
                  <div className="text-sm font-semibold text-[#e8edf5]">Payment tracking</div>
                  <div className="text-xs text-[#64748b] mt-0.5">Reconcile automatically through integrations or record broker/factor payments manually.</div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded font-medium ${
                  paymentStatus === 'Paid' ? 'bg-emerald-500/15 text-emerald-400'
                    : paymentStatus === 'Partially paid' ? 'bg-blue-500/15 text-blue-400'
                    : paymentStatus === 'Overdue' ? 'bg-red-500/10 text-red-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}>{paymentStatus}</span>
              </div>
              <div className="grid grid-cols-3 gap-px bg-[#1e2d47]">
                {[
                  ['Invoice amount', load.rate],
                  ['Amount paid', amountPaid],
                  ['Balance due', balanceDue],
                ].map(([label, value]) => (
                  <div key={String(label)} className="p-4 bg-[#0d1424]">
                    <div className="text-xs text-[#64748b]">{String(label)}</div>
                    <div className={`font-mono text-lg font-bold mt-1 ${label === 'Amount paid' ? 'text-emerald-400' : label === 'Balance due' && Number(value) > 0 ? 'text-amber-400' : 'text-[#e8edf5]'}`}>${Number(value).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="p-4 space-y-3" style={{ background: 'var(--card)' }}>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-[#64748b]">Due date</span><span className="text-[#e8edf5]">{activeInvoice?.dueDate || 'Oct 30, 2026'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#64748b]">Last payment</span><span className="text-[#e8edf5]">{activeInvoice?.paidAt || 'No payment recorded'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#64748b]">Payment source</span><span className="text-[#e8edf5]">{activeInvoice?.paymentSource || 'Awaiting payment'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-[#64748b]">Reference</span><span className="font-mono text-[#e8edf5]">{activeInvoice?.paymentReference || '—'}</span></div>
                </div>
                {syncMessage && <div className="rounded bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-300">{syncMessage}</div>}
                {paymentStatus !== 'Paid' && (
                  <div className="flex gap-2">
                    <button onClick={syncPaymentStatus} className="flex-1 py-2.5 rounded border border-blue-500/30 text-xs font-semibold text-blue-400 hover:bg-blue-500/10">Sync payment integrations</button>
                    <button onClick={() => { setShowPaymentForm(true); setPaymentAmount(balanceDue.toFixed(2)) }} className="flex-1 py-2.5 rounded border border-amber-500/30 text-xs font-semibold text-amber-400 hover:bg-amber-500/10">Record payment manually</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={() => downloadInvoicePackage(load, invoiceNumber, destination)}
                className="flex-1 py-3 rounded border border-[#1e2d47] text-sm font-medium text-[#94a3b8] hover:text-white"
              >
                Download all 3 PDFs
              </button>
              <button onClick={onClose} className="flex-1 py-3 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                Done
              </button>
            </div>

            {showPaymentForm && (
              <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/75">
                <div className="w-full max-w-md rounded border border-[#1e2d47] shadow-2xl" style={{ background: 'var(--background)' }}>
                  <div className="flex items-start justify-between px-5 py-4 border-b border-[#1e2d47]"><div><div className="text-base font-semibold text-[#e8edf5]">Record invoice payment</div><div className="text-xs text-[#64748b] mt-0.5">{invoiceNumber} · Balance ${balanceDue.toFixed(2)}</div></div><button onClick={() => setShowPaymentForm(false)} className="text-[#64748b]" aria-label="Close payment form"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button></div>
                  <div className="p-5 space-y-4">
                    <label className="block"><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Payment source</span><select value={paymentSource} onChange={event => setPaymentSource(event.target.value as typeof paymentSource)} className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none"><option value="manual">Manual dispatcher entry</option><option value="broker">Broker payment portal</option><option value="factor">Factoring company remittance</option></select></label>
                    <label className="block"><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Amount received</span><div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]"><span className="pl-3 text-[#64748b]">$</span><input type="number" min="0" step="0.01" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} className="w-full px-2 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" /></div></label>
                    <label className="block"><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">ACH, check or remittance reference</span><input value={paymentReference} onChange={event => setPaymentReference(event.target.value)} placeholder="e.g. ACH-849203 or check 10882" className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none" /></label>
                    {paymentError && <div className="text-xs text-red-400">{paymentError}</div>}
                    <div className="rounded border border-[#1e2d47] px-3 py-2 text-xs text-[#64748b]">Partial payments are supported. The remaining balance stays open until fully reconciled.</div>
                  </div>
                  <div className="flex justify-between px-5 py-4 border-t border-[#1e2d47]" style={{ background: 'var(--card)' }}><button onClick={() => setShowPaymentForm(false)} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b]">Cancel</button><button onClick={() => savePayment()} className="px-5 py-2.5 rounded bg-emerald-600 text-white text-sm font-semibold">Save payment</button></div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">Invoice delivery</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setDelivery('broker')}
                    className={`rounded border p-4 text-left ${delivery === 'broker' ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47]'}`}
                  >
                    <span className={`block text-sm font-semibold ${delivery === 'broker' ? 'text-amber-300' : 'text-[#94a3b8]'}`}>Bill broker directly</span>
                    <span className="block text-xs text-[#475569] mt-1">{load.broker} · Broker billing contact</span>
                  </button>
                  <button
                    onClick={() => setDelivery('factor')}
                    className={`rounded border p-4 text-left ${delivery === 'factor' ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#1e2d47]'}`}
                  >
                    <span className={`block text-sm font-semibold ${delivery === 'factor' ? 'text-blue-300' : 'text-[#94a3b8]'}`}>Submit to factoring</span>
                    <span className="block text-xs text-[#475569] mt-1">Factor handles collection and remittance</span>
                  </button>
                </div>
              </div>

              {delivery === 'factor' && (
                <label className="block">
                  <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Factoring company</span>
                  <select value={factor} onChange={event => setFactor(event.target.value)} className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40">
                    <option>Apex Capital Funding</option>
                    <option>OTR Solutions</option>
                    <option>Triumph Business Capital</option>
                    <option>RTS Financial</option>
                  </select>
                </label>
              )}

              {!generated ? (
                <div className="rounded border border-[#1e2d47] p-5 text-center" style={{ background: 'var(--card)' }}>
                  <div className="text-sm font-semibold text-[#e8edf5]">Ready to generate</div>
                  <div className="text-xs text-[#64748b] mt-1">The invoice will include the completed load, rate, route and payment instructions.</div>
                  <button onClick={() => setGenerated(true)} className="mt-4 px-5 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                    Generate invoice
                  </button>
                </div>
              ) : (
                <div className="rounded border border-[#1e2d47] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]" style={{ background: 'var(--card)' }}>
                    <div>
                      <div className="text-xs font-mono text-emerald-400">{invoiceNumber}</div>
                      <div className="text-xs text-[#64748b] mt-0.5">Generated · Ready to send</div>
                    </div>
                    <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-1 rounded">Draft invoice</span>
                  </div>
                  <div className="p-5 space-y-3 text-xs" style={{ background: '#0d1424' }}>
                    <div className="flex justify-between"><span className="text-[#64748b]">Bill to</span><span className="text-[#e8edf5]">{destination}</span></div>
                    <div className="flex justify-between"><span className="text-[#64748b]">Load</span><span className="font-mono text-amber-400">{load.id}</span></div>
                    <div className="flex justify-between"><span className="text-[#64748b]">Route</span><span className="text-[#94a3b8]">{load.route}</span></div>
                    <div className="flex justify-between"><span className="text-[#64748b]">Payment terms</span><span className="text-[#94a3b8]">Net 30</span></div>
                    <div className="flex justify-between border-t border-[#1e2d47] pt-3"><span className="font-semibold text-[#e8edf5]">Amount due</span><span className="font-mono text-lg font-bold text-[#e8edf5]">${load.rate.toFixed(2)}</span></div>
                  </div>
                </div>
              )}

              {generated && (
                <div className="rounded border border-[#1e2d47] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1e2d47]" style={{ background: 'var(--card)' }}>
                    <div className="text-sm font-semibold text-[#e8edf5]">Documents included with invoice</div>
                    <div className="text-xs text-[#64748b] mt-0.5">Review all documents before submitting to {destination}.</div>
                  </div>
                  <div className="divide-y divide-[#1e2d47]">
                    {[
                      { id: 'invoice' as const, name: 'Broker invoice', file: `${invoiceNumber}-${load.id}.pdf`, detail: `$${load.rate.toFixed(2)} · Net 30` },
                      { id: 'rate' as const, name: 'Rate confirmation', file: `${load.id}-rate-confirmation.pdf`, detail: `${load.broker} · Signed rate agreement` },
                      { id: 'pod' as const, name: 'Proof of delivery (POD)', file: `${load.id}-proof-of-delivery.pdf`, detail: 'Driver upload · receiver signature on file' },
                    ].map(document => (
                      <button key={document.id} onClick={() => setPreviewAttachment(document.id)} className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[#111827]">
                        <span className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded bg-red-500/10 text-red-400 flex items-center justify-center text-[10px] font-bold">PDF</span>
                          <span><span className="block text-sm font-medium text-[#e8edf5]">{document.name}</span><span className="block text-xs text-[#64748b] mt-0.5">{document.detail}</span></span>
                        </span>
                        <span className="text-right"><span className="block text-xs text-blue-400">Open document</span><span className="block text-[10px] font-mono text-[#475569] mt-0.5">{document.file}</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between gap-3" style={{ background: 'var(--card)' }}>
              <button onClick={onClose} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b]">Cancel</button>
              {generated && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadInvoicePackage(load, invoiceNumber, destination)}
                    className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#94a3b8] hover:text-white"
                  >
                    Download all 3 PDFs
                  </button>
                  <button onClick={submitInvoice} className="px-5 py-2.5 rounded text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500">
                    {delivery === 'factor' ? 'Submit to factor' : 'Send to broker'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {previewAttachment && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/75">
            <div className="w-full max-w-xl max-h-full overflow-y-auto rounded border border-[#1e2d47] shadow-2xl" style={{ background: 'var(--background)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]">
                <div>
                  <div className="text-sm font-semibold text-[#e8edf5]">{previewAttachment === 'invoice' ? 'Broker invoice' : previewAttachment === 'rate' ? 'Rate confirmation' : 'Proof of delivery'}</div>
                  <div className="text-xs text-[#64748b] mt-0.5">{load.id} · PDF preview</div>
                </div>
                <button onClick={() => setPreviewAttachment(null)} className="text-[#64748b]" aria-label="Close document preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button>
              </div>
              <div className="m-4 bg-white text-slate-900 min-h-96 p-8">
                <div className="flex justify-between border-b border-slate-200 pb-5">
                  <div><div className="text-xl font-bold">iWay Dispatch</div><div className="text-xs text-slate-500 mt-1">Current Way Logistics</div></div>
                  <div className="text-right"><div className="text-xs font-semibold text-slate-500">{previewAttachment === 'invoice' ? 'FREIGHT INVOICE' : previewAttachment === 'rate' ? 'RATE CONFIRMATION' : 'PROOF OF DELIVERY'}</div><div className="font-mono font-bold mt-1">{load.id}</div></div>
                </div>
                <div className="py-6 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Broker</span><span>{load.broker}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Route</span><span>{load.route}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Driver · truck</span><span>{load.driver} · {load.truck}</span></div>
                  {previewAttachment === 'invoice' && <><div className="flex justify-between"><span className="text-slate-500">Bill to</span><span>{destination}</span></div><div className="flex justify-between border-t border-slate-200 pt-4 font-bold"><span>Amount due</span><span>${load.rate.toFixed(2)}</span></div></>}
                  {previewAttachment === 'rate' && <><div className="flex justify-between"><span className="text-slate-500">Pickup</span><span>{load.pickup}</span></div><div className="flex justify-between border-t border-slate-200 pt-4 font-bold"><span>Agreed rate</span><span>${load.rate.toFixed(2)}</span></div></>}
                  {previewAttachment === 'pod' && <><div className="flex justify-between"><span className="text-slate-500">Delivery status</span><span className="text-emerald-700">Completed</span></div><div className="flex justify-between"><span className="text-slate-500">Receiver signature</span><span>On file</span></div><div className="mt-8 border-2 border-dashed border-slate-200 rounded p-8 text-center text-slate-400">Signed POD and driver-uploaded delivery images</div></>}
                </div>
              </div>
              <div className="px-4 pb-4">
                <button onClick={() => previewAttachment === 'invoice' ? createInvoicePdf(load, invoiceNumber, destination) : createSupportingPdf(load, previewAttachment === 'rate' ? 'Rate confirmation' : 'Proof of delivery', previewAttachment === 'rate' ? `${load.id}-rate-confirmation.pdf` : `${load.id}-proof-of-delivery.pdf`, previewAttachment === 'rate' ? [`Agreed freight rate: $${load.rate.toFixed(2)}`, `Pickup date: ${load.pickup}`, 'Terms: Net 30'] : ['Delivery status: Completed', 'Receiver signature: On file', 'POD uploaded by driver'])} className="w-full py-2.5 rounded border border-blue-500/30 text-blue-400 text-sm">Download this PDF</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Assign Driver Panel ── */

const AVAILABLE_DRIVERS = [
  { id: 'D-000', name: 'John Smith', initials: 'JS', cdl: 'CDL-TX-4892101', phone: '(214) 555-0142', status: 'Available', miles: 0 },
  { id: 'D-001', name: 'James Carter', initials: 'JC', cdl: 'TX-CDL-7841922', phone: '(214) 555-0142', status: 'Available', miles: 0 },
  { id: 'D-002', name: 'Amara Bekele', initials: 'AB', cdl: 'TX-CDL-6630841', phone: '(713) 555-0287', status: 'Off duty', miles: 0 },
  { id: 'D-003', name: 'Rafael Diaz', initials: 'RD', cdl: 'TX-CDL-9120455', phone: '(972) 555-0319', status: 'On load', miles: 342 },
  { id: 'D-004', name: 'Mike Okafor', initials: 'MO', cdl: 'TX-CDL-5540177', phone: '(469) 555-0458', status: 'On load', miles: 189 },
  { id: 'D-005', name: 'Lena Morales', initials: 'LM', cdl: 'TX-CDL-2298033', phone: '(210) 555-0061', status: 'Available', miles: 0 },
  { id: 'D-006', name: 'Kwame Asante', initials: 'KA', cdl: 'TX-CDL-8830022', phone: '(832) 555-0794', status: 'Onboarding', miles: 0 },
]

const AVAILABLE_TRUCKS = [
  { id: 'T-101', number: 'T-101', year: 2021, make: 'Kenworth', model: 'W900', vin: '1XKWDB0X5MJ123456', status: 'Available' },
  { id: 'T-104', number: 'T-104', year: 2020, make: 'Peterbilt', model: '389', vin: '1XPBD40X7LD654321', status: 'On load' },
  { id: 'T-108', number: 'T-108', year: 2022, make: 'Freightliner', model: 'Cascadia', vin: '3AKJGPD46NSFA1234', status: 'On load' },
  { id: 'T-112', number: 'T-112', year: 2023, make: 'Volvo', model: 'VNL 860', vin: '4V4NC9EJ0PN123789', status: 'On load' },
  { id: 'T-115', number: 'T-115', year: 2022, make: 'Kenworth', model: 'T680', vin: '1XKWD40X3NJ987654', status: 'Available' },
  { id: 'T-119', number: 'T-119', year: 2021, make: 'Peterbilt', model: '579', vin: '1XPCD40X0MD112233', status: 'In shop' },
]

const AVAILABLE_TRAILERS = [
  { id: 'TR-22', number: 'TR-22', type: '53ft Dry van', status: 'Available' },
  { id: 'TR-25', number: 'TR-25', type: '48ft Flatbed', status: 'Available' },
  { id: 'TR-31', number: 'TR-31', type: '53ft Dry van', status: 'In use' },
  { id: 'TR-38', number: 'TR-38', type: '53ft Reefer', status: 'Available' },
]

const DRIVER_STATUS_COLOR: Record<string, string> = {
  Available: '#10b981', 'Off duty': '#64748b', 'On load': '#3b82f6', Onboarding: '#f59e0b',
}

const TRUCK_STATUS_COLOR: Record<string, string> = {
  Available: '#10b981', 'On load': '#3b82f6', 'In shop': '#ef4444',
}

function AssignDriverPanel({ load, onClose, onAssigned }: {
  load: LoadRow
  onClose: () => void
  onAssigned: (loadId: string, driver: string, truck: string) => void
}) {
  const isReassign = load.status === 'Assigned'
  const [selectedDriver, setSelectedDriver] = useState<string>(isReassign ? load.driver : '')
  const [selectedTruck, setSelectedTruck] = useState<string>(isReassign ? load.truck : '')
  const [selectedTrailer, setSelectedTrailer] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const driver = AVAILABLE_DRIVERS.find(d => d.name.includes(selectedDriver.split('.')[0].trim()) || d.name === selectedDriver)
  const truck = AVAILABLE_TRUCKS.find(t => t.number === selectedTruck)

  function handleConfirm() {
    if (!selectedDriver || !selectedTruck) return
    setConfirmed(true)
    setTimeout(() => {
      onAssigned(load.id, selectedDriver, selectedTruck)
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[520px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="text-sm font-semibold text-[#e8edf5]">{isReassign ? 'Reassign' : 'Assign driver'} · <span className="font-mono text-amber-400">{load.id}</span></div>
            <div className="text-xs text-[#64748b] mt-0.5">{load.route} · {load.broker}</div>
          </div>
        </div>

        {confirmed ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-14 h-14 rounded-full border border-amber-500/40 bg-amber-500/15 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="w-7 h-7">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-base font-semibold text-[#e8edf5]">{isReassign ? 'Reassigned' : 'Assigned'}</div>
              <div className="text-xs text-[#64748b] mt-1">{selectedDriver} · {selectedTruck}</div>
              <div className="text-xs text-[#475569] mt-0.5 font-mono">Status → Assigned · Driver notified via app</div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Load summary tile */}
            <div className="rounded border border-[#1e2d47] px-4 py-3 flex items-center justify-between" style={{ background: 'var(--card)' }}>
              <div className="space-y-0.5">
                <div className="text-xs font-mono text-amber-400">{load.id}</div>
                <div className="text-sm font-medium text-[#e8edf5]">{load.route}</div>
                <div className="text-xs text-[#64748b]">{load.broker} · Pickup {load.pickup}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[#e8edf5] font-semibold">${load.rate.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                {isReassign && (
                  <div className="text-xs text-amber-300 mt-0.5">Currently: {load.driver} · {load.truck}</div>
                )}
              </div>
            </div>

            {/* Driver picker */}
            <div>
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">Select driver</div>
              <div className="space-y-2">
                {AVAILABLE_DRIVERS.map(d => {
                  const isSelected = selectedDriver === d.name
                  const canSelect = d.status !== 'Onboarding'
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => canSelect && setSelectedDriver(d.name)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded border text-left transition-all ${
                        isSelected ? 'border-amber-500/50' : canSelect ? 'border-[#1e2d47] hover:border-[#2a3a54]' : 'border-[#1e2d47] opacity-40 cursor-not-allowed'
                      }`}
                      style={{ background: isSelected ? '#f59e0b08' : 'var(--card)' }}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: isSelected ? '#f59e0b25' : '#1e2d47', color: isSelected ? '#f59e0b' : '#64748b' }}>
                        {d.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isSelected ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{d.name}</div>
                        <div className="text-xs text-[#475569] mt-0.5 truncate">{d.cdl} · {d.phone}</div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${DRIVER_STATUS_COLOR[d.status]}18`, color: DRIVER_STATUS_COLOR[d.status] }}>
                          {d.status}
                        </span>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="w-4 h-4">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Truck picker */}
            <div>
              <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">Select tractor</div>
              <div className="space-y-2">
                {AVAILABLE_TRUCKS.map(t => {
                  const isSelected = selectedTruck === t.number
                  const canSelect = t.status !== 'In shop'
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => canSelect && setSelectedTruck(t.number)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded border text-left transition-all ${
                        isSelected ? 'border-amber-500/50' : canSelect ? 'border-[#1e2d47] hover:border-[#2a3a54]' : 'border-[#1e2d47] opacity-40 cursor-not-allowed'
                      }`}
                      style={{ background: isSelected ? '#f59e0b08' : 'var(--card)' }}
                    >
                      <div>
                        <div className={`text-sm font-semibold font-mono ${isSelected ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{t.number}</div>
                        <div className="text-xs text-[#475569] mt-0.5">{t.year} {t.make} {t.model}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${TRUCK_STATUS_COLOR[t.status]}18`, color: TRUCK_STATUS_COLOR[t.status] }}>
                          {t.status}
                        </span>
                        {isSelected && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" className="w-4 h-4">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Trailer picker */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Trailer</div>
                <span className="text-xs text-[#475569]">(optional)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_TRAILERS.map(tr => {
                  const isSelected = selectedTrailer === tr.number
                  const canSelect = tr.status === 'Available'
                  return (
                    <button
                      key={tr.id}
                      type="button"
                      disabled={!canSelect}
                      onClick={() => canSelect && setSelectedTrailer(isSelected ? '' : tr.number)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded border text-left transition-all ${
                        isSelected ? 'border-amber-500/50' : canSelect ? 'border-[#1e2d47] hover:border-[#2a3a54]' : 'border-[#1e2d47] opacity-40 cursor-not-allowed'
                      }`}
                      style={{ background: isSelected ? '#f59e0b08' : 'var(--card)' }}
                    >
                      <div>
                        <div className={`text-xs font-mono font-semibold ${isSelected ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{tr.number}</div>
                        <div className="text-xs text-[#475569] mt-0.5">{tr.type}</div>
                      </div>
                      <span className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: canSelect ? '#10b98118' : '#ef444418', color: canSelect ? '#10b981' : '#ef4444' }}>
                        {tr.status}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* Footer */}
        {!confirmed && (
          <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between gap-3" style={{ background: 'var(--card)' }}>
            <button onClick={onClose} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors">
              Cancel
            </button>
            <div className="flex items-center gap-3">
              {selectedDriver && selectedTruck && (
                <div className="text-xs text-[#64748b] text-right">
                  <div className="font-medium text-[#94a3b8]">{selectedDriver}</div>
                  <div>{selectedTruck}{selectedTrailer ? ` · ${selectedTrailer}` : ''}</div>
                </div>
              )}
              <button
                onClick={handleConfirm}
                disabled={!selectedDriver || !selectedTruck}
                className={`px-5 py-2.5 rounded text-sm font-semibold transition-all ${selectedDriver && selectedTruck ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed'}`}
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {isReassign ? 'Reassign driver' : 'Assign driver'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Onboarding Hub (Screen 09) ── */
type OnboardingType = 'Driver' | 'Vehicle' | 'Truck owner' | 'Broker' | 'Customer' | 'Factoring company'

interface OnboardingItem {
  name: string
  type: OnboardingType
  stage: string
  waitingOn: string
  started: string
  color: string
  mode?: 'invite' | 'admin'
}

function OnboardingHub() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'me' | 'them' | 'changes'>('all')
  const [activeType, setActiveType] = useState<OnboardingType | null>(null)
  const [selectedItem, setSelectedItem] = useState<OnboardingItem | null>(null)
  const [inProgress, setInProgress] = useState<OnboardingItem[]>([
    { name: 'Kwame Asante', type: 'Driver', stage: 'Safety checks', waitingOn: 'Driver: Clearinghouse consent', started: 'Sep 26', color: '#f59e0b', mode: 'invite' },
    { name: 'T-121 · 2022 Volvo VNL', type: 'Vehicle', stage: 'Details', waitingOn: 'Owner: insurance upload', started: 'Sep 27', color: '#3b82f6' },
    { name: 'Prairie Crossing Logistics', type: 'Broker', stage: 'Ready for review', waitingOn: 'You: approve', started: 'Sep 27', color: '#8b5cf6' },
    { name: 'Gulf Coast Cold Storage', type: 'Customer', stage: 'Details', waitingOn: 'Dispatcher: contacts', started: 'Sep 27', color: '#10b981' },
    { name: 'Apex Capital Funding', type: 'Factoring company', stage: 'Verification', waitingOn: 'You: remit-to callback', started: 'Sep 20', color: '#f59e0b' },
    { name: 'Lena Morales', type: 'Driver', stage: 'Needs changes', waitingOn: 'Driver: medical card photo blurry', started: 'Sep 24', color: '#ef4444', mode: 'invite' },
    { name: 'Delta Haul LLC', type: 'Truck owner', stage: 'Ready for review', waitingOn: 'You: approve lease', started: 'Sep 23', color: '#8b5cf6' },
  ])

  const STAGE_COLORS: Record<string, string> = {
    'Safety checks': '#f59e0b', 'Details': '#3b82f6', 'Ready for review': '#8b5cf6',
    'Verification': '#f59e0b', 'Needs changes': '#ef4444',
  }

  const TILES = [
    { type: 'Driver' as const, desc: 'Invite by SMS or email; driver finishes in the app', color: '#10b981' },
    { type: 'Vehicle' as const, desc: 'Truck, tractor or trailer; VIN decode', color: '#3b82f6' },
    { type: 'Truck owner' as const, desc: 'Owner-operator; lease, W-9, bank', color: '#f59e0b' },
    { type: 'Broker' as const, desc: 'MC lookup, credit approval, agreement', color: '#8b5cf6' },
    { type: 'Customer' as const, desc: 'Shipper or receiver facility, or direct shipper', color: '#10b981' },
    { type: 'Factoring company' as const, desc: 'Terms, remit-to callback, agreement', color: '#f59e0b' },
  ]

  const filteredItems = activeFilter === 'all' ? inProgress
    : activeFilter === 'me' ? inProgress.filter((i) => i.waitingOn.startsWith('You'))
    : activeFilter === 'them' ? inProgress.filter((i) => !i.waitingOn.startsWith('You') && !i.stage.includes('changes'))
    : inProgress.filter((i) => i.stage === 'Needs changes')

  function addItem(item: OnboardingItem) {
    setInProgress(current => [item, ...current])
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-[#e8edf5]">Onboarding</h1>
        <p className="text-xs text-[#64748b] mt-0.5">Everything new starts here and stays hidden from dispatch and accounting until approved</p>
      </div>

      {/* Type tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {TILES.map((t) => (
          <div key={t.type} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-sm font-semibold text-[#e8edf5] mb-1">{t.type}</div>
            <div className="text-xs text-[#64748b] mb-3 leading-relaxed">{t.desc}</div>
            {inProgress.filter(item => item.type === t.type).length > 0 && (
              <div className="text-xs font-mono mb-2" style={{ color: t.color }}>
                {inProgress.filter(item => item.type === t.type).length} in progress
              </div>
            )}
            <button
              onClick={() => setActiveType(t.type)}
              className="text-xs px-3 py-1.5 rounded border font-medium transition-all hover:opacity-80"
              style={{ borderColor: `${t.color}40`, color: t.color, background: `${t.color}10` }}
            >
              + New
            </button>
          </div>
        ))}
      </div>

      {/* In progress queue */}
      <div className="rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]">
          <div className="text-sm font-semibold text-[#e8edf5]">In progress · {inProgress.length}</div>
          <div className="flex items-center gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: 'me', label: `Waiting on me · ${inProgress.filter(i => i.waitingOn.startsWith('You')).length}` },
              { key: 'them', label: `Waiting on them · ${inProgress.filter(i => !i.waitingOn.startsWith('You') && !i.stage.includes('changes')).length}` },
              { key: 'changes', label: `Needs changes · ${inProgress.filter(i => i.stage === 'Needs changes').length}` },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key as typeof activeFilter)}
                className={`text-xs px-2.5 py-1 rounded-full transition-all ${activeFilter === f.key ? 'bg-amber-500 text-white' : 'border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d47]">
              {['NAME', 'TYPE', 'STAGE', 'WAITING ON', 'STARTED', ''].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 text-[#475569] font-medium tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d47]">
            {filteredItems.map((row) => (
              <tr key={row.name} className="hover:bg-[#111827] transition-colors">
                <td className="px-4 py-3 font-medium text-[#e8edf5]">{row.name}</td>
                <td className="px-4 py-3 text-[#64748b]">{row.type}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: `${STAGE_COLORS[row.stage]}18`, color: STAGE_COLORS[row.stage] }}>
                    {row.stage}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#64748b]">{row.waitingOn}</td>
                <td className="px-4 py-3 text-[#475569]">{row.started}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedItem(row)}
                    className={`text-xs px-3 py-1 rounded font-medium transition-colors ${row.waitingOn.startsWith('You') ? 'bg-blue-500 text-white hover:bg-blue-600' : 'border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8]'}`}
                  >
                    {row.waitingOn.startsWith('You') ? 'Review' : 'Open'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeType === 'Vehicle' && (
        <AddVehiclePanel
          nextTractorUnit="T-122"
          nextTrailerUnit="TR-222"
          completeOnboarding
          onClose={() => setActiveType(null)}
          onAdded={() => setActiveType(null)}
        />
      )}
      {activeType && activeType !== 'Vehicle' && (
        <OnboardingFlow
          type={activeType}
          onClose={() => setActiveType(null)}
          onCreated={addItem}
        />
      )}
      {selectedItem && selectedItem.type === 'Driver' && (
        <DriverOnboardingProgress
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onComplete={() => {
            setInProgress(current => current.filter(item => item !== selectedItem))
            setSelectedItem(null)
          }}
        />
      )}
      {selectedItem && selectedItem.type !== 'Driver' && (
        <OnboardingItemPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onComplete={() => {
            setInProgress(current => current.filter(item => item !== selectedItem))
            setSelectedItem(null)
          }}
        />
      )}
    </div>
  )
}

const ONBOARDING_CONFIG: Record<Exclude<OnboardingType, 'Vehicle'>, {
  subtitle: string
  action: string
  waitingOn: string
  fields: { key: string; label: string; placeholder: string; type?: string; optional?: boolean }[]
  documents: string[]
}> = {
  Driver: {
    subtitle: 'Invite a driver to complete identity, license and safety requirements in the Driver app.',
    action: 'Send driver invite',
    waitingOn: 'Driver: complete app onboarding',
    fields: [
      { key: 'name', label: 'Full legal name', placeholder: 'e.g. Jordan Ellis' },
      { key: 'phone', label: 'Mobile phone', placeholder: '(555) 000-0000', type: 'tel' },
      { key: 'email', label: 'Email', placeholder: 'driver@example.com', type: 'email' },
      { key: 'licenseState', label: 'CDL state', placeholder: 'e.g. TX' },
    ],
    documents: ['Commercial driver license', 'Medical examiner certificate', 'Motor vehicle record consent'],
  },
  'Truck owner': {
    subtitle: 'Add an owner-operator or fleet owner and begin the lease and payment setup.',
    action: 'Start owner onboarding',
    waitingOn: 'Owner: lease, W-9 and bank details',
    fields: [
      { key: 'name', label: 'Legal owner or company name', placeholder: 'e.g. Ellis Transport LLC' },
      { key: 'phone', label: 'Mobile phone', placeholder: '(555) 000-0000', type: 'tel' },
      { key: 'email', label: 'Email', placeholder: 'owner@example.com', type: 'email' },
      { key: 'ein', label: 'EIN or SSN last 4', placeholder: 'e.g. 4821', optional: true },
    ],
    documents: ['Carrier lease agreement', 'Form W-9', 'Voided check or bank letter'],
  },
  Broker: {
    subtitle: 'Verify broker authority, credit and billing terms before dispatching a load.',
    action: 'Submit broker for review',
    waitingOn: 'You: verify authority and credit',
    fields: [
      { key: 'name', label: 'Legal business name', placeholder: 'e.g. Horizon Freight Brokerage' },
      { key: 'mc', label: 'MC number', placeholder: 'MC 000000' },
      { key: 'email', label: 'Billing email', placeholder: 'ap@broker.example', type: 'email' },
      { key: 'phone', label: 'Primary phone', placeholder: '(555) 000-0000', type: 'tel' },
      { key: 'address', label: 'Business address', placeholder: 'Street, city, state, ZIP', optional: true },
    ],
    documents: ['Broker-carrier agreement', 'Rate confirmation template', 'Certificate of insurance'],
  },
  Customer: {
    subtitle: 'Create a shipper, receiver facility or direct customer for load planning and billing.',
    action: 'Add customer',
    waitingOn: 'You: verify customer details',
    fields: [
      { key: 'name', label: 'Company or facility name', placeholder: 'e.g. Central Distribution Center' },
      { key: 'contact', label: 'Primary contact', placeholder: 'e.g. Morgan Lee' },
      { key: 'email', label: 'Contact email', placeholder: 'shipping@example.com', type: 'email' },
      { key: 'address', label: 'Facility address', placeholder: 'Street, city, state, ZIP' },
    ],
    documents: ['Customer agreement', 'Credit application', 'Facility instructions'],
  },
  'Factoring company': {
    subtitle: 'Set up assignment terms and verified remit-to instructions for factored invoices.',
    action: 'Submit factor for verification',
    waitingOn: 'You: complete remit-to callback',
    fields: [
      { key: 'name', label: 'Legal company name', placeholder: 'e.g. Summit Capital Funding' },
      { key: 'contact', label: 'Verification contact', placeholder: 'e.g. Taylor Morgan' },
      { key: 'phone', label: 'Callback phone', placeholder: '(555) 000-0000', type: 'tel' },
      { key: 'email', label: 'Remittance email', placeholder: 'remit@factor.example', type: 'email' },
      { key: 'address', label: 'Business address', placeholder: 'Street, city, state, ZIP', optional: true },
    ],
    documents: ['Notice of assignment', 'Factoring agreement', 'Verified remit-to instructions'],
  },
}

function OnboardingFlow({ type, onClose, onCreated }: {
  type: Exclude<OnboardingType, 'Vehicle'>
  onClose: () => void
  onCreated: (item: OnboardingItem) => void
}) {
  const config = ONBOARDING_CONFIG[type]
  const [step, setStep] = useState<0 | 1>(0)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploads, setUploads] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const canAdminComplete = type === 'Driver' || type === 'Truck owner'
  const [completionMode, setCompletionMode] = useState<'invite' | 'admin'>('invite')
  const adminCompleting = canAdminComplete && completionMode === 'admin'

  function continueToReview() {
    const nextErrors: Record<string, string> = {}
    config.fields.forEach(field => {
      if (!field.optional && !values[field.key]?.trim()) nextErrors[field.key] = `${field.label} is required`
    })
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) setStep(1)
  }

  function submit() {
    if (!adminCompleting || type === 'Driver') {
      onCreated({
        name: values.name,
        type,
        stage: adminCompleting && type === 'Driver' ? 'Ready for review' : type === 'Driver' || type === 'Truck owner' ? 'Details' : 'Ready for review',
        waitingOn: adminCompleting && type === 'Driver' ? 'You: review admin-entered driver' : config.waitingOn,
        started: 'Today',
        color: type === 'Broker' ? '#8b5cf6' : type === 'Customer' || type === 'Driver' ? '#10b981' : '#f59e0b',
        mode: type === 'Driver' || type === 'Truck owner' ? completionMode : undefined,
      })
    }
    setDone(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[560px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="shrink-0 px-6 py-4 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors" aria-label="Close onboarding flow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="text-sm font-semibold text-[#e8edf5]">New {type.toLowerCase()}</div>
            <div className="text-xs text-[#64748b] mt-0.5">Onboarding · {done ? 'Created' : step === 0 ? 'Details' : 'Review'}</div>
          </div>
        </div>

        {!done && (
          <div className="shrink-0 px-6 py-3 border-b border-[#1e2d47] flex items-center gap-3">
            {['Details', 'Review + requirements'].map((label, index) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index <= step ? 'bg-amber-500 text-[#070c18]' : 'bg-[#1e2d47] text-[#64748b]'}`}>
                  {index + 1}
                </span>
                <span className={`text-xs font-medium ${index === step ? 'text-[#e8edf5]' : 'text-[#64748b]'}`}>{label}</span>
                {index === 0 && <span className="h-px bg-[#1e2d47] flex-1" />}
              </div>
            ))}
          </div>
        )}

        {done ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-14 h-14 rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="w-7 h-7">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-xs font-mono text-emerald-400 font-semibold tracking-wider">
              {adminCompleting && type === 'Driver' ? 'DRIVER READY FOR REVIEW' : adminCompleting ? 'ONBOARDING COMPLETED' : 'ONBOARDING STARTED'}
            </div>
            <div className="text-xl font-semibold text-[#e8edf5] mt-2">{values.name}</div>
            <div className="text-sm text-[#64748b] mt-1 max-w-sm">
              {adminCompleting && type === 'Driver'
                ? 'All driver information was entered by the carrier admin. Open the progress record to review and approve.'
                : adminCompleting
                ? `${type} was approved by the carrier admin and is ready for operational setup.`
                : config.waitingOn}
            </div>
            <button onClick={onClose} className="mt-6 px-5 py-2.5 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              Done
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === 0 ? (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-[#e8edf5]">{type} details</h2>
                  <p className="text-xs text-[#64748b] mt-1 leading-relaxed">{config.subtitle}</p>
                </div>
                {canAdminComplete && (
                  <div>
                    <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">Who will complete onboarding?</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCompletionMode('invite')}
                        className={`rounded border p-4 text-left transition-all ${completionMode === 'invite' ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
                      >
                        <span className={`block text-sm font-semibold ${completionMode === 'invite' ? 'text-amber-300' : 'text-[#94a3b8]'}`}>Invite to complete</span>
                        <span className="block text-xs text-[#475569] mt-1 leading-relaxed">
                          Send a secure link so the {type === 'Driver' ? 'driver' : 'owner'} can enter details and upload documents.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompletionMode('admin')}
                        className={`rounded border p-4 text-left transition-all ${completionMode === 'admin' ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
                      >
                        <span className={`block text-sm font-semibold ${completionMode === 'admin' ? 'text-blue-300' : 'text-[#94a3b8]'}`}>Complete as admin</span>
                        <span className="block text-xs text-[#475569] mt-1 leading-relaxed">
                          Enter all details and documents now, then approve onboarding on behalf of the carrier.
                        </span>
                      </button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  {config.fields.map((field, index) => (
                    <label key={field.key} className={index === 0 ? 'col-span-2' : ''}>
                      <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">
                        {field.label}{field.optional ? <span className="text-[#475569]"> · optional</span> : <span className="text-amber-400"> *</span>}
                      </span>
                      <input
                        type={field.type || 'text'}
                        value={values[field.key] || ''}
                        onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
                        placeholder={field.placeholder}
                        className={`w-full px-3 py-2.5 rounded border text-sm bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40 ${errors[field.key] ? 'border-red-500/50' : 'border-[#1e2d47]'}`}
                      />
                      {errors[field.key] && <span className="block text-xs text-red-400 mt-1 font-mono">{errors[field.key]}</span>}
                    </label>
                  ))}
                </div>
                {type === 'Driver' && completionMode === 'invite' && (
                  <div className="rounded border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-300">
                    The driver will receive a secure link by SMS and email to finish identity and compliance steps.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold text-[#e8edf5]">Review + requirements</h2>
                  <p className="text-xs text-[#64748b] mt-1">Confirm the details and attach any documents already available. Missing items can be completed later.</p>
                </div>
                <div className="rounded border border-[#1e2d47] divide-y divide-[#1e2d47]" style={{ background: 'var(--card)' }}>
                  {config.fields.filter(field => values[field.key]).map(field => (
                    <div key={field.key} className="flex items-start justify-between gap-4 px-4 py-3 text-xs">
                      <span className="text-[#64748b]">{field.label}</span>
                      <span className="text-[#e8edf5] text-right">{values[field.key]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">Requirements</div>
                  {adminCompleting && (
                    <div className="rounded border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-300 mb-3">
                      Carrier-admin completion requires every document below. Uploaded records will be attributed to the signed-in admin in the audit log.
                    </div>
                  )}
                  <div className="space-y-2">
                    {config.documents.map(document => {
                      const uploaded = uploads.includes(document)
                      return (
                        <div key={document} className="flex items-center justify-between rounded border border-[#1e2d47] px-4 py-3" style={{ background: 'var(--card)' }}>
                          <div>
                            <div className="text-sm text-[#94a3b8]">{document}</div>
                            <div className={`text-xs mt-0.5 ${uploaded ? 'text-emerald-400' : 'text-[#475569]'}`}>{uploaded ? 'Attached' : 'Can be added later'}</div>
                          </div>
                          <button
                            onClick={() => setUploads(current => uploaded ? current.filter(item => item !== document) : [...current, document])}
                            className="text-xs px-3 py-1.5 rounded border border-[#2a3a54] text-[#64748b] hover:text-[#94a3b8]"
                          >
                            {uploaded ? 'Remove' : 'Upload'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!done && (
          <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between" style={{ background: 'var(--card)' }}>
            <button onClick={() => step === 0 ? onClose() : setStep(0)} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8]">
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button
              onClick={step === 0 ? continueToReview : submit}
              disabled={step === 1 && adminCompleting && uploads.length < config.documents.length}
              className={`px-5 py-2.5 rounded text-sm font-semibold transition-all ${
                step === 1 && adminCompleting && uploads.length < config.documents.length
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:opacity-90'
              }`}
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {step === 0
                ? 'Continue to review'
                : adminCompleting
                  ? type === 'Driver' ? 'Save + review driver' : `Approve + complete ${type.toLowerCase()}`
                  : config.action}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DriverOnboardingProgress({ item, onClose, onComplete }: {
  item: OnboardingItem
  onClose: () => void
  onComplete: () => void
}) {
  const steps = [
    { label: 'Invite', sub: item.mode === 'admin' ? 'Admin started' : 'SMS + email sent' },
    { label: 'Profile + license', sub: 'Identity, contact, CDL' },
    { label: 'Safety checks', sub: 'MVR, Clearinghouse, drug test' },
    { label: 'Documents', sub: 'CDL, medical card, forms' },
    { label: 'Pay setup', sub: 'Rate, tax, direct deposit' },
    { label: 'Review + approve', sub: 'Manager approval' },
  ]
  const initialStep = item.stage === 'Ready for review' ? 5 : item.stage === 'Safety checks' ? 2 : item.stage === 'Needs changes' ? 3 : item.mode === 'admin' ? 1 : 0
  const [step, setStep] = useState(initialStep)
  const adminMode = item.mode === 'admin'
  const fieldSets = [
    [['Delivery method', adminMode ? 'Carrier admin entry' : 'SMS + email'], ['Invite status', adminMode ? 'Not required' : 'Delivered'], ['Mobile phone', '(832) 555-0794'], ['Email', 'kwame.asante@example.com']],
    [['Full legal name', item.name], ['Mobile phone', '(832) 555-0794'], ['Home address', '1840 Westheimer Rd, Houston, TX'], ['CDL', 'Class A · TX · exp Jun 2029'], ['Endorsements', 'Tanker (N)'], ['Employment type', 'Company driver']],
    [['License', 'CDL Class A · TX · exp Jun 2029'], ['Endorsements', 'Tanker (N)'], ['MVR pulled', 'Sep 27 · 1 minor violation'], ['Clearinghouse full query', adminMode ? 'Consent uploaded by admin' : 'Waiting for driver consent'], ['Pre-employment drug test', 'Scheduled Sep 29 · Quest'], ['Previous employers (3 yrs)', '2 requests sent'], ['Road test', 'Book a date'], ['Employment type', 'Company driver']],
    [['CDL front + back', 'Uploaded'], ['DOT medical card', item.stage === 'Needs changes' ? 'Replacement required' : 'Exp Mar 2027'], ['Driver application', adminMode ? 'Completed by admin' : 'Waiting on driver'], ['W-4', adminMode ? 'Uploaded' : 'Missing'], ['Direct deposit form', adminMode ? 'Uploaded' : 'Missing'], ['Clearinghouse consent', adminMode ? 'Uploaded' : 'Pending']],
    [['Pay method', '28% of gross'], ['Minimum / guarantee', 'None'], ['Insurance deduction', '$150 weekly'], ['Escrow installment', '$100 weekly'], ['Fuel card charges', 'Actual transactions'], ['Direct deposit', adminMode ? 'Verified · ending 4821' : 'Waiting on driver']],
    [['Driver status', 'Ready for manager review'], ['Dispatch eligibility', 'Pending approval'], ['Assigned truck', 'Assign after approval'], ['Onboarding path', adminMode ? 'Completed by carrier admin' : 'Driver self-service invite'], ['Audit owner', adminMode ? 'Carrier admin' : 'Driver + carrier admin']],
  ]
  const checks = [
    ['CDL valid', 'Pass', 'valid'],
    ['MVR review', '1 item', 'warning'],
    ['Clearinghouse', adminMode ? 'Uploaded' : 'Consent', adminMode ? 'valid' : 'pending'],
    ['Drug test', 'Sep 29', 'pending'],
    ['Employment history', '1 of 2', 'warning'],
  ]
  const documents = [
    ['CDL front + back', 'Uploaded', 'valid'],
    ['DOT medical card', item.stage === 'Needs changes' ? 'Replace' : 'Exp Mar 2027', item.stage === 'Needs changes' ? 'warning' : 'valid'],
    ['Application', adminMode ? 'Complete' : 'Missing', adminMode ? 'valid' : 'missing'],
    ['W-4', adminMode ? 'Uploaded' : 'Missing', adminMode ? 'valid' : 'missing'],
    ['Direct deposit', adminMode ? 'Verified' : 'Missing', adminMode ? 'valid' : 'missing'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-3 md:p-5">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-7xl flex flex-col rounded-lg overflow-hidden border border-[#1e2d47] shadow-2xl" style={{ background: 'var(--background)' }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e2d47]">
          <button onClick={onClose} className="text-[#64748b]" aria-label="Close driver onboarding"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button>
          <div className="flex-1"><div className="text-lg font-semibold text-[#e8edf5]">New driver · {item.name}</div><div className="text-xs text-[#64748b] mt-0.5">{adminMode ? 'Carrier admin is completing all steps' : `Invited ${item.started} · driver is completing steps in the app`}</div></div>
          <span className={`text-xs px-2.5 py-1 rounded ${adminMode ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'}`}>{adminMode ? 'Admin completed' : 'Invite in progress'}</span>
        </div>
        <div className="flex flex-1 min-h-0">
          <aside className="w-56 shrink-0 border-r border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            {steps.map((stage, index) => (
              <button key={stage.label} onClick={() => setStep(index)} className={`w-full flex gap-3 rounded px-3 py-3 text-left ${step === index ? 'bg-blue-500/15 border border-blue-500/30' : 'border border-transparent'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${index < step ? 'bg-emerald-600 text-white' : step === index ? 'bg-blue-600 text-white' : 'bg-[#1e2d47] text-[#64748b]'}`}>{index < step ? '✓' : index + 1}</span>
                <span><span className={`block text-xs font-semibold ${step === index ? 'text-blue-300' : 'text-[#94a3b8]'}`}>{stage.label}</span><span className="block text-[10px] text-[#475569] mt-0.5">{stage.sub}</span></span>
              </button>
            ))}
          </aside>
          <main className="flex-1 overflow-y-auto p-6">
            <div className="text-lg font-semibold text-[#e8edf5]">Step {step + 1} · {steps[step].label}</div>
            <div className="text-xs text-[#64748b] mt-1">{adminMode ? 'Carrier admin may enter and verify information on the driver’s behalf.' : 'Driver-submitted information updates here as each app step is completed.'}</div>
            {step === 2 && <div className="mt-4 rounded border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">MVR returned 1 minor violation from 2024. Review before approval. {adminMode ? 'Clearinghouse consent was uploaded by the admin.' : 'Clearinghouse query is waiting for driver consent.'}</div>}
            <div className="grid grid-cols-2 gap-4 mt-5">
              {fieldSets[step].map(([label, value]) => (
                <label key={label}><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">{label}</span><input value={value} readOnly={!adminMode} onChange={() => {}} className={`w-full px-3 py-2.5 rounded border border-[#1e2d47] text-sm text-[#e8edf5] focus:outline-none ${adminMode ? 'bg-[#0d1424] focus:border-amber-500/40' : 'bg-[#111827]'}`} /></label>
              ))}
            </div>
          </main>
          <aside className="w-72 shrink-0 border-l border-[#1e2d47] p-4 space-y-4" style={{ background: 'var(--card)' }}>
            {[['Checks', checks], ['Documents', documents]].map(([title, rows]) => (
              <div key={title as string} className="rounded border border-[#1e2d47] p-4 bg-[#0d1424]">
                <div className="text-sm font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">{title as string}</div>
                {(rows as string[][]).map(([label, value, status]) => <div key={label} className="flex justify-between items-center gap-2 py-2.5 border-b border-[#1e2d47] last:border-0 text-xs"><span className="text-[#94a3b8]">{label}</span><span className={`px-2 py-0.5 rounded ${status === 'valid' ? 'bg-emerald-500/15 text-emerald-400' : status === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{value}</span></div>)}
              </div>
            ))}
          </aside>
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex justify-between" style={{ background: 'var(--card)' }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b]">Save draft</button>
          <div className="flex gap-2">{!adminMode && <button className="px-4 py-2.5 rounded border border-red-500/30 text-sm text-red-400">Send back</button>}<button onClick={() => step < 5 ? setStep(step + 1) : onComplete()} className="px-5 py-2.5 rounded bg-blue-600 text-white text-sm font-semibold">{step < 5 ? `Continue to ${steps[step + 1].label.toLowerCase()}` : 'Approve driver'}</button></div>
        </div>
      </div>
    </div>
  )
}

function OnboardingItemPanel({ item, onClose, onComplete }: {
  item: OnboardingItem
  onClose: () => void
  onComplete: () => void
}) {
  const [reminderSent, setReminderSent] = useState(false)
  const isReview = item.waitingOn.startsWith('You')
  const isNeedsChanges = item.stage === 'Needs changes'
  const requirements: Record<OnboardingType, string[]> = {
    Driver: ['Identity and contact details', 'CDL and medical card', 'Safety checks and consent'],
    Vehicle: ['VIN and registration', 'Ownership details', 'Insurance certificates'],
    'Truck owner': ['Owner profile and W-9', 'Lease agreement', 'Banking details'],
    Broker: ['FMCSA authority', 'Credit approval', 'Broker-carrier agreement'],
    Customer: ['Facility details', 'Primary contacts', 'Billing preferences'],
    'Factoring company': ['Notice of assignment', 'Remit-to verification', 'Factoring agreement'],
  }
  const currentStep = item.stage === 'Details' ? 0
    : item.stage === 'Safety checks' || item.stage === 'Verification' ? 1
    : 2

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full sm:w-[520px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="shrink-0 px-6 py-4 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors" aria-label="Close onboarding details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#e8edf5] truncate">{item.name}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{item.type} onboarding · Started {item.started}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-[#475569] uppercase tracking-wide">Current stage</div>
                <div className="text-base font-semibold text-[#e8edf5] mt-1">{item.stage}</div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded font-medium" style={{ background: `${item.color}18`, color: item.color }}>
                In progress
              </span>
            </div>
            <div className={`mt-4 rounded border px-3 py-2.5 text-xs ${isNeedsChanges ? 'border-red-500/20 bg-red-500/10 text-red-300' : isReview ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
              <span className="font-semibold">Waiting on:</span> {item.waitingOn}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">Onboarding progress</div>
            <div className="space-y-2">
              {requirements[item.type].map((requirement, index) => {
                const complete = index < currentStep
                const active = index === currentStep
                return (
                  <div key={requirement} className="flex items-center gap-3 rounded border border-[#1e2d47] px-4 py-3" style={{ background: 'var(--card)' }}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${complete ? 'bg-emerald-500' : active ? 'bg-amber-500' : 'bg-[#1e2d47]'}`}>
                      {complete ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3.5 h-3.5">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className={`text-xs font-bold ${active ? 'text-[#070c18]' : 'text-[#64748b]'}`}>{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className={`text-sm ${complete ? 'text-[#64748b]' : active ? 'text-[#e8edf5] font-medium' : 'text-[#475569]'}`}>{requirement}</div>
                      <div className="text-xs text-[#475569] mt-0.5">{complete ? 'Complete' : active ? item.stage : 'Not started'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded border border-[#1e2d47] px-4 py-3 text-xs" style={{ background: 'var(--card)' }}>
            <div className="text-[#475569] uppercase tracking-wide font-semibold mb-2">Activity</div>
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
              <div>
                <div className="text-[#94a3b8]">{item.waitingOn}</div>
                <div className="text-[#475569] mt-0.5">{item.started} · Current Way Logistics</div>
              </div>
            </div>
            {reminderSent && (
              <div className="flex items-start gap-3 mt-3 pt-3 border-t border-[#1e2d47]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <div>
                  <div className="text-emerald-400">Reminder sent successfully</div>
                  <div className="text-[#475569] mt-0.5">Just now · Email and app notification</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between gap-3" style={{ background: 'var(--card)' }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8]">
            Close
          </button>
          {isReview ? (
            <button onClick={onComplete} className="px-5 py-2.5 rounded text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">
              Approve + complete
            </button>
          ) : (
            <button
              onClick={() => setReminderSent(true)}
              disabled={reminderSent}
              className={`px-5 py-2.5 rounded text-sm font-semibold transition-all ${reminderSent ? 'bg-[#1e2d47] text-[#64748b] cursor-default' : 'hover:opacity-90'}`}
              style={reminderSent ? {} : { background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {reminderSent ? 'Reminder sent' : isNeedsChanges ? 'Remind to update' : 'Send reminder'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Compliance Centre (Screen 03) ── */
function ComplianceCentre() {
  const [tab, setTab] = useState<'drivers' | 'trucks' | 'owners' | 'carrier'>('drivers')
  const TABS = [
    { id: 'drivers' as const, label: 'Drivers · 14' },
    { id: 'trucks' as const, label: 'Trucks + trailers · 18' },
    { id: 'owners' as const, label: 'Owner-operators · 5' },
    { id: 'carrier' as const, label: 'Carrier · 9' },
  ]
  const DRIVERS = [
    { name: 'R. Diaz', truck: 'T-112', cdl: { v: 'Jun 2029', s: 'valid' }, med: { v: 'Expired Sep 02', s: 'expired' }, mvr: { v: 'Mar 2027', s: 'valid' }, clear: { v: 'Jan 2027', s: 'valid' }, drug: { v: 'On file', s: 'valid' }, dispatch: 'Blocked' },
    { name: 'A. Bekele', truck: 'T-108', cdl: { v: '28 days', s: 'expiring' }, med: { v: 'Aug 2027', s: 'valid' }, mvr: { v: 'Nov 2026', s: 'valid' }, clear: { v: 'Feb 2027', s: 'valid' }, drug: { v: 'On file', s: 'valid' }, dispatch: 'Allowed' },
    { name: 'J. Carter', truck: 'T-104', cdl: { v: 'Oct 2030', s: 'valid' }, med: { v: '19 days', s: 'expiring' }, mvr: { v: 'May 2027', s: 'valid' }, clear: { v: 'May 2027', s: 'valid' }, drug: { v: 'On file', s: 'valid' }, dispatch: 'Allowed' },
    { name: 'M. Okafor', truck: 'T-101', cdl: { v: 'Feb 2028', s: 'valid' }, med: { v: 'Dec 2027', s: 'valid' }, mvr: { v: 'Jul 2027', s: 'valid' }, clear: { v: '9 days', s: 'expiring' }, drug: { v: 'On file', s: 'valid' }, dispatch: 'Allowed' },
    { name: 'S. Nwosu', truck: 'T-115', cdl: { v: 'Sep 2029', s: 'valid' }, med: { v: 'Apr 2028', s: 'valid' }, mvr: { v: 'Missing', s: 'missing' }, clear: { v: 'Aug 2027', s: 'valid' }, drug: { v: 'Missing', s: 'missing' }, dispatch: 'Blocked' },
    { name: 'K. Brooks', truck: 'T-109', cdl: { v: 'Jan 2031', s: 'valid' }, med: { v: 'Jun 2028', s: 'valid' }, mvr: { v: 'Jan 2027', s: 'valid' }, clear: { v: 'Mar 2027', s: 'valid' }, drug: { v: 'On file', s: 'valid' }, dispatch: 'Allowed' },
  ]

  const chipColor = (s: string) => s === 'valid' ? '#10b981' : s === 'expiring' ? '#f59e0b' : s === 'expired' ? '#ef4444' : '#64748b'
  const chipBg = (s: string) => s === 'valid' ? '#10b98118' : s === 'expiring' ? '#f59e0b18' : s === 'expired' ? '#ef444418' : '#1e2d47'

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8edf5]">Compliance centre</h1>
          <p className="text-xs text-[#64748b] mt-0.5">Every driver, vehicle, owner and carrier document in one matrix</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-xs px-3 py-2 rounded border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8]">Reminder settings</button>
          <button className="text-xs px-3 py-2 rounded font-medium bg-blue-600 text-white hover:bg-blue-700">Download DQ files</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${tab === t.id ? 'bg-[#1e3a5f] text-blue-300 border border-blue-500/40' : 'border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Valid', count: 61, color: '#10b981', bg: '#10b98115' },
          { label: 'Expiring in 30 days', count: 4, color: '#f59e0b', bg: '#f59e0b15' },
          { label: 'Expired', count: 1, color: '#ef4444', bg: '#ef444415' },
          { label: 'Missing', count: 2, color: '#64748b', bg: '#1e2d47' },
        ].map((s) => (
          <div key={s.label} className="rounded border p-4" style={{ borderColor: `${s.color}30`, background: s.bg }}>
            <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.count}</div>
            <div className="text-xs mt-0.5" style={{ color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Driver matrix */}
      {tab === 'drivers' && (
        <div className="rounded border border-[#1e2d47] overflow-x-auto" style={{ background: 'var(--card)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47]">
                <th className="text-left px-4 py-3 text-[#475569] font-medium">DRIVER</th>
                {['CDL', 'MEDICAL CARD', 'MVR REVIEW', 'CLEARINGHOUSE', 'DRUG TEST', 'DISPATCH'].map((h) => (
                  <th key={h} className="px-4 py-3 text-[#475569] font-medium text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {DRIVERS.map((d) => (
                <tr key={d.name} className="hover:bg-[#111827] transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#e8edf5]">{d.name}</div>
                    <div className="text-[#475569] mt-0.5">{d.truck}</div>
                  </td>
                  {[d.cdl, d.med, d.mvr, d.clear, d.drug].map((doc, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-mono" style={{ background: chipBg(doc.s), color: chipColor(doc.s) }}>
                        {doc.v}
                      </span>
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold text-xs ${d.dispatch === 'Allowed' ? 'text-emerald-400' : 'text-red-400'}`}>{d.dispatch}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab !== 'drivers' && (
        <div className="rounded border border-[#1e2d47] p-8 text-center text-[#475569] text-sm" style={{ background: 'var(--card)' }}>
          {TABS.find(t => t.id === tab)?.label} compliance matrix · Select a row to view document detail
        </div>
      )}
    </div>
  )
}

/* ── Dispatchers ── */
function DispatchersScreen() {
  const [dispatchers, setDispatchers] = useState<DispatcherRecord[]>(INITIAL_DISPATCHERS)
  const [selected, setSelected] = useState<DispatcherRecord | null>(null)
  const [editing, setEditing] = useState<DispatcherRecord | null>(null)
  const [showOnboard, setShowOnboard] = useState(false)
  function saveDispatcher(dispatcher: DispatcherRecord) {
    setDispatchers(current => current.some(item => item.id === dispatcher.id)
      ? current.map(item => item.id === dispatcher.id ? dispatcher : item)
      : [dispatcher, ...current])
    setSelected(dispatcher)
    setEditing(null)
    setShowOnboard(false)
  }
  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between"><div><h1 className="text-xl font-semibold text-[#e8edf5]">Dispatchers</h1><p className="text-xs text-[#64748b] mt-0.5">Load responsibility, onboarding, identity verification, payments and performance</p></div><button onClick={() => setShowOnboard(true)} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>+ Onboard dispatcher</button></div>
      <div className="grid grid-cols-4 gap-3">
        {[['Active dispatchers', dispatchers.filter(item => item.status === 'Active').length], ['Active loads', dispatchers.reduce((sum, item) => sum + item.activeLoads, 0)], ['Completed YTD', dispatchers.reduce((sum, item) => sum + item.completedLoads, 0)], ['Avg on-time', `${Math.round(dispatchers.filter(item => item.onTimePercent).reduce((sum, item) => sum + item.onTimePercent, 0) / Math.max(dispatchers.filter(item => item.onTimePercent).length, 1))}%`]].map(([label, value]) => <div key={String(label)} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}><div className="text-xs text-[#64748b]">{label}</div><div className="text-2xl font-mono font-bold text-[#e8edf5] mt-1">{value}</div></div>)}
      </div>
      <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-xs"><thead><tr className="border-b border-[#1e2d47]">{['DISPATCHER', 'STATUS', 'REGION', 'PAY TERMS', 'ACTIVE LOADS', 'ON-TIME', 'WTD', 'MTD', 'YTD', ''].map(header => <th key={header} className="text-left px-4 py-3 text-[#475569] font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-[#1e2d47]">{dispatchers.map(dispatcher => <tr key={dispatcher.id} onClick={() => setSelected(dispatcher)} className="hover:bg-[#111827] cursor-pointer"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-300 flex items-center justify-center font-bold">{dispatcher.initials}</span><span><span className="block text-sm font-medium text-[#e8edf5]">{dispatcher.name}</span><span className="block text-[#475569]">{dispatcher.id} · {dispatcher.email}</span></span></div></td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded ${dispatcher.status === 'Active' ? 'bg-emerald-500/15 text-emerald-400' : dispatcher.status === 'Onboarding' ? 'bg-amber-500/15 text-amber-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{dispatcher.status}</span></td><td className="px-4 py-3 text-[#64748b]">{dispatcher.region}</td><td className="px-4 py-3 font-mono text-emerald-400">{dispatcher.grossLoadPercentage}% of gross</td><td className="px-4 py-3 font-mono text-[#94a3b8]">{dispatcher.activeLoads}</td><td className="px-4 py-3 font-mono text-[#94a3b8]">{dispatcher.onTimePercent || '—'}{dispatcher.onTimePercent ? '%' : ''}</td><td className="px-4 py-3 font-mono text-[#e8edf5]">${dispatcher.weekToDate.toLocaleString()}</td><td className="px-4 py-3 font-mono text-[#e8edf5]">${dispatcher.monthToDate.toLocaleString()}</td><td className="px-4 py-3 font-mono text-[#e8edf5]">${dispatcher.yearToDate.toLocaleString()}</td><td className="px-4 py-3"><button onClick={event => { event.stopPropagation(); setSelected(dispatcher) }} className="px-3 py-1.5 rounded border border-[#1e2d47] text-blue-400">Details</button></td></tr>)}</tbody></table>
      </div>
      {selected && <DispatcherDetails dispatcher={selected} onClose={() => setSelected(null)} onEdit={() => setEditing(selected)} />}
      {(showOnboard || editing) && <DispatcherForm dispatcher={editing || undefined} onClose={() => { setShowOnboard(false); setEditing(null) }} onSave={saveDispatcher} />}
    </div>
  )
}

interface DispatcherSettlement {
  id: string
  period: string
  paidDate: string
  grossLoads: number
  rate: number
  adjustments: number
  netPay: number
  loadCount: number
}

function DispatcherDetails({ dispatcher, onClose, onEdit }: { dispatcher: DispatcherRecord; onClose: () => void; onEdit: () => void }) {
  const [selectedSettlement, setSelectedSettlement] = useState<DispatcherSettlement | null>(null)
  const baseGross = dispatcher.grossLoadPercentage ? dispatcher.lastSettlement / (dispatcher.grossLoadPercentage / 100) : 0
  const settlementHistory: DispatcherSettlement[] = dispatcher.yearToDate > 0 ? [
    { id: `DSP-STL-0928-${dispatcher.id.slice(-3)}`, period: 'Sep 22 – Sep 28, 2026', paidDate: 'Oct 1, 2026', grossLoads: baseGross, rate: dispatcher.grossLoadPercentage, adjustments: 0, netPay: dispatcher.lastSettlement, loadCount: Math.max(1, Math.round(dispatcher.activeLoads / 2)) },
    { id: `DSP-STL-0921-${dispatcher.id.slice(-3)}`, period: 'Sep 15 – Sep 21, 2026', paidDate: 'Sep 24, 2026', grossLoads: baseGross * 0.94, rate: dispatcher.grossLoadPercentage, adjustments: 25, netPay: baseGross * 0.94 * dispatcher.grossLoadPercentage / 100 - 25, loadCount: Math.max(1, Math.round(dispatcher.activeLoads / 2) - 1) },
    { id: `DSP-STL-0914-${dispatcher.id.slice(-3)}`, period: 'Sep 8 – Sep 14, 2026', paidDate: 'Sep 17, 2026', grossLoads: baseGross * 0.88, rate: dispatcher.grossLoadPercentage, adjustments: 0, netPay: baseGross * 0.88 * dispatcher.grossLoadPercentage / 100, loadCount: Math.max(1, Math.round(dispatcher.activeLoads / 2) - 2) },
  ] : []

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full lg:w-[860px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e2d47]"><button onClick={onClose} className="text-[#64748b]" aria-label="Close dispatcher details">×</button><span className="w-10 h-10 rounded-full bg-purple-500/15 text-purple-300 flex items-center justify-center font-bold">{dispatcher.initials}</span><div className="flex-1"><div className="text-lg font-semibold text-[#e8edf5]">{dispatcher.name}</div><div className="text-xs text-[#64748b]">{dispatcher.id} · {dispatcher.region} · {dispatcher.status}</div></div><button onClick={onEdit} className="px-3 py-2 rounded border border-[#1e2d47] text-xs text-[#94a3b8]">Edit dispatcher</button></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-4 gap-3">{[['Week to date', dispatcher.weekToDate], ['Last pay settlement', dispatcher.lastSettlement], ['Month to date', dispatcher.monthToDate], ['Year to date', dispatcher.yearToDate]].map(([label, value]) => <div key={String(label)} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}><div className="text-xs text-[#64748b]">{label}</div><div className="text-xl font-mono font-bold text-[#e8edf5] mt-1">${Number(value).toLocaleString()}</div></div>)}</div>
          <div className="flex items-center justify-between gap-4 rounded border border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Gross-load commission</div><div className="mt-1 text-lg font-mono font-bold text-[#e8edf5]">{dispatcher.grossLoadPercentage}% of gross load dispatched</div><div className="mt-0.5 text-[10px] text-[#64748b]">Applied to each load assigned and dispatched by this dispatcher.</div></div>
            <button onClick={onEdit} className="shrink-0 rounded border border-emerald-500/30 bg-[#0d1424] px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10">Edit pay rate</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}><div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Profile + responsibility</div>{[['Email', dispatcher.email], ['Phone', dispatcher.phone], ['Region', dispatcher.region], ['Active loads', String(dispatcher.activeLoads)], ['Completed loads', String(dispatcher.completedLoads)], ['On-time performance', `${dispatcher.onTimePercent || 0}%`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 border-b border-[#1e2d47] text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] text-right">{value}</span></div>)}</div>
            <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}><div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Identity + payment verification</div>{[['SSN', dispatcher.ssnLast4 === 'Pending' ? 'Pending' : `•••-••-${dispatcher.ssnLast4}`], ['Government ID', dispatcher.idStatus], ['Deposit account', dispatcher.bankStatus], ['Tax profile', dispatcher.status === 'Active' ? 'Complete' : 'Pending'], ['Access status', dispatcher.status]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 border-b border-[#1e2d47] text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] text-right">{value}</span></div>)}<div className="mt-3 text-[10px] text-[#475569]">Full SSN and bank numbers are never displayed after secure submission.</div></div>
          </div>
          <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
            <div className="px-5 py-4 border-b border-[#1e2d47]"><div className="text-base font-semibold text-[#e8edf5]">Pay settlement history</div><div className="text-xs text-[#64748b] mt-0.5">Select a payment to view its PDF settlement statement.</div></div>
            {settlementHistory.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#1e2d47]">{['SETTLEMENT', 'PAY PERIOD', 'GROSS DISPATCHED', 'RATE', 'NET PAY', 'STATUS', 'PDF'].map(header => <th key={header} className="px-4 py-3 text-left font-medium text-[#475569]">{header}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#1e2d47]">
                    {settlementHistory.map(settlement => (
                      <tr key={settlement.id} onClick={() => setSelectedSettlement(settlement)} className="cursor-pointer hover:bg-[#111827]">
                        <td className="px-4 py-3 font-mono text-blue-400">{settlement.id}</td>
                        <td className="px-4 py-3"><div className="text-[#94a3b8]">{settlement.period}</div><div className="text-[10px] text-[#475569]">Paid {settlement.paidDate}</div></td>
                        <td className="px-4 py-3 font-mono text-[#94a3b8]">${settlement.grossLoads.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3 font-mono text-[#94a3b8]">{settlement.rate}%</td>
                        <td className="px-4 py-3 font-mono font-semibold text-[#e8edf5]">${settlement.netPay.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-3"><span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-400">Paid</span></td>
                        <td className="px-4 py-3 text-blue-400">Open PDF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="px-5 py-8 text-center text-xs text-[#475569]">No pay settlements have been issued yet.</div>}
          </div>
        </div>
      </div>

      {selectedSettlement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedSettlement(null)} />
          <div className="relative z-10 w-full max-w-2xl max-h-full overflow-y-auto rounded shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1e2d47]">
              <div><div className="text-sm font-semibold text-[#e8edf5]">{selectedSettlement.id}.pdf</div><div className="text-xs text-[#64748b]">Dispatcher pay settlement · Read only</div></div>
              <div className="flex items-center gap-2"><button onClick={() => window.print()} className="px-3 py-1.5 rounded border border-[#1e2d47] text-xs text-[#94a3b8]">Print / Save PDF</button><button onClick={() => setSelectedSettlement(null)} className="text-[#64748b] hover:text-white" aria-label="Close settlement PDF">×</button></div>
            </div>
            <div className="bg-white text-slate-900 p-10 min-h-[650px]">
              <div className="flex items-start justify-between border-b border-slate-200 pb-6">
                <div><div className="text-2xl font-bold">iWay Dispatch</div><div className="text-sm text-slate-500 mt-1">Current Way Logistics</div></div>
                <div className="text-right"><div className="text-xs font-semibold tracking-wider text-slate-500">DISPATCHER PAY SETTLEMENT</div><div className="font-mono font-bold mt-1">{selectedSettlement.id}</div><div className="text-xs text-emerald-700 mt-1">PAID</div></div>
              </div>
              <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-200">
                <div><div className="text-xs font-semibold text-slate-500 uppercase">Payee</div><div className="font-semibold mt-1">{dispatcher.name}</div><div className="text-sm text-slate-500">{dispatcher.id} · Dispatcher</div></div>
                <div><div className="text-xs font-semibold text-slate-500 uppercase">Pay period</div><div className="font-semibold mt-1">{selectedSettlement.period}</div><div className="text-sm text-slate-500">Paid {selectedSettlement.paidDate}</div></div>
              </div>
              <div className="py-6">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Settlement calculation</div>
                <div className="border border-slate-200 rounded divide-y divide-slate-200">
                  <div className="flex justify-between px-4 py-3 text-sm"><span>Gross value of loads dispatched</span><span className="font-mono">${selectedSettlement.grossLoads.toFixed(2)}</span></div>
                  <div className="flex justify-between px-4 py-3 text-sm"><span>Dispatcher pay rate</span><span className="font-mono">{selectedSettlement.rate}% of gross</span></div>
                  <div className="flex justify-between px-4 py-3 text-sm"><span>Loads included</span><span className="font-mono">{selectedSettlement.loadCount}</span></div>
                </div>
              </div>
              <div className="ml-auto w-72 space-y-3 border-t border-slate-200 pt-5">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Gross commission</span><span className="font-mono">${(selectedSettlement.grossLoads * selectedSettlement.rate / 100).toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Adjustments</span><span className="font-mono text-red-700">−${selectedSettlement.adjustments.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-slate-300 pt-3"><span className="font-semibold">Net pay</span><span className="font-mono text-xl font-bold">${selectedSettlement.netPay.toFixed(2)}</span></div>
              </div>
              <div className="mt-16 pt-4 border-t border-slate-200 text-xs text-slate-400">This system-generated dispatcher settlement is retained in the iWay audit record.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DispatcherForm({ dispatcher, onClose, onSave }: { dispatcher?: DispatcherRecord; onClose: () => void; onSave: (dispatcher: DispatcherRecord) => void }) {
  const [form, setForm] = useState({ name: dispatcher?.name || '', email: dispatcher?.email || '', phone: dispatcher?.phone || '', region: dispatcher?.region || '', grossLoadPercentage: String(dispatcher?.grossLoadPercentage || 5), ssn: '', idUploaded: dispatcher?.idStatus === 'Verified', accountHolder: dispatcher?.name || '', bankName: '', routing: '', account: '' })
  const [error, setError] = useState('')
  function submit() {
    if (!form.name || !form.email || !form.phone || !form.region) { setError('Complete the dispatcher profile fields'); return }
    const grossLoadPercentage = Number(form.grossLoadPercentage)
    if (!Number.isFinite(grossLoadPercentage) || grossLoadPercentage <= 0 || grossLoadPercentage > 100) { setError('Enter a payment percentage between 0 and 100'); return }
    if (!dispatcher && !/^\d{9}$/.test(form.ssn)) { setError('A valid 9-digit SSN is required for secure onboarding'); return }
    if (!form.idUploaded) { setError('Government ID upload is required'); return }
    if (!dispatcher && (!form.accountHolder || !form.bankName || !/^\d{9}$/.test(form.routing) || form.account.length < 4)) { setError('Complete the direct-deposit account information'); return }
    onSave({
      id: dispatcher?.id || `DSP-${String(Date.now()).slice(-4)}`, name: form.name, initials: form.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(), email: form.email, phone: form.phone,
      status: dispatcher?.status || 'Onboarding', region: form.region, ssnLast4: dispatcher?.ssnLast4 || form.ssn.slice(-4), idStatus: 'Verified', bankStatus: dispatcher?.bankStatus || `Verified · ending ${form.account.slice(-4)}`, grossLoadPercentage,
      weekToDate: dispatcher?.weekToDate || 0, lastSettlement: dispatcher?.lastSettlement || 0, monthToDate: dispatcher?.monthToDate || 0, yearToDate: dispatcher?.yearToDate || 0, activeLoads: dispatcher?.activeLoads || 0, completedLoads: dispatcher?.completedLoads || 0, onTimePercent: dispatcher?.onTimePercent || 0,
    })
  }
  const inputClass = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40'
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} /><div className="relative z-10 w-full sm:w-[620px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d47]"><div><div className="text-base font-semibold text-[#e8edf5]">{dispatcher ? 'Update dispatcher' : 'Onboard dispatcher'}</div><div className="text-xs text-[#64748b] mt-0.5">Profile, identity and payment verification</div></div><button onClick={onClose} className="text-[#64748b]" aria-label="Close dispatcher form">×</button></div>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="rounded border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs text-blue-300">Sensitive SSN and banking values should be encrypted and tokenized by the backend. Only the final four digits remain visible after submission.</div>
        <div><div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">Profile</div><div className="grid grid-cols-2 gap-3"><label className="col-span-2"><span className="block text-xs text-[#64748b] mb-1.5">Full legal name *</span><input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className={inputClass} /></label><label><span className="block text-xs text-[#64748b] mb-1.5">Email *</span><input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className={inputClass} /></label><label><span className="block text-xs text-[#64748b] mb-1.5">Phone *</span><input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className={inputClass} /></label><label className="col-span-2"><span className="block text-xs text-[#64748b] mb-1.5">Dispatch region *</span><input value={form.region} onChange={event => setForm(current => ({ ...current, region: event.target.value }))} placeholder="e.g. Texas + South Central" className={inputClass} /></label></div></div>
        <div><div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">Payment terms</div><label><span className="block text-xs text-[#64748b] mb-1.5">Dispatcher share of gross load dispatched *</span><div className="relative"><input type="number" min="0.01" max="100" step="0.01" value={form.grossLoadPercentage} onChange={event => setForm(current => ({ ...current, grossLoadPercentage: event.target.value }))} className={`${inputClass} pr-10 font-mono`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">%</span></div><span className="block text-[10px] text-[#475569] mt-1.5">Applied to the gross amount of each load dispatched.</span></label></div>
        {!dispatcher && <><div><div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">Identity verification</div><label><span className="block text-xs text-[#64748b] mb-1.5">Social Security number *</span><input type="password" inputMode="numeric" maxLength={9} value={form.ssn} onChange={event => setForm(current => ({ ...current, ssn: event.target.value.replace(/\D/g, '') }))} placeholder="•••-••-••••" className={`${inputClass} font-mono`} /></label><button onClick={() => setForm(current => ({ ...current, idUploaded: true }))} className={`w-full mt-3 py-3 rounded border text-xs font-semibold ${form.idUploaded ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-[#1e2d47] text-[#64748b]'}`}>{form.idUploaded ? 'Government ID uploaded' : 'Upload government ID card *'}</button></div>
        <div><div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">Direct-deposit account</div><div className="grid grid-cols-2 gap-3"><label className="col-span-2"><span className="block text-xs text-[#64748b] mb-1.5">Account holder *</span><input value={form.accountHolder} onChange={event => setForm(current => ({ ...current, accountHolder: event.target.value }))} className={inputClass} /></label><label><span className="block text-xs text-[#64748b] mb-1.5">Bank name *</span><input value={form.bankName} onChange={event => setForm(current => ({ ...current, bankName: event.target.value }))} className={inputClass} /></label><label><span className="block text-xs text-[#64748b] mb-1.5">Routing number *</span><input type="password" inputMode="numeric" maxLength={9} value={form.routing} onChange={event => setForm(current => ({ ...current, routing: event.target.value.replace(/\D/g, '') }))} className={`${inputClass} font-mono`} /></label><label className="col-span-2"><span className="block text-xs text-[#64748b] mb-1.5">Account number *</span><input type="password" inputMode="numeric" value={form.account} onChange={event => setForm(current => ({ ...current, account: event.target.value.replace(/\D/g, '') }))} className={`${inputClass} font-mono`} /></label></div></div></>}
        {dispatcher && <button onClick={() => setForm(current => ({ ...current, idUploaded: true }))} className="w-full py-3 rounded border border-[#1e2d47] text-xs text-blue-400">Replace government ID or banking information</button>}
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
      <div className="flex justify-between px-6 py-4 border-t border-[#1e2d47]" style={{ background: 'var(--card)' }}><button onClick={onClose} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b]">Cancel</button><button onClick={submit} className="px-5 py-2.5 rounded bg-emerald-600 text-white text-sm font-semibold">{dispatcher ? 'Save updates' : 'Submit onboarding'}</button></div>
    </div></div>
  )
}

/* ── Drivers ── */
function FleetResourcesScreen({ onOnboard }: { onOnboard: () => void }) {
  const [tab, setTab] = useState<'drivers' | 'assets'>('drivers')
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#e8edf5]">Asset</h1>
        <p className="text-xs text-[#64748b] mt-0.5">Manage drivers, trucks, trailers, assignments, compliance and operating status in one place</p>
      </div>
      <div className="flex items-center gap-1 border-b border-[#1e2d47]">
        {[
          { id: 'drivers' as const, label: 'Driver', detail: `${DRIVER_RECORDS.length} people` },
          { id: 'assets' as const, label: 'Assets', detail: `${INITIAL_VEHICLES.length} vehicles` },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`relative px-5 py-3 text-left transition-colors ${
              tab === item.id ? 'text-[#e8edf5]' : 'text-[#64748b] hover:text-[#94a3b8]'
            }`}
          >
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="block text-[10px] mt-0.5">{item.detail}</span>
            {tab === item.id && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-500" />}
          </button>
        ))}
      </div>
      {tab === 'drivers' ? <DriversScreen onOnboard={onOnboard} embedded /> : <AssetsScreen embedded />}
    </div>
  )
}

interface DriverRecord {
  id: string
  name: string
  initials: string
  phone: string
  email: string
  status: 'Available' | 'On load' | 'Off duty' | 'Onboarding' | 'Blocked'
  truck: string
  cdl: string
  cdlExpiry: string
  medicalExpiry: string
  employment: string
  pay: string
  insuranceDeduction: string
  escrowDeduction: string
  fuelCardDeduction: string
  escrowTarget: number
  escrowCollected: number
  payUpdatedAt: string
  compliance: string
}

const DRIVER_RECORDS: DriverRecord[] = [
  { id: 'D-001', name: 'James Carter', initials: 'JC', phone: '(214) 555-0142', email: 'j.carter@example.com', status: 'On load', truck: 'T-104', cdl: 'TX-CDL-7841922 · Class A', cdlExpiry: 'Jun 2029', medicalExpiry: 'Mar 2027', employment: 'Company driver', pay: '28% of gross', insuranceDeduction: '$150 / week', escrowDeduction: '$100 / week', fuelCardDeduction: 'Actual charges', escrowTarget: 2500, escrowCollected: 1800, payUpdatedAt: 'Sep 18, 2026 · 10:42 AM', compliance: 'Eligible' },
  { id: 'D-002', name: 'Amara Bekele', initials: 'AB', phone: '(713) 555-0287', email: 'a.bekele@example.com', status: 'Off duty', truck: 'T-108', cdl: 'TX-CDL-6630841 · Class A', cdlExpiry: 'Aug 2028', medicalExpiry: 'Dec 2026', employment: 'Company driver', pay: '$0.62 / loaded mi', insuranceDeduction: '$150 / week', escrowDeduction: '$100 / week', fuelCardDeduction: 'Actual charges', escrowTarget: 2500, escrowCollected: 2250, payUpdatedAt: 'Sep 12, 2026 · 3:15 PM', compliance: 'Eligible' },
  { id: 'D-003', name: 'Rafael Diaz', initials: 'RD', phone: '(972) 555-0319', email: 'r.diaz@example.com', status: 'On load', truck: 'T-112', cdl: 'TX-CDL-9120455 · Class A', cdlExpiry: 'May 2029', medicalExpiry: 'Expired Sep 2', employment: 'Company driver', pay: '26% of gross', insuranceDeduction: '$150 / week', escrowDeduction: '$125 / week', fuelCardDeduction: 'Actual charges', escrowTarget: 3000, escrowCollected: 1375, payUpdatedAt: 'Aug 30, 2026 · 9:08 AM', compliance: 'Blocked' },
  { id: 'D-004', name: 'Mike Okafor', initials: 'MO', phone: '(469) 555-0458', email: 'm.okafor@example.com', status: 'Available', truck: 'T-101', cdl: 'TX-CDL-5540177 · Class A', cdlExpiry: 'Feb 2028', medicalExpiry: 'Dec 2027', employment: 'Owner-operator', pay: '82% of gross', insuranceDeduction: '$400 / month', escrowDeduction: '$150 / week', fuelCardDeduction: 'Actual charges', escrowTarget: 3500, escrowCollected: 3500, payUpdatedAt: 'Sep 2, 2026 · 1:30 PM', compliance: 'Eligible' },
  { id: 'D-005', name: 'Lena Morales', initials: 'LM', phone: '(210) 555-0061', email: 'l.morales@example.com', status: 'Onboarding', truck: '—', cdl: 'TX-CDL-2298033 · Class A', cdlExpiry: 'Oct 2029', medicalExpiry: 'Replacement required', employment: 'Company driver', pay: 'Pending', insuranceDeduction: 'Pending', escrowDeduction: 'Pending', fuelCardDeduction: 'Pending', escrowTarget: 2500, escrowCollected: 0, payUpdatedAt: 'Not configured', compliance: 'Onboarding' },
  { id: 'D-006', name: 'Kwame Asante', initials: 'KA', phone: '(832) 555-0794', email: 'kwame.asante@example.com', status: 'Onboarding', truck: '—', cdl: 'TX-CDL-8830022 · Class A', cdlExpiry: 'Jun 2029', medicalExpiry: 'Mar 2027', employment: 'Company driver', pay: '28% of gross', insuranceDeduction: '$150 / week', escrowDeduction: '$100 / week', fuelCardDeduction: 'Actual charges', escrowTarget: 2500, escrowCollected: 0, payUpdatedAt: 'Sep 29, 2026 · 4:05 PM', compliance: 'Safety checks' },
]

function escrowStorageKey(driverId: string) {
  return `iway_driver_escrow_${driverId}`
}

function storedEscrowBalance(driver: DriverRecord) {
  if (typeof window === 'undefined') return driver.escrowCollected
  const savedBalance = window.localStorage.getItem(escrowStorageKey(driver.id))
  if (savedBalance === null) return driver.escrowCollected
  const stored = Number(savedBalance)
  return Number.isFinite(stored) ? Math.min(driver.escrowTarget, stored) : driver.escrowCollected
}

function recordSettlementEscrow(payee: string, deductions: [string, number][]) {
  if (typeof window === 'undefined') return
  const escrowAmount = deductions
    .filter(([label]) => label.toLowerCase().includes('escrow'))
    .reduce((sum, [, amount]) => sum + amount, 0)
  if (!escrowAmount) return
  const driver = DRIVER_RECORDS.find(record => `${record.name.charAt(0)}. ${record.name.split(' ').at(-1)}` === payee)
  if (!driver) return
  const current = storedEscrowBalance(driver)
  window.localStorage.setItem(escrowStorageKey(driver.id), String(Math.min(driver.escrowTarget, current + escrowAmount)))
}

function DriversScreen({ onOnboard, embedded = false }: { onOnboard: () => void; embedded?: boolean }) {
  const [filter, setFilter] = useState('All')
  const [drivers, setDrivers] = useState<DriverRecord[]>(() => DRIVER_RECORDS.map(driver => ({ ...driver, escrowCollected: storedEscrowBalance(driver) })))
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null)
  const [editingDriver, setEditingDriver] = useState<{ driver: DriverRecord; section: 'profile' | 'pay' } | null>(null)
  const filtered = filter === 'All' ? drivers : drivers.filter(driver => driver.status === filter)
  function saveDriver(updatedDriver: DriverRecord) {
    setDrivers(current => current.map(driver => driver.id === updatedDriver.id ? updatedDriver : driver))
    setSelectedDriver(updatedDriver)
    setEditingDriver(null)
  }
  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div><div className={`${embedded ? 'text-base' : 'text-xl'} font-semibold text-[#e8edf5]`}>{embedded ? 'Driver directory' : 'Drivers'}</div><p className="text-xs text-[#64748b] mt-0.5">Driver status, assignments, compliance, documents and pay setup</p></div>
        <button onClick={onOnboard} className="px-4 py-2 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>+ Onboard driver</button>
      </div>
      <div className="flex gap-2">
        {['All', 'Available', 'On load', 'Off duty', 'Onboarding', 'Blocked'].map(status => (
          <button key={status} onClick={() => setFilter(status)} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === status ? 'bg-amber-500 text-white' : 'border border-[#1e2d47] text-[#64748b]'}`}>{status} · {status === 'All' ? drivers.length : drivers.filter(driver => driver.status === status).length}</button>
        ))}
      </div>
      <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-[#1e2d47]">{['DRIVER', 'STATUS', 'TRUCK', 'CDL', 'MEDICAL', 'COMPLIANCE', 'PAY', ''].map(header => <th key={header} className="text-left px-4 py-3 text-[#475569] font-medium">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#1e2d47]">
            {filtered.map(driver => (
              <tr key={driver.id} onClick={() => setSelectedDriver(driver)} className="hover:bg-[#111827] cursor-pointer">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center font-bold">{driver.initials}</span><span><span className="block text-sm font-medium text-[#e8edf5]">{driver.name}</span><span className="block text-[#475569]">{driver.id} · {driver.phone}</span></span></div></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded ${driver.status === 'Available' ? 'bg-emerald-500/15 text-emerald-400' : driver.status === 'Blocked' ? 'bg-red-500/10 text-red-400' : driver.status === 'Onboarding' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{driver.status}</span></td>
                <td className="px-4 py-3 font-mono text-[#94a3b8]">{driver.truck}</td><td className="px-4 py-3 text-[#64748b]">{driver.cdl.split(' · ')[0]}</td><td className={`px-4 py-3 ${driver.medicalExpiry.includes('Expired') || driver.medicalExpiry.includes('Replacement') ? 'text-red-400' : 'text-[#64748b]'}`}>{driver.medicalExpiry}</td><td className="px-4 py-3 text-[#64748b]">{driver.compliance}</td><td className="px-4 py-3 text-[#64748b]">{driver.pay}</td>
                <td className="px-4 py-3"><button onClick={event => { event.stopPropagation(); setSelectedDriver(driver) }} className="px-3 py-1.5 rounded border border-[#1e2d47] text-blue-400">Details</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedDriver && <DriverDetailsPanel driver={selectedDriver} onClose={() => setSelectedDriver(null)} onEditProfile={() => setEditingDriver({ driver: selectedDriver, section: 'profile' })} onEditPay={() => setEditingDriver({ driver: selectedDriver, section: 'pay' })} />}
      {editingDriver && <DriverEditPanel driver={editingDriver.driver} section={editingDriver.section} onClose={() => setEditingDriver(null)} onSave={saveDriver} />}
    </div>
  )
}

interface DriverPaySettlement {
  id: string
  period: string
  paidDate: string
  gross: number
  deductions: number
  net: number
  loads: string[]
  status: 'Paid'
}

function DriverDetailsPanel({ driver, onClose, onEditProfile, onEditPay }: { driver: DriverRecord; onClose: () => void; onEditProfile: () => void; onEditPay: () => void }) {
  const { driverDocuments } = useOperations()
  const [previewDocument, setPreviewDocument] = useState<(typeof driverDocuments)[number] | null>(null)
  const [selectedPaySettlement, setSelectedPaySettlement] = useState<DriverPaySettlement | null>(null)
  const normalizedDriverPhone = driver.phone.replace(/\D/g, '').slice(-10)
  const submittedDocuments = driverDocuments.filter(document =>
    document.driverName === driver.name || document.driverPhone.replace(/\D/g, '').slice(-10) === normalizedDriverPhone,
  )
  const documents = [
    ['CDL front + back', `Valid · ${driver.cdlExpiry}`, 'valid'],
    ['DOT medical card', driver.medicalExpiry, driver.medicalExpiry.includes('Expired') || driver.medicalExpiry.includes('Replacement') ? 'danger' : 'valid'],
    ['Motor vehicle record', 'Reviewed Sep 27 · 1 item', 'warning'],
    ['Clearinghouse query', driver.status === 'Onboarding' ? 'Consent pending' : 'Complete · Sep 2026', driver.status === 'Onboarding' ? 'warning' : 'valid'],
    ['Pre-employment drug test', 'Negative · Sep 29', 'valid'],
    ['Driver application', driver.status === 'Onboarding' ? 'In progress' : 'Signed', driver.status === 'Onboarding' ? 'warning' : 'valid'],
    ['W-4', driver.status === 'Onboarding' ? 'Missing' : 'On file', driver.status === 'Onboarding' ? 'missing' : 'valid'],
    ['Direct deposit', driver.status === 'Onboarding' ? 'Pending' : 'Verified', driver.status === 'Onboarding' ? 'missing' : 'valid'],
  ]
  const paySettlementHistory: DriverPaySettlement[] = driver.status === 'Onboarding' ? [] : [
    { id: `DRV-STL-0928-${driver.id.slice(-3)}`, period: 'Sep 22 – Sep 28, 2026', paidDate: 'Oct 1, 2026', gross: 1654.80, deductions: 599.60, net: 1055.20, loads: ['LD-10482', 'LD-10468', 'LD-10459'], status: 'Paid' },
    { id: `DRV-STL-0921-${driver.id.slice(-3)}`, period: 'Sep 15 – Sep 21, 2026', paidDate: 'Sep 24, 2026', gross: 1482.40, deductions: 512.50, net: 969.90, loads: ['LD-10441', 'LD-10436', 'LD-10429'], status: 'Paid' },
    { id: `DRV-STL-0914-${driver.id.slice(-3)}`, period: 'Sep 8 – Sep 14, 2026', paidDate: 'Sep 17, 2026', gross: 1736.20, deductions: 540, net: 1196.20, loads: ['LD-10417', 'LD-10412', 'LD-10409', 'LD-10402'], status: 'Paid' },
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full lg:w-[900px] flex flex-col shadow-2xl" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e2d47]"><button onClick={onClose} className="text-[#64748b]" aria-label="Close driver details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button><span className="w-10 h-10 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center font-bold">{driver.initials}</span><div className="flex-1"><div className="text-lg font-semibold text-[#e8edf5]">{driver.name}</div><div className="text-xs text-[#64748b]">{driver.id} · {driver.employment} · {driver.status}</div></div><button onClick={onEditProfile} className="px-3 py-2 rounded border border-[#1e2d47] text-xs text-[#94a3b8]">Edit driver</button></div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-5 gap-3">{[['Status', driver.status], ['Assigned truck', driver.truck], ['Compliance', driver.compliance], ['Pay model', driver.pay], ['Escrow collected', `$${driver.escrowCollected.toLocaleString()} / $${driver.escrowTarget.toLocaleString()}`]].map(([label, value]) => <div key={label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}><div className="text-xs text-[#475569]">{label}</div><div className="text-sm font-semibold text-[#e8edf5] mt-1">{value}</div></div>)}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}><div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Profile + employment</div><div className="divide-y divide-[#1e2d47]">{[['Phone', driver.phone], ['Email', driver.email], ['Home address', '1840 Westheimer Rd, Houston, TX'], ['Employment', driver.employment], ['Hire date', 'Sep 30, 2026'], ['Emergency contact', 'A. Asante · (832) 555-0102']].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] text-right">{value}</span></div>)}</div></div>
            <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}><div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">License + safety</div><div className="divide-y divide-[#1e2d47]">{[['CDL', driver.cdl], ['CDL expiration', driver.cdlExpiry], ['Endorsements', 'Tanker (N)'], ['Medical card', driver.medicalExpiry], ['MVR', '1 minor violation · reviewed'], ['Drug test', 'Negative · Sep 29'], ['Clearinghouse', driver.status === 'Onboarding' ? 'Consent pending' : 'Eligible']].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] text-right">{value}</span></div>)}</div></div>
          </div>
          <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2d47]"><div><div className="text-base font-semibold text-[#e8edf5]">Documents</div><div className="mt-0.5 text-[10px] text-[#475569]">Driver App submissions sync here automatically.</div></div><span className="text-xs text-[#64748b]">{submittedDocuments.length} submitted files</span></div>
            <div className="grid grid-cols-2 gap-x-5">{documents.map(([label, value, status]) => <div key={label} className="flex items-center justify-between gap-2 py-2 border-b border-[#1e2d47] text-[11px]"><span className="truncate text-[#94a3b8]">{label}</span><span className={`max-w-[58%] truncate px-2 py-0.5 rounded ${status === 'valid' ? 'bg-emerald-500/15 text-emerald-400' : status === 'danger' ? 'bg-red-500/10 text-red-400' : status === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{value}</span></div>)}</div>
            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Driver-submitted files</div>
              {submittedDocuments.length ? (
                <div className="max-h-56 divide-y divide-[#1e2d47] overflow-y-auto rounded border border-[#1e2d47]">
                  {submittedDocuments.map(document => (
                    <button key={document.id} onClick={() => setPreviewDocument(document)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[#111827]">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-500/10 text-[9px] font-bold text-blue-400">{document.fileType.toLowerCase().includes('image') ? 'IMG' : 'PDF'}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-[#e8edf5]">{document.name}</span><span className="mt-0.5 block truncate text-[10px] text-[#475569]">{document.fileName} · Uploaded {document.uploadedAt}</span></span>
                      <span className={`rounded px-2 py-0.5 text-[10px] ${document.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400' : document.status === 'Needs changes' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/15 text-blue-400'}`}>{document.status}</span>
                      <span className="text-xs text-blue-400">View</span>
                    </button>
                  ))}
                </div>
              ) : <div className="rounded border border-dashed border-[#1e2d47] px-4 py-6 text-center text-xs text-[#475569]">No documents have been submitted from the Driver App.</div>}
            </div>
          </div>
          <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
            <div className="flex items-start justify-between gap-4 mb-3"><div><div className="text-base font-semibold text-[#e8edf5]">Pay + deductions</div><div className="text-[10px] text-[#475569] mt-0.5">Last edited {driver.payUpdatedAt}</div></div><button onClick={onEditPay} className="px-3 py-1.5 rounded border border-[#1e2d47] text-xs text-blue-400">Edit pay + deductions</button></div>
            <div className="grid grid-cols-4 gap-3">{[['Pay rate', driver.pay], ['Insurance', driver.insuranceDeduction], ['Escrow', driver.escrowDeduction], ['Fuel card', driver.fuelCardDeduction]].map(([label, value]) => <div key={label} className="rounded bg-[#0d1424] p-3"><div className="text-xs text-[#475569]">{label}</div><div className="text-sm font-semibold text-[#e8edf5] mt-1">{value}</div></div>)}</div>
            <div className="mt-4 rounded bg-[#0d1424] p-4">
              <div className="flex items-center justify-between text-xs"><span className="text-[#64748b]">Escrow collection progress</span><span className="font-mono font-semibold text-[#e8edf5]">${driver.escrowCollected.toLocaleString()} collected of ${driver.escrowTarget.toLocaleString()}</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1e2d47]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, driver.escrowTarget ? driver.escrowCollected / driver.escrowTarget * 100 : 0)}%` }} /></div>
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#475569]"><span>Automatically updated from approved pay settlements</span><span>${Math.max(0, driver.escrowTarget - driver.escrowCollected).toLocaleString()} remaining</span></div>
            </div>
          </div>
          <div className="overflow-hidden rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
            <div className="border-b border-[#1e2d47] px-5 py-4"><div className="text-base font-semibold text-[#e8edf5]">Pay settlement history</div><div className="mt-0.5 text-xs text-[#64748b]">Select a payment to view its PDF settlement statement.</div></div>
            {paySettlementHistory.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-[#1e2d47]">{['SETTLEMENT', 'PAY PERIOD', 'LOADS', 'GROSS', 'DEDUCTIONS', 'NET PAY', 'STATUS', 'PDF'].map(header => <th key={header} className="px-4 py-3 text-left font-medium text-[#475569]">{header}</th>)}</tr></thead>
                  <tbody className="divide-y divide-[#1e2d47]">
                    {paySettlementHistory.map(settlement => (
                      <tr key={settlement.id} onClick={() => setSelectedPaySettlement(settlement)} className="cursor-pointer hover:bg-[#111827]">
                        <td className="px-4 py-3 font-mono text-blue-400">{settlement.id}</td>
                        <td className="px-4 py-3"><div className="text-[#94a3b8]">{settlement.period}</div><div className="text-[10px] text-[#475569]">Paid {settlement.paidDate}</div></td>
                        <td className="px-4 py-3 font-mono text-[#94a3b8]">{settlement.loads.length}</td>
                        <td className="px-4 py-3 font-mono text-[#94a3b8]">${settlement.gross.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono text-red-400">−${settlement.deductions.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-[#e8edf5]">${settlement.net.toFixed(2)}</td>
                        <td className="px-4 py-3"><span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-400">{settlement.status}</span></td>
                        <td className="px-4 py-3 text-blue-400">Open PDF</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="px-5 py-8 text-center text-xs text-[#475569]">No pay settlements have been issued yet.</div>}
          </div>
        </div>
      </div>
      {previewDocument && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPreviewDocument(null)} />
          <div className="relative z-10 flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2d47] bg-[#111827] px-4 py-3"><div><div className="text-sm font-semibold text-[#e8edf5]">{previewDocument.fileName}</div><div className="text-xs text-[#64748b]">Submitted from Driver App · {previewDocument.uploadedAt}</div></div><button onClick={() => setPreviewDocument(null)} className="text-[#64748b]" aria-label="Close driver document">×</button></div>
            <div className="overflow-y-auto bg-[#070c18] p-5">
              <div className="min-h-[580px] bg-white p-8 text-slate-900">
                <div className="flex items-start justify-between border-b border-slate-200 pb-5"><div><div className="text-xl font-bold">iWay Dispatch</div><div className="text-xs text-slate-500">Driver-submitted document</div></div><div className="text-right"><div className="text-xs font-bold uppercase">{previewDocument.name}</div><div className="mt-1 text-xs text-slate-500">{previewDocument.status}</div></div></div>
                <div className="grid grid-cols-2 gap-6 border-b border-slate-200 py-6 text-sm"><div><div className="text-xs font-semibold uppercase text-slate-500">Submitted by</div><div className="mt-1 font-semibold">{previewDocument.driverName}</div><div className="text-slate-500">{previewDocument.driverPhone}</div></div><div><div className="text-xs font-semibold uppercase text-slate-500">Document details</div><div className="mt-1">Number: {previewDocument.documentNumber || 'Not provided'}</div><div className="text-slate-500">Expires: {previewDocument.expirationDate || 'Not provided'}</div></div></div>
                <div className="mt-8 flex min-h-72 items-center justify-center rounded border-2 border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-400"><div><div className="font-semibold text-slate-500">{previewDocument.fileType} preview</div><div className="mt-1">{previewDocument.fileName}</div></div></div>
              </div>
            </div>
            <div className="border-t border-[#1e2d47] bg-[#111827] px-4 py-3"><button onClick={() => window.print()} className="w-full rounded border border-blue-500/30 py-2.5 text-sm text-blue-400">Print or save document</button></div>
          </div>
        </div>
      )}
      {selectedPaySettlement && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setSelectedPaySettlement(null)} />
          <div className="relative z-10 w-full max-w-2xl max-h-full overflow-y-auto rounded shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1e2d47]">
              <div><div className="text-sm font-semibold text-[#e8edf5]">{selectedPaySettlement.id}.pdf</div><div className="text-xs text-[#64748b]">Driver pay settlement · Read only</div></div>
              <div className="flex items-center gap-2"><button onClick={() => window.print()} className="px-3 py-1.5 rounded border border-[#1e2d47] text-xs text-[#94a3b8]">Print / Save PDF</button><button onClick={() => setSelectedPaySettlement(null)} className="text-[#64748b]" aria-label="Close driver settlement PDF">×</button></div>
            </div>
            <div className="bg-white text-slate-900 p-10 min-h-[650px]">
              <div className="flex items-start justify-between border-b border-slate-200 pb-6">
                <div><div className="text-2xl font-bold">iWay Dispatch</div><div className="text-sm text-slate-500 mt-1">Current Way Logistics</div></div>
                <div className="text-right"><div className="text-xs font-semibold tracking-wider text-slate-500">DRIVER PAY SETTLEMENT</div><div className="font-mono font-bold mt-1">{selectedPaySettlement.id}</div><div className="text-xs text-emerald-700 mt-1">PAID</div></div>
              </div>
              <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-200">
                <div><div className="text-xs font-semibold text-slate-500 uppercase">Payee</div><div className="font-semibold mt-1">{driver.name}</div><div className="text-sm text-slate-500">{driver.id} · {driver.employment}</div></div>
                <div><div className="text-xs font-semibold text-slate-500 uppercase">Pay period</div><div className="font-semibold mt-1">{selectedPaySettlement.period}</div><div className="text-sm text-slate-500">Paid {selectedPaySettlement.paidDate}</div></div>
              </div>
              <div className="py-6">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Included loads</div>
                <div className="border border-slate-200 rounded divide-y divide-slate-200">{selectedPaySettlement.loads.map(loadId => <div key={loadId} className="flex items-center justify-between px-4 py-3"><span className="font-mono text-sm">{loadId}</span><span className="text-sm text-slate-500">Completed</span></div>)}</div>
              </div>
              <div className="ml-auto w-72 space-y-3 border-t border-slate-200 pt-5">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Gross pay</span><span className="font-mono">${selectedPaySettlement.gross.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Deductions</span><span className="font-mono text-red-700">−${selectedPaySettlement.deductions.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-slate-300 pt-3"><span className="font-semibold">Net pay</span><span className="font-mono text-xl font-bold">${selectedPaySettlement.net.toFixed(2)}</span></div>
              </div>
              <div className="mt-16 pt-4 border-t border-slate-200 text-xs text-slate-400">This system-generated driver settlement is retained in the iWay audit record.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DriverEditPanel({ driver, section, onClose, onSave }: { driver: DriverRecord; section: 'profile' | 'pay'; onClose: () => void; onSave: (driver: DriverRecord) => void }) {
  const [form, setForm] = useState<DriverRecord>({ ...driver })
  const [error, setError] = useState('')
  const inputClass = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40'
  const set = <K extends keyof DriverRecord>(field: K, value: DriverRecord[K]) => setForm(current => ({ ...current, [field]: value }))

  function submit() {
    if (section === 'profile' && (!form.name.trim() || !form.email.trim() || !form.phone.trim())) {
      setError('Name, email, and phone are required')
      return
    }
    if (section === 'pay' && !form.pay.trim()) {
      setError('Enter the driver pay model')
      return
    }
    if (section === 'pay' && (!form.insuranceDeduction.trim() || !form.escrowDeduction.trim() || !form.fuelCardDeduction.trim())) {
      setError('Complete all pay deduction fields')
      return
    }
    if (section === 'pay' && form.escrowTarget < 0) {
      setError('The total escrow target cannot be negative')
      return
    }
    const payChanged = form.pay !== driver.pay
      || form.insuranceDeduction !== driver.insuranceDeduction
      || form.escrowDeduction !== driver.escrowDeduction
      || form.fuelCardDeduction !== driver.fuelCardDeduction
      || form.escrowTarget !== driver.escrowTarget
    onSave({
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      initials: form.name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase(),
      payUpdatedAt: payChanged ? new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : driver.payUpdatedAt,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full flex-col shadow-2xl sm:w-[640px]" style={{ background: 'var(--background)', borderLeft: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between border-b border-[#1e2d47] px-6 py-4">
          <div><div className="text-base font-semibold text-[#e8edf5]">{section === 'profile' ? 'Edit profile + employment' : 'Edit pay + deductions'}</div><div className="mt-0.5 text-xs text-[#64748b]">{driver.id} · {driver.name}</div></div>
          <button onClick={onClose} className="text-[#64748b]" aria-label="Close driver editor">×</button>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {section === 'profile' ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Profile + employment</div>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2"><span className="mb-1.5 block text-xs text-[#64748b]">Full name *</span><input value={form.name} onChange={event => set('name', event.target.value)} className={inputClass} /></label>
                <label><span className="mb-1.5 block text-xs text-[#64748b]">Email *</span><input type="email" value={form.email} onChange={event => set('email', event.target.value)} className={inputClass} /></label>
                <label><span className="mb-1.5 block text-xs text-[#64748b]">Phone *</span><input value={form.phone} onChange={event => set('phone', event.target.value)} className={inputClass} /></label>
                <label><span className="mb-1.5 block text-xs text-[#64748b]">Employment type</span><select value={form.employment} onChange={event => set('employment', event.target.value)} className={inputClass}><option>Company driver</option><option>Owner-operator</option><option>Contract driver</option></select></label>
                <label><span className="mb-1.5 block text-xs text-[#64748b]">Driver status</span><select value={form.status} onChange={event => set('status', event.target.value as DriverRecord['status'])} className={inputClass}>{['Available', 'On load', 'Off duty', 'Onboarding', 'Blocked'].map(status => <option key={status}>{status}</option>)}</select></label>
              </div>
            </div>
          ) : (
          <>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Pay model</div>
              <label><span className="mb-1.5 block text-xs text-[#64748b]">Driver pay rate *</span><input value={form.pay} onChange={event => set('pay', event.target.value)} placeholder="e.g. 28% of gross" className={inputClass} /></label>
            </div>
            <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">Pay deductions + escrow</div>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="mb-1.5 block text-xs text-[#64748b]">Insurance deduction *</span><input value={form.insuranceDeduction} onChange={event => set('insuranceDeduction', event.target.value)} placeholder="$150 / week" className={inputClass} /></label>
              <label><span className="mb-1.5 block text-xs text-[#64748b]">Escrow deduction *</span><input value={form.escrowDeduction} onChange={event => set('escrowDeduction', event.target.value)} placeholder="$100 / week" className={inputClass} /></label>
              <label className="col-span-2"><span className="mb-1.5 block text-xs text-[#64748b]">Fuel-card deduction *</span><input value={form.fuelCardDeduction} onChange={event => set('fuelCardDeduction', event.target.value)} placeholder="Actual charges" className={inputClass} /></label>
              <label><span className="mb-1.5 block text-xs text-[#64748b]">Total escrow to collect</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">$</span><input type="number" min="0" step="0.01" value={form.escrowTarget} onChange={event => set('escrowTarget', Number(event.target.value))} className={`${inputClass} pl-7 font-mono`} /></div></label>
              <div><span className="mb-1.5 block text-xs text-[#64748b]">Escrow collected so far</span><div className="rounded border border-[#1e2d47] bg-[#111827] px-3 py-2.5"><div className="font-mono text-sm text-[#e8edf5]">${form.escrowCollected.toLocaleString()}</div><div className="mt-0.5 text-[10px] text-emerald-400">Read only · posted from pay settlements</div></div></div>
            </div>
            <div className="mt-2 text-[10px] text-[#475569]">The collected balance advances only when an escrow deduction is recorded in an approved pay settlement. It cannot be edited from the driver profile.</div>
            </div>
          </>
          )}
          {error && <div className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-400">{error}</div>}
        </div>
        <div className="flex justify-between border-t border-[#1e2d47] px-6 py-4" style={{ background: 'var(--card)' }}>
          <button onClick={onClose} className="rounded border border-[#1e2d47] px-4 py-2.5 text-sm text-[#64748b]">Cancel</button>
          <button onClick={submit} className="rounded bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">{section === 'profile' ? 'Save profile updates' : 'Save pay updates'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Assets ── */

type VehicleRow = FleetVehicle

const INITIAL_VEHICLES: VehicleRow[] = [
  { unit: 'T-104', vin: '3AKJ...1562', type: 'Tractor · sleeper', plate: 'TX · R4K-2291', owner: 'Crossway Trucking LLC', driver: 'J. Carter', status: 'In use', load: 'LD-10482', rpm: '$2.61', miles: '8,940' },
  { unit: 'T-108', vin: '1FUJG...8901', type: 'Tractor · day cab', plate: 'TX · M8P-5512', owner: 'Current Way Logistics', driver: 'A. Bekele', status: 'In use', load: 'LD-10477', rpm: '$2.34', miles: '12,200' },
  { unit: 'T-112', vin: '3HSDJ...2234', type: 'Tractor · sleeper', plate: 'TX · C3R-9901', owner: 'Delta Haul LLC', driver: 'R. Diaz', status: 'In use', load: 'LD-10479', rpm: '$2.15', miles: '5,100' },
  { unit: 'T-101', vin: '4V4NC...5043', type: 'Tractor · sleeper', plate: 'TX · A9L-3312', owner: 'Mike Okafor', driver: 'M. Okafor', status: 'In use', load: 'LD-10471', rpm: '$2.88', miles: '3,450' },
  { unit: 'T-115', vin: '1XKYD...7721', type: 'Tractor · day cab', plate: 'TX · W2T-6677', owner: 'Current Way Logistics', driver: 'S. Nwosu', status: 'Available', load: '—', rpm: '—', miles: '18,320' },
  { unit: 'TR-221', vin: '—', type: "Trailer · 53' dry van", plate: 'TX · TR-221', owner: 'Current Way Logistics', driver: '—', status: 'In use', load: 'LD-10482', rpm: '—', miles: '—' },
]

function AssetsScreen({ embedded = false }: { embedded?: boolean }) {
  const { vehicles, addVehicle, updateVehicle } = useOperations()
  const [showAdd, setShowAdd] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null)

  function handleAdded(v: VehicleRow) {
    addVehicle(v)
    setShowAdd(false)
  }

  function handleUpdated(updated: VehicleRow) {
    if (editingVehicle) updateVehicle(editingVehicle.unit, updated)
    setEditingVehicle(null)
  }

  const nextTractorNum = () => {
    const nums = vehicles.filter(v => v.unit.startsWith('T-') && !v.unit.startsWith('TR-')).map(v => parseInt(v.unit.split('-')[1])).filter(Boolean)
    return `T-${Math.max(...nums, 115) + 1}`
  }
  const nextTrailerNum = () => {
    const nums = vehicles.filter(v => v.unit.startsWith('TR-')).map(v => parseInt(v.unit.split('-')[1])).filter(Boolean)
    return `TR-${Math.max(...nums, 221) + 1}`
  }

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <div className={`${embedded ? 'text-base' : 'text-xl'} font-semibold text-[#e8edf5]`}>{embedded ? 'Vehicle directory' : 'Assets'}</div>
          <p className="text-xs text-[#64748b] mt-0.5">Vehicles, tractors and trailers</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 rounded text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          + Add vehicle
        </button>
      </div>

      <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d47]">
              {['UNIT', 'TYPE', 'PLATE', 'OWNER', 'DRIVER', 'STATUS', 'LOAD', 'REV/MI', 'MI SINCE SVC', ''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[#475569] font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2d47]">
            {vehicles.map((v) => (
              <tr key={v.unit} onClick={() => setEditingVehicle(v)} className="hover:bg-[#111827] transition-colors cursor-pointer">
                <td className="px-4 py-3 font-mono text-amber-400 font-semibold">{v.unit}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{v.type}</td>
                <td className="px-4 py-3 text-[#64748b]">{v.plate}</td>
                <td className="px-4 py-3 text-[#64748b]">{v.owner}</td>
                <td className="px-4 py-3 text-[#64748b]">{v.driver === '—' ? '—' : v.driver}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${v.status === 'In use' ? 'text-blue-400' : v.status === 'Available' ? 'text-emerald-400' : 'text-[#64748b]'}`}>{v.status}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{v.load}</td>
                <td className="px-4 py-3 font-mono text-[#94a3b8]">{v.rpm}</td>
                <td className="px-4 py-3 font-mono text-[#64748b]">{v.miles}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={event => { event.stopPropagation(); setEditingVehicle(v) }}
                    className="text-xs px-3 py-1.5 rounded border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8] hover:border-[#2a3a54]"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddVehiclePanel
          nextTractorUnit={nextTractorNum()}
          nextTrailerUnit={nextTrailerNum()}
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
        />
      )}
      {editingVehicle && (
        <EditVehiclePanel
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSave={handleUpdated}
        />
      )}
    </div>
  )
}

function EditVehiclePanel({ vehicle, onClose, onSave }: {
  vehicle: VehicleRow
  onClose: () => void
  onSave: (vehicle: VehicleRow) => void
}) {
  const { loads, serviceRecords: allServiceRecords, addServiceRecord, updateVehicle } = useOperations()
  const [form, setForm] = useState(vehicle)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editSection, setEditSection] = useState<'vehicle' | 'financial' | 'documents'>('vehicle')
  const [showDriverPicker, setShowDriverPicker] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [serviceForm, setServiceForm] = useState({ date: '', category: 'Preventive maintenance', odometer: '', vendor: '', amount: '', notes: '', receipt: false })
  const [deductionItems, setDeductionItems] = useState(vehicle.deductionItems || [
    { id: 'insurance', label: 'Insurance', amount: '150' },
    { id: 'eld', label: 'ELD service', amount: '35' },
  ])
  const inputClass = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none focus:border-amber-500/40'
  const vehicleNames: Record<string, string> = {
    'T-104': '2021 Freightliner Cascadia',
    'T-108': '2021 Freightliner Cascadia',
    'T-112': '2022 International LT',
    'T-101': '2022 Volvo VNL 760',
    'T-115': '2023 Kenworth T680',
    'TR-221': "2022 Great Dane 53' Dry Van",
  }
  const displayName = vehicleNames[form.unit] || form.type
  const currentLocation = form.currentLocation || (form.status === 'In use' ? 'I-40 · Forrest City, AR' : form.status === 'Available' ? 'Carrier yard · Dallas, TX' : 'Maintenance facility · Dallas, TX')
  const revenueMonth = form.revenueMonth ? Number(form.revenueMonth) : form.rpm !== '—' ? 14380 : 0
  const serviceHistory = allServiceRecords.filter(record => record.vehicleUnit === form.unit)
  const serviceProjection = getVehicleServiceProjection(form, loads)

  function set<K extends keyof VehicleRow>(key: K, value: VehicleRow[K]) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function save() {
    if (!form.owner.trim() || !form.type.trim() || !form.plate.trim()) return
    const updated = {
      ...form,
      deductionItems,
      deductions: deductionItems.map(item => item.label).filter(Boolean).join(', '),
    }
    setForm(updated)
    setSaved(true)
    setTimeout(() => onSave(updated), 700)
  }

  function addDeduction() {
    setDeductionItems(current => [...current, { id: `deduction-${Date.now()}`, label: '', amount: '' }])
  }

  function updateDeduction(id: string, key: 'label' | 'amount', value: string) {
    setDeductionItems(current => current.map(item => item.id === id ? { ...item, [key]: value } : item))
  }

  function assignDriver(driver: string) {
    const updated = { ...form, driver }
    setForm(updated)
    setShowDriverPicker(false)
    setSaved(true)
    setTimeout(() => onSave(updated), 700)
  }

  function toggleServiceStatus() {
    const updated = { ...form, status: form.status === 'Out of service' ? 'Available' : 'Out of service' }
    setForm(updated)
    setSaved(true)
    setTimeout(() => onSave(updated), 700)
  }

  function saveServiceRecord() {
    if (!serviceForm.date || !serviceForm.odometer || !serviceForm.vendor) {
      setServiceError('Service date, odometer, and provider are required')
      return
    }
    addServiceRecord({
      ...serviceForm,
      id: `svc-admin-${Date.now()}`,
      vehicleUnit: form.unit,
      date: new Date(`${serviceForm.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      odometer: `${Number(serviceForm.odometer).toLocaleString()} mi`,
      submittedBy: 'Carrier admin',
      source: 'Carrier Admin',
      createdAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    })
    const updated = { ...form, odometer: `${Number(serviceForm.odometer).toLocaleString()} mi`, miles: '0', nextServiceMiles: form.serviceIntervalMiles || '10000', geoTrackedMiles: 0 }
    setForm(updated)
    updateVehicle(vehicle.unit, updated)
    setServiceForm({ date: '', category: 'Preventive maintenance', odometer: '', vendor: '', amount: '', notes: '', receipt: false })
    setServiceError('')
    setShowServiceForm(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-3 md:p-5">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl flex flex-col rounded-lg overflow-hidden shadow-2xl border border-[#1e2d47]" style={{ background: 'var(--background)' }}>
        <div className="shrink-0 px-6 py-4 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8]" aria-label="Close vehicle details">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#e8edf5]"><span className="font-mono text-amber-400">{form.unit}</span> · {displayName}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{form.status}{form.load !== '—' ? ` · ${form.load}` : ''} · {form.owner}</div>
          </div>
          {!editing && !saved && (
            <div className="flex items-center gap-2">
              <button onClick={() => setShowDriverPicker(true)} className="px-3 py-2 rounded border border-blue-500/30 text-xs font-semibold text-blue-400 hover:bg-blue-500/10">{form.driver === '—' ? 'Assign driver' : 'Update driver'}</button>
              <button onClick={() => { setEditSection('vehicle'); setEditing(true) }} className="px-3 py-2 rounded border border-[#1e2d47] text-xs font-semibold text-[#94a3b8] hover:text-white">Edit vehicle</button>
              <button onClick={toggleServiceStatus} className="px-3 py-2 rounded border border-red-500/30 text-xs font-semibold text-red-400 hover:bg-red-500/10">{form.status === 'Out of service' ? 'Return to service' : 'Mark out of service'}</button>
            </div>
          )}
        </div>

        {saved ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="w-14 h-14 rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="w-7 h-7">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-xs font-mono text-emerald-400 font-semibold tracking-wider">VEHICLE UPDATED</div>
            <div className="text-xl font-mono font-bold text-[#e8edf5] mt-2">{form.unit}</div>
          </div>
        ) : !editing ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Revenue this month', value: `$${revenueMonth.toLocaleString()}`, color: 'text-[#e8edf5]' },
                { label: 'Revenue per mile', value: form.rpm, color: 'text-[#e8edf5]' },
                { label: 'Miles since service', value: serviceProjection.milesSinceService.toLocaleString(), color: serviceProjection.dueSoon ? 'text-amber-400' : 'text-[#e8edf5]' },
                { label: 'Current location', value: currentLocation, color: 'text-[#e8edf5]' },
              ].map(metric => (
                <div key={metric.label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
                  <div className="text-xs text-[#64748b]">{metric.label}</div>
                  <div className={`text-xl font-bold font-mono mt-1 ${metric.color}`}>{metric.value}</div>
                </div>
              ))}
            </div>
            {serviceProjection.dueSoon && (
              <div className={`rounded border px-5 py-4 ${serviceProjection.overdue ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                <div className={`text-sm font-semibold ${serviceProjection.overdue ? 'text-red-400' : 'text-amber-300'}`}>{serviceProjection.overdue ? 'Truck service is due now' : `Truck service due in ${Math.round(serviceProjection.milesRemaining).toLocaleString()} miles`}</div>
                <div className="mt-1 text-xs text-[#64748b]">Calculated from the {serviceProjection.serviceInterval.toLocaleString()} mi service interval, completed load distance, and driver geolocation mileage while the truck and driver are in service.</div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                <div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Vehicle</div>
                <div className="divide-y divide-[#1e2d47]">
                  {[
                    ['Unit #', form.unit],
                    ['VIN', form.vin],
                    ['Type', form.type],
                    ['Plate', form.plate],
                    ['Assigned driver', form.driver],
                    ['Active load', form.load],
                    ['Status', form.status],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-3 text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] font-medium text-right">{value}</span></div>
                  ))}
                </div>
                <button onClick={() => setShowDriverPicker(true)} className="text-xs text-blue-400 font-semibold mt-3">{form.driver === '—' ? 'Assign a driver' : 'Change assigned driver'} →</button>
              </div>

              <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                <div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Ownership + pay split</div>
                <div className="divide-y divide-[#1e2d47]">
                  {[
                    ['Ownership', form.owner === 'Current Way Logistics' ? 'Company-owned' : 'Third party (owner-operator)'],
                    ['Owner', form.owner],
                    ['Driver share', `${form.driverShare || '28'}% of gross`],
                    ['Owner share', `${form.ownerShare || '72'}% of gross`],
                    ['Admin fee', `${form.adminFee || '16'}% of revenue`],
                    ['Weekly deductions', form.deductions || 'Fuel card, insurance'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-3 text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] font-medium text-right">{value}</span></div>
                  ))}
                </div>
                <button onClick={() => { setEditSection('financial'); setEditing(true) }} className="text-xs text-blue-400 font-semibold mt-3">Edit financial settings →</button>
              </div>

              <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                <div className="text-base font-semibold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Documents + maintenance</div>
                <div className="divide-y divide-[#1e2d47]">
                  {[
                    { label: 'Annual DOT inspection', value: form.annualDotExpiry || 'Valid · Mar 2027', status: form.annualDotExpiry === 'Missing' ? 'missing' : 'valid' },
                    { label: 'Registration / IRP cab card', value: form.registrationExpiry || 'Valid · Jan 2027', status: form.registrationExpiry === 'Missing' ? 'missing' : 'valid' },
                    { label: 'Physical damage insurance', value: form.physicalDamageExpiry || '21 days', status: form.physicalDamageExpiry === 'Missing' ? 'missing' : 'warning' },
                    { label: 'Form 2290 receipt', value: form.form2290Expiry || 'Valid · Aug 2027', status: form.form2290Expiry === 'Missing' ? 'missing' : 'valid' },
                    { label: 'NY HUT permit', value: form.nyHutPermit || 'Missing', status: form.nyHutPermit && form.nyHutPermit !== 'Missing' ? 'valid' : 'missing' },
                    { label: 'Service interval', value: `Every ${serviceProjection.serviceInterval.toLocaleString()} mi`, status: 'valid' },
                    { label: 'Next PM service', value: serviceProjection.overdue ? 'Due now' : `Due in ${Math.round(serviceProjection.milesRemaining).toLocaleString()} mi`, status: serviceProjection.dueSoon ? 'warning' : 'valid' },
                    { label: 'Non-trucking liability', value: form.owner === 'Current Way Logistics' ? 'Not required' : form.nonTruckingExpiry || 'Valid · Dec 2026', status: form.nonTruckingExpiry === 'Missing' ? 'missing' : 'valid' },
                  ].map(document => (
                    <div key={document.label} className="flex justify-between items-center gap-3 py-3 text-xs">
                      <span className="text-[#64748b]">{document.label}</span>
                      <span className={`px-2 py-0.5 rounded font-medium ${document.status === 'valid' ? 'bg-emerald-500/15 text-emerald-400' : document.status === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{document.value}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setEditSection('documents'); setEditing(true) }} className="text-xs text-blue-400 font-semibold mt-3">Update documents + maintenance →</button>
              </div>
            </div>
            <div className="rounded border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
              <div className="flex items-center justify-between gap-4 border-b border-[#1e2d47] px-5 py-4">
                <div><div className="text-base font-semibold text-[#e8edf5]">Truck service history</div><div className="mt-0.5 text-xs text-[#64748b]">{serviceHistory.length} synced records from carrier admins and assigned drivers</div></div>
                <button onClick={() => setShowServiceForm(current => !current)} className="rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-[#0d1117]">{showServiceForm ? 'Cancel' : '+ Add service record'}</button>
              </div>
              {showServiceForm && (
                <div className="border-b border-[#1e2d47] bg-[#0d1424] p-5">
                  <div className="grid grid-cols-4 gap-3">
                    <label><span className="mb-1.5 block text-xs text-[#64748b]">Service date *</span><input type="date" value={serviceForm.date} onChange={event => setServiceForm(current => ({ ...current, date: event.target.value }))} className={inputClass} /></label>
                    <label><span className="mb-1.5 block text-xs text-[#64748b]">Odometer *</span><input type="number" value={serviceForm.odometer} onChange={event => setServiceForm(current => ({ ...current, odometer: event.target.value }))} placeholder="211480" className={`${inputClass} font-mono`} /></label>
                    <label><span className="mb-1.5 block text-xs text-[#64748b]">Service type</span><select value={serviceForm.category} onChange={event => setServiceForm(current => ({ ...current, category: event.target.value }))} className={inputClass}><option>Preventive maintenance</option><option>Oil + filter service</option><option>Tire service</option><option>Brake repair</option><option>Roadside repair</option><option>DOT inspection repair</option><option>Other</option></select></label>
                    <label><span className="mb-1.5 block text-xs text-[#64748b]">Service provider *</span><input value={serviceForm.vendor} onChange={event => setServiceForm(current => ({ ...current, vendor: event.target.value }))} placeholder="Shop or provider" className={inputClass} /></label>
                    <label><span className="mb-1.5 block text-xs text-[#64748b]">Amount</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748b]">$</span><input type="number" min="0" step="0.01" value={serviceForm.amount} onChange={event => setServiceForm(current => ({ ...current, amount: event.target.value }))} className={`${inputClass} pl-7 font-mono`} /></div></label>
                    <label className="col-span-2"><span className="mb-1.5 block text-xs text-[#64748b]">Service notes</span><input value={serviceForm.notes} onChange={event => setServiceForm(current => ({ ...current, notes: event.target.value }))} placeholder="Work completed, parts, or remaining concerns" className={inputClass} /></label>
                    <button onClick={() => setServiceForm(current => ({ ...current, receipt: !current.receipt }))} className={`self-end rounded border py-2.5 text-xs font-semibold ${serviceForm.receipt ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-[#1e2d47] text-[#64748b]'}`}>{serviceForm.receipt ? 'Receipt attached' : 'Attach receipt'}</button>
                  </div>
                  {serviceError && <div className="mt-3 text-xs text-red-400">{serviceError}</div>}
                  <div className="mt-4 flex justify-end"><button onClick={saveServiceRecord} className="rounded bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white">Save service record</button></div>
                </div>
              )}
              {serviceHistory.length ? (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#111827]"><tr className="border-b border-[#1e2d47]">{['DATE / SERVICE', 'PROVIDER', 'ODOMETER', 'AMOUNT', 'REPORTED BY', 'RECEIPT'].map(header => <th key={header} className="px-4 py-3 text-left font-medium text-[#475569]">{header}</th>)}</tr></thead>
                    <tbody className="divide-y divide-[#1e2d47]">
                      {serviceHistory.map(record => (
                        <tr key={record.id}>
                          <td className="px-4 py-3"><div className="font-medium text-[#e8edf5]">{record.category}</div><div className="mt-0.5 text-[10px] text-[#64748b]">{record.date}</div><div className="mt-1 max-w-xs text-[10px] text-[#475569]">{record.notes || 'No service notes'}</div></td>
                          <td className="px-4 py-3 text-[#94a3b8]">{record.vendor}</td>
                          <td className="px-4 py-3 font-mono text-[#94a3b8]">{record.odometer}</td>
                          <td className="px-4 py-3 font-mono text-[#e8edf5]">{record.amount ? `$${Number(record.amount).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3"><div className="text-[#94a3b8]">{record.submittedBy}</div><div className={`mt-0.5 text-[10px] ${record.source === 'Driver App' ? 'text-blue-400' : 'text-amber-400'}`}>{record.source} · {record.createdAt}</div></td>
                          <td className="px-4 py-3">{record.receipt ? <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-emerald-400">Attached</span> : <span className="text-[#475569]">None</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div className="px-5 py-8 text-center text-xs text-[#475569]">No service records have been added for this truck.</div>}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div>
                <div className="text-lg font-semibold text-[#e8edf5]">
                  {editSection === 'financial' ? 'Edit financial settings' : editSection === 'documents' ? 'Update documents + maintenance' : 'Edit vehicle information'}
                </div>
                <div className="text-xs text-[#64748b] mt-1">
                  {editSection === 'financial'
                    ? 'Only payment allocation and settlement deductions are changed here.'
                    : editSection === 'documents'
                      ? 'Only vehicle compliance documents, permits, insurance and maintenance scheduling are shown here.'
                      : 'Update vehicle, owner, registration and operating information.'}
                </div>
              </div>

              {editSection === 'financial' ? (
                <>
                  <div className="rounded border border-[#1e2d47] p-5 space-y-4" style={{ background: 'var(--card)' }}>
                    <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Revenue allocation</div>
                    <div className="grid grid-cols-3 gap-4">
                      <label>
                        <span className="block text-xs text-[#64748b] mb-1.5">Driver share</span>
                        <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]"><input type="number" min="0" max="100" value={form.driverShare || '28'} onChange={event => set('driverShare', event.target.value)} className="w-full px-3 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" /><span className="pr-3 text-[#64748b]">%</span></div>
                      </label>
                      <label>
                        <span className="block text-xs text-[#64748b] mb-1.5">Owner / truck share</span>
                        <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]"><input type="number" min="0" max="100" value={form.ownerShare || '72'} onChange={event => set('ownerShare', event.target.value)} className="w-full px-3 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" /><span className="pr-3 text-[#64748b]">%</span></div>
                      </label>
                      <label>
                        <span className="block text-xs text-[#64748b] mb-1.5">Admin fee</span>
                        <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]"><input type="number" min="0" max="100" value={form.adminFee || '16'} onChange={event => set('adminFee', event.target.value)} className="w-full px-3 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" /><span className="pr-3 text-[#64748b]">%</span></div>
                      </label>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-[#1e2d47] flex">
                      <div className="bg-blue-500" style={{ width: `${Math.min(Number(form.driverShare || 28), 100)}%` }} />
                      <div className="bg-amber-500 flex-1" />
                    </div>
                  </div>

                  <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div><div className="text-sm font-semibold text-[#e8edf5]">Settlement deduction line items</div><div className="text-xs text-[#64748b] mt-1">Add recurring weekly charges applied to this truck or its driver settlement.</div></div>
                      <button type="button" onClick={addDeduction} className="px-3 py-2 rounded border border-blue-500/30 text-xs font-semibold text-blue-400 hover:bg-blue-500/10">+ Add deduction</button>
                    </div>
                    <div className="space-y-3">
                      {deductionItems.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-[1fr_160px_36px] gap-3 items-end">
                          <label>
                            <span className="block text-xs text-[#64748b] mb-1.5">Deduction name</span>
                            <input value={item.label} onChange={event => updateDeduction(item.id, 'label', event.target.value)} placeholder="e.g. Trailer rental" className={inputClass} />
                          </label>
                          <label>
                            <span className="block text-xs text-[#64748b] mb-1.5">Weekly amount</span>
                            <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]"><span className="pl-3 text-[#64748b]">$</span><input type="number" min="0" value={item.amount} onChange={event => updateDeduction(item.id, 'amount', event.target.value)} placeholder="0.00" className="w-full px-2 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" /></div>
                          </label>
                          <button type="button" onClick={() => setDeductionItems(current => current.filter(deduction => deduction.id !== item.id))} className="h-10 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10" aria-label={`Remove deduction ${index + 1}`}>×</button>
                        </div>
                      ))}
                      {deductionItems.length === 0 && <div className="rounded border border-dashed border-[#1e2d47] py-6 text-center text-xs text-[#475569]">No recurring deductions. Add a line item when needed.</div>}
                    </div>
                    <div className="flex justify-between mt-4 pt-4 border-t border-[#1e2d47] text-sm"><span className="text-[#64748b]">Total weekly deductions</span><span className="font-mono font-bold text-red-400">−${deductionItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(2)}</span></div>
                  </div>
                </>
              ) : editSection === 'documents' ? (
                <>
                  <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                    <div className="text-sm font-semibold text-[#e8edf5] mb-1">Compliance documents</div>
                    <div className="text-xs text-[#64748b] mb-4">Update expiration dates and permit status. Document files remain available in Compliance.</div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'annualDotExpiry' as const, label: 'Annual DOT inspection', placeholder: 'Valid · Mar 2027' },
                        { key: 'registrationExpiry' as const, label: 'Registration / IRP cab card', placeholder: 'Valid · Jan 2027' },
                        { key: 'physicalDamageExpiry' as const, label: 'Physical damage insurance', placeholder: 'Valid · Dec 2026' },
                        { key: 'form2290Expiry' as const, label: 'Form 2290 receipt', placeholder: 'Valid · Aug 2027' },
                        { key: 'nyHutPermit' as const, label: 'NY HUT permit', placeholder: 'Missing or permit expiration' },
                        { key: 'nonTruckingExpiry' as const, label: 'Non-trucking liability', placeholder: 'Valid · Dec 2026' },
                      ].map(document => (
                        <label key={document.key}>
                          <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">{document.label}</span>
                          <input value={form[document.key] || ''} onChange={event => set(document.key, event.target.value)} placeholder={document.placeholder} className={inputClass} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
                    <div className="text-sm font-semibold text-[#e8edf5] mb-1">Preventive maintenance</div>
                    <div className="text-xs text-[#64748b] mb-4">Schedule the next service using remaining mileage.</div>
                    <div className="grid grid-cols-2 gap-4">
                      <label>
                        <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Current miles since service</span>
                        <input value={form.miles} onChange={event => set('miles', event.target.value)} className={`${inputClass} font-mono`} />
                      </label>
                      <label>
                        <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Recurring service interval (miles)</span>
                        <input type="number" min="1" value={form.serviceIntervalMiles || '10000'} onChange={event => set('serviceIntervalMiles', event.target.value)} className={`${inputClass} font-mono`} />
                      </label>
                    </div>
                  </div>
                  <div className="rounded border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
                    Expired or missing required documents may block this truck from dispatch. Updates are recorded in the compliance audit history.
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Unit number</span><input value={form.unit} onChange={event => set('unit', event.target.value.toUpperCase())} className={`${inputClass} font-mono`} /></label>
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Status</span><select value={form.status} onChange={event => set('status', event.target.value)} className={inputClass}><option>Available</option><option>In use</option><option>In shop</option><option>Out of service</option></select></label>
                  </div>
                  <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Truck owner <span className="text-amber-400">*</span></span><input value={form.owner} onChange={event => set('owner', event.target.value)} className={inputClass} /></label>
                  <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Vehicle type <span className="text-amber-400">*</span></span><input value={form.type} onChange={event => set('type', event.target.value)} className={inputClass} /></label>
                  <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">VIN</span><input value={form.vin} onChange={event => set('vin', event.target.value.toUpperCase())} className={`${inputClass} font-mono`} /></label>
                  <div className="grid grid-cols-2 gap-4">
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Plate</span><input value={form.plate} onChange={event => set('plate', event.target.value.toUpperCase())} className={`${inputClass} font-mono`} /></label>
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Assigned driver</span><input value={form.driver} onChange={event => set('driver', event.target.value)} className={inputClass} /></label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Revenue per mile</span><input value={form.rpm} onChange={event => set('rpm', event.target.value)} className={`${inputClass} font-mono`} /></label>
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Miles since service</span><input value={form.miles} onChange={event => set('miles', event.target.value)} className={`${inputClass} font-mono`} /></label>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Current location</span><input value={form.currentLocation || currentLocation} onChange={event => set('currentLocation', event.target.value)} className={inputClass} /></label>
                    <label><span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Revenue this month</span><input type="number" min="0" value={form.revenueMonth || String(revenueMonth)} onChange={event => set('revenueMonth', event.target.value)} className={`${inputClass} font-mono`} /></label>
                  </div>
                </>
              )}
            </div>
            <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between" style={{ background: 'var(--card)' }}>
              <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8]">Back to details</button>
              <button onClick={save} className="px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                Save changes
              </button>
            </div>
          </>
        )}

        {showDriverPicker && !saved && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-black/70">
            <div className="w-full max-w-2xl max-h-full overflow-y-auto rounded border border-[#1e2d47] shadow-2xl" style={{ background: 'var(--background)' }}>
              <div className="flex items-start justify-between px-5 py-4 border-b border-[#1e2d47]">
                <div><div className="text-base font-semibold text-[#e8edf5]">{form.driver === '—' ? 'Assign driver' : 'Update assigned driver'}</div><div className="text-xs text-[#64748b] mt-0.5">{form.unit} · Select one available driver</div></div>
                <button onClick={() => setShowDriverPicker(false)} className="text-[#64748b]" aria-label="Close driver picker"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3">
                {AVAILABLE_DRIVERS.filter(driver => driver.status !== 'Onboarding').map(driver => (
                  <button key={driver.id} onClick={() => assignDriver(driver.name)} className={`flex items-center gap-3 rounded border p-4 text-left ${form.driver === driver.name ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}>
                    <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${form.driver === driver.name ? 'bg-amber-500 text-[#070c18]' : 'bg-[#1e2d47] text-[#64748b]'}`}>{driver.initials}</span>
                    <span><span className="block text-sm font-semibold text-[#e8edf5]">{driver.name}</span><span className="block text-xs text-[#64748b] mt-0.5">{driver.cdl}</span><span className={`block text-[10px] mt-1 ${driver.status === 'Available' ? 'text-emerald-400' : 'text-blue-400'}`}>{driver.status}</span></span>
                  </button>
                ))}
                <button onClick={() => assignDriver('—')} className="col-span-2 py-3 rounded border border-red-500/20 text-xs text-red-400 hover:bg-red-500/10">Remove current driver assignment</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Add Vehicle Panel ── */

type VehicleCategory = 'tractor' | 'box-truck' | 'reefer-truck' | 'trailer' | ''
type AddVehicleStep = 0 | 1 | 2 | 3 | 4 | 5

const ADD_STEPS = [
  { label: 'Owner', short: 'Company or owner-operator' },
  { label: 'Vehicle details', short: 'VIN, type, plate' },
  { label: 'Documents', short: 'Registration, insurance' },
  { label: 'Financial settings', short: 'Shares, deductions' },
  { label: 'Assign driver', short: 'One at a time' },
  { label: 'Review + approve', short: 'Manager approval' },
]

const CAB_TYPES = ['Sleeper', 'Day cab', 'Team sleeper', 'Flat nose / cabover']
const STRAIGHT_TRUCK_SIZES = ["12'", "16'", "20'", "22'", "24'", "26'"]
const REEFER_TRUCK_SIZES = ["16'", "20'", "22'", "24'", "26'"]
const TRAILER_TYPES = ["53' Dry van", "48' Dry van", "53' Reefer", "48' Reefer", "53' Flatbed", "48' Flatbed", 'Step deck', 'Lowboy', 'Tanker', 'Curtainside', 'Car hauler']
const MAKES_TRACTOR = ['Kenworth', 'Peterbilt', 'Freightliner', 'Volvo', 'International', 'Mack', 'Western Star']
const MAKES_STRAIGHT = ['Ford', 'Isuzu', 'Hino', 'Mitsubishi Fuso', 'Freightliner', 'International', 'Kenworth']
const MAKES_TRAILER = ['Great Dane', 'Wabash', 'Utility', 'Stoughton', 'Hyundai Translead', 'Vanguard', 'Fontaine', 'Polar', 'Wilson']
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

const VIN_LOOKUP: Record<string, { year: string; make: string; model: string }> = {
  '1XKWD': { year: '2023', make: 'Kenworth', model: 'T680' },
  '3AKJG': { year: '2022', make: 'Freightliner', model: 'Cascadia' },
  '4V4NC': { year: '2023', make: 'Volvo', model: 'VNL 860' },
  '1XPBD': { year: '2022', make: 'Peterbilt', model: '389' },
  '1FUJG': { year: '2021', make: 'Freightliner', model: 'Cascadia' },
  '2M53A': { year: '2022', make: 'Great Dane', model: '53\' Dry Van' },
  '1JJV5': { year: '2021', make: 'Wabash', model: 'DuraPlate' },
}

interface AddVehicleForm {
  category: VehicleCategory
  trailerSubtype: string
  cabType: string
  truckSize: string
  unit: string
  vin: string
  year: string
  make: string
  model: string
  plateNum: string
  plateState: string
  initialOdometer: string
  serviceIntervalMiles: string
  vinDecoded: boolean
  ownerType: 'company' | 'owner-op'
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  insuranceCarrier: string
  policyNum: string
  policyExp: string
  liabilityUploaded: boolean
  cargoUploaded: boolean
  physicalDamageUploaded: boolean
  nonTruckingLiabilityUploaded: boolean
  registrationUploaded: boolean
  annualDotUploaded: boolean
  leaseAgreementUploaded: boolean
  driverPayMethod: 'percentage' | 'per-mile' | 'flat'
  driverPayValue: string
  truckPayMethod: 'percentage' | 'per-mile' | 'flat'
  truckPayValue: string
  insuranceDeduction: string
  trailerDeduction: string
  eldDeduction: string
  escrowDeduction: string
  fuelCardDeduction: boolean
  assignedDriver: string
}

function AddVehiclePanel({ nextTractorUnit, nextTrailerUnit, onClose, onAdded, completeOnboarding = false }: {
  nextTractorUnit: string
  nextTrailerUnit: string
  onClose: () => void
  onAdded: (v: VehicleRow) => void
  completeOnboarding?: boolean
}) {
  const [step, setStep] = useState<AddVehicleStep>(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [form, setForm] = useState<AddVehicleForm>({
    category: '', trailerSubtype: '', cabType: 'Sleeper', truckSize: '',
    unit: '', vin: '', year: '', make: '', model: '',
    plateNum: '', plateState: 'TX', initialOdometer: '', serviceIntervalMiles: '10000', vinDecoded: false,
    ownerType: 'company', ownerName: '', ownerPhone: '', ownerEmail: '',
    insuranceCarrier: '', policyNum: '', policyExp: '',
    liabilityUploaded: false, cargoUploaded: false, physicalDamageUploaded: false,
    nonTruckingLiabilityUploaded: false, registrationUploaded: false,
    annualDotUploaded: false, leaseAgreementUploaded: false,
    driverPayMethod: 'percentage', driverPayValue: '28',
    truckPayMethod: 'percentage', truckPayValue: '72',
    insuranceDeduction: '150', trailerDeduction: '', eldDeduction: '35', escrowDeduction: '100',
    fuelCardDeduction: true, assignedDriver: '',
  })

  const set = <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => setForm(f => ({ ...f, [k]: v }))

  function decodeVin() {
    const prefix = form.vin.slice(0, 5).toUpperCase()
    const decoded = VIN_LOOKUP[prefix]
    if (decoded) {
      setForm(f => ({ ...f, year: decoded.year, make: decoded.make, model: decoded.model, vinDecoded: true }))
    } else if (form.vin.length >= 5) {
      const fallbacks: Record<VehicleCategory, { make: string; model: string }> = {
        'tractor': { make: 'Kenworth', model: 'T680' },
        'box-truck': { make: 'Isuzu', model: 'NPR-HD' },
        'reefer-truck': { make: 'Isuzu', model: 'NRR Reefer' },
        'trailer': { make: 'Great Dane', model: "53' Dry Van" },
        '': { make: 'Kenworth', model: 'T680' },
      }
      const fb = fallbacks[form.category]
      setForm(f => ({ ...f, year: '2022', make: fb.make, model: fb.model, vinDecoded: true }))
    }
  }

  function validate(s: AddVehicleStep): boolean {
    const e: Record<string, string> = {}
    if (s === 0) {
      if (form.ownerType === 'owner-op' && !form.ownerName) e.ownerName = 'Owner name required'
      if (form.ownerType === 'owner-op' && !form.ownerPhone) e.ownerPhone = 'Phone required'
    }
    if (s === 1) {
      if (!form.category) e.category = 'Select a vehicle category'
      if (form.category === 'trailer' && !form.trailerSubtype) e.trailerSubtype = 'Select trailer type'
      if ((form.category === 'box-truck' || form.category === 'reefer-truck') && !form.truckSize) e.truckSize = 'Select truck size'
      if (!form.vin) e.vin = 'VIN is required'
      else if (form.vin.length < 11) e.vin = 'VIN must be at least 11 characters'
      if (!form.year) e.year = 'Year required'
      if (!form.make) e.make = 'Make required'
      if (!form.model) e.model = 'Model required'
      if (!form.plateNum) e.plateNum = 'Plate number required'
      if (!form.initialOdometer || Number(form.initialOdometer) < 0) e.initialOdometer = 'Current odometer is required'
      if (!form.serviceIntervalMiles || Number(form.serviceIntervalMiles) <= 0) e.serviceIntervalMiles = 'Enter miles required between service'
    }
    if (s === 3) {
      if (!form.driverPayValue || Number(form.driverPayValue) < 0) e.driverPayValue = 'Enter the driver pay value'
      if (!form.truckPayValue || Number(form.truckPayValue) < 0) e.truckPayValue = 'Enter the truck pay value'
      if (form.driverPayMethod === 'percentage' && form.truckPayMethod === 'percentage' && Number(form.driverPayValue) + Number(form.truckPayValue) !== 100) {
        e.paySplit = 'Driver and truck percentage shares must total 100%'
      }
    }
    if (s === 4 && !form.assignedDriver) e.assignedDriver = 'Select a driver or choose assign later'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (!validate(step)) return
    if (step === 1 && !form.unit) {
      const autoUnit = form.category === 'trailer' ? nextTrailerUnit
        : form.category === 'box-truck' ? nextTractorUnit.replace('T-', 'BT-')
        : form.category === 'reefer-truck' ? nextTractorUnit.replace('T-', 'RT-')
        : nextTractorUnit
      set('unit', autoUnit)
    }
    setStep(s => Math.min(s + 1, 5) as AddVehicleStep)
    setErrors({})
  }

  function back() {
    if (step === 0) { onClose(); return }
    setStep(s => Math.max(s - 1, 0) as AddVehicleStep)
    setErrors({})
  }

  function submit() {
    if (!validate(step)) return
    const typeLabel =
      form.category === 'tractor' ? `Tractor · ${form.cabType.toLowerCase()}`
      : form.category === 'box-truck' ? `Box truck · ${form.truckSize}`
      : form.category === 'reefer-truck' ? `Reefer truck · ${form.truckSize}`
      : `Trailer · ${form.trailerSubtype.toLowerCase()}`
    const newRow: VehicleRow = {
      unit: form.unit,
      vin: form.vin.length > 8 ? form.vin.slice(0, 4) + '...' + form.vin.slice(-4) : form.vin,
      type: typeLabel,
      plate: `${form.plateState} · ${form.plateNum.toUpperCase()}`,
      owner: form.ownerType === 'owner-op' ? form.ownerName : 'Current Way Logistics',
      driver: form.assignedDriver === 'Assign later' ? '—' : form.assignedDriver,
      status: 'Available',
      load: '—',
      rpm: '—',
      miles: '0',
      odometer: `${Number(form.initialOdometer).toLocaleString()} mi`,
      serviceIntervalMiles: form.serviceIntervalMiles,
      geoTrackedMiles: 0,
      driverShare: form.driverPayMethod === 'percentage' ? form.driverPayValue : '',
      ownerShare: form.truckPayMethod === 'percentage' ? form.truckPayValue : '',
      adminFee: '16',
      deductions: [
        form.fuelCardDeduction ? 'Fuel card' : '',
        form.insuranceDeduction ? 'insurance' : '',
        form.escrowDeduction ? 'escrow' : '',
        form.eldDeduction ? 'ELD' : '',
      ].filter(Boolean).join(', '),
      deductionItems: [
        form.insuranceDeduction ? { id: 'insurance', label: 'Insurance', amount: form.insuranceDeduction } : null,
        form.trailerDeduction ? { id: 'trailer', label: 'Trailer rental', amount: form.trailerDeduction } : null,
        form.eldDeduction ? { id: 'eld', label: 'ELD service', amount: form.eldDeduction } : null,
        form.escrowDeduction ? { id: 'escrow', label: 'Escrow installment', amount: form.escrowDeduction } : null,
      ].filter((item): item is { id: string; label: string; amount: string } => item !== null),
      currentLocation: 'Carrier yard · Dallas, TX',
      revenueMonth: '0',
      annualDotExpiry: form.annualDotUploaded ? 'Uploaded · review pending' : 'Missing',
      registrationExpiry: form.registrationUploaded ? 'Uploaded · review pending' : 'Missing',
      physicalDamageExpiry: form.physicalDamageUploaded ? 'Uploaded · review pending' : 'Missing',
      form2290Expiry: 'Missing',
      nyHutPermit: 'Missing',
      nonTruckingExpiry: form.nonTruckingLiabilityUploaded ? 'Uploaded · review pending' : form.ownerType === 'company' ? 'Not required' : 'Missing',
      nextServiceMiles: form.serviceIntervalMiles,
    }
    setDone(true)
    setTimeout(() => onAdded(newRow), 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-3 md:p-5">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-6xl flex flex-col rounded-lg overflow-hidden shadow-2xl border border-[#1e2d47]" style={{ background: 'var(--background)' }}>

        {/* Header */}
        <div className="shrink-0 px-6 py-3.5 border-b border-[#1e2d47] flex items-center gap-3">
          <button onClick={onClose} className="text-[#475569] hover:text-[#94a3b8] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="text-xs text-[#475569]">
            Assets <span className="mx-1">/</span>
            <span className="text-[#e8edf5] font-semibold">{completeOnboarding ? 'Complete vehicle onboarding' : 'Add vehicle'}</span>
            {form.unit && <span className="font-mono text-[#64748b] ml-2">{form.unit} · draft</span>}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left workflow rail */}
          <aside className="hidden md:block w-60 shrink-0 border-r border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-xs font-semibold text-[#475569] uppercase tracking-wide px-2 mb-3">Onboarding flow</div>
            <div className="space-y-1">
              {ADD_STEPS.map((item, index) => {
                const complete = index < step
                const active = index === step
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => index < step && setStep(index as AddVehicleStep)}
                    className={`w-full flex items-start gap-3 rounded px-3 py-3 text-left transition-all ${
                      active ? 'bg-blue-500/15 border border-blue-500/30' : 'border border-transparent'
                    } ${index < step ? 'cursor-pointer hover:bg-[#111827]' : 'cursor-default'}`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      complete ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-[#1e2d47] text-[#64748b]'
                    }`}>
                      {complete ? '✓' : index + 1}
                    </span>
                    <span>
                      <span className={`block text-xs font-semibold ${active ? 'text-blue-300' : complete ? 'text-[#94a3b8]' : 'text-[#64748b]'}`}>{item.label}</span>
                      <span className="block text-[10px] text-[#475569] mt-0.5">{item.short}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Content */}
          {done ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="w-14 h-14 rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="w-7 h-7">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-mono text-emerald-400 font-semibold tracking-wider mb-1">
                {completeOnboarding ? 'ONBOARDING COMPLETED' : 'VEHICLE ADDED'}
              </div>
              <div className="font-mono text-2xl font-bold text-[#e8edf5]">{form.unit}</div>
              <div className="text-sm text-[#64748b] mt-1">{form.year} {form.make} {form.model}</div>
              <div className="text-xs text-[#475569] mt-0.5 font-mono">Status: Available · Ready for dispatch</div>
            </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-5 md:px-8">
              <div className="md:hidden mb-4 text-xs font-semibold text-blue-300">Step {step + 1} of {ADD_STEPS.length} · {ADD_STEPS[step].label}</div>
              {step === 0 && <AVStep3Ownership form={form} set={set} errors={errors} />}
              {step === 1 && (
                <div className="space-y-8">
                  <AVStep1Type form={form} set={set} errors={errors} />
                  {form.category && <div className="border-t border-[#1e2d47] pt-7"><AVStep2Details form={form} set={set} errors={errors} decodeVin={decodeVin} /></div>}
                </div>
              )}
              {step === 2 && <AVStep4Docs form={form} set={set} errors={errors} />}
              {step === 3 && <AVStep5Financial form={form} set={set} errors={errors} />}
              {step === 4 && <AVStep6Driver form={form} set={set} errors={errors} />}
              {step === 5 && <AVStep7Review form={form} />}
            </div>
          )}
        </div>

        {/* Footer */}
        {!done && (
          <div className="shrink-0 px-6 py-4 border-t border-[#1e2d47] flex items-center justify-between gap-3" style={{ background: 'var(--card)' }}>
            <button onClick={back} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors">
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            {step < 5 ? (
              <button onClick={next} className="px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90 transition-all" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                Continue to {ADD_STEPS[step + 1].short} →
              </button>
            ) : (
              <button onClick={submit} className="px-5 py-2.5 rounded text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">
                {completeOnboarding ? 'Approve + complete onboarding' : 'Add vehicle'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Add Vehicle Steps ── */

function AVStep1Type({ form, set, errors }: { form: AddVehicleForm; set: <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => void; errors: Record<string, string> }) {
  const chipClass = (active: boolean) =>
    `px-3 py-2 rounded border text-xs font-medium transition-all ${active ? 'border-amber-500/50 text-amber-300' : 'border-[#1e2d47] text-[#64748b] hover:border-[#2a3a54] hover:text-[#94a3b8]'}`
  const chipBg = (active: boolean) => ({ background: active ? '#f59e0b10' : 'var(--card)' })

  const CATEGORIES = [
    { val: 'tractor' as VehicleCategory, label: 'Tractor / Semi', sub: 'Class 8 power unit — sleeper, day cab, team', icon: '🚛' },
    { val: 'box-truck' as VehicleCategory, label: 'Box truck', sub: 'Rigid straight truck with enclosed cargo box', icon: '📦' },
    { val: 'reefer-truck' as VehicleCategory, label: 'Reefer truck', sub: 'Temperature-controlled straight truck', icon: '❄️' },
    { val: 'trailer' as VehicleCategory, label: 'Trailer', sub: 'Non-powered unit — dry van, flatbed, reefer, etc.', icon: '🔲' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">Vehicle type</h2>
        <p className="text-xs text-[#64748b] mt-0.5">Select the category of vehicle you're adding.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(opt => (
          <button key={opt.val} type="button"
            onClick={() => { set('category', opt.val); set('truckSize', ''); set('trailerSubtype', '') }}
            className={`px-4 py-4 rounded border text-left transition-all ${form.category === opt.val ? 'border-amber-500/50' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
            style={{ background: form.category === opt.val ? '#f59e0b08' : 'var(--card)' }}>
            <div className="text-xl mb-2">{opt.icon}</div>
            <div className={`text-sm font-semibold ${form.category === opt.val ? 'text-amber-300' : 'text-[#94a3b8]'}`}>{opt.label}</div>
            <div className="text-xs text-[#475569] mt-1 leading-relaxed">{opt.sub}</div>
          </button>
        ))}
      </div>
      {errors.category && <p className="text-xs text-red-400 font-mono">{errors.category}</p>}

      {/* Tractor: cab type */}
      {form.category === 'tractor' && (
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-2">Cab type</label>
          <div className="flex flex-wrap gap-2">
            {CAB_TYPES.map(t => (
              <button key={t} type="button" onClick={() => set('cabType', t)} className={chipClass(form.cabType === t)} style={chipBg(form.cabType === t)}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {/* Box truck: size */}
      {form.category === 'box-truck' && (
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-2">Cargo box size <span className="text-amber-400">*</span></label>
          <div className="flex flex-wrap gap-2">
            {STRAIGHT_TRUCK_SIZES.map(s => (
              <button key={s} type="button" onClick={() => set('truckSize', s)} className={chipClass(form.truckSize === s)} style={chipBg(form.truckSize === s)}>{s}</button>
            ))}
          </div>
          {errors.truckSize && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.truckSize}</p>}
          <p className="text-xs text-[#475569] mt-2">Box truck unit numbers are prefixed BT- (e.g. BT-120)</p>
        </div>
      )}

      {/* Reefer truck: size */}
      {form.category === 'reefer-truck' && (
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-2">Reefer box size <span className="text-amber-400">*</span></label>
          <div className="flex flex-wrap gap-2">
            {REEFER_TRUCK_SIZES.map(s => (
              <button key={s} type="button" onClick={() => set('truckSize', s)} className={chipClass(form.truckSize === s)} style={chipBg(form.truckSize === s)}>{s}</button>
            ))}
          </div>
          {errors.truckSize && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.truckSize}</p>}
          <p className="text-xs text-[#475569] mt-2">Reefer truck unit numbers are prefixed RT- (e.g. RT-120)</p>
          <div className="mt-3 rounded border border-blue-500/20 px-3 py-2 text-xs text-blue-300" style={{ background: '#3b82f608' }}>
            A refrigerated straight truck (Class 6–7) — not a reefer trailer. Add trailer reefers under the Trailer category.
          </div>
        </div>
      )}

      {/* Trailer: type and subtype */}
      {form.category === 'trailer' && (
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-2">Trailer type <span className="text-amber-400">*</span></label>
          <div className="flex flex-wrap gap-2">
            {TRAILER_TYPES.map(t => (
              <button key={t} type="button" onClick={() => set('trailerSubtype', t)} className={chipClass(form.trailerSubtype === t)} style={chipBg(form.trailerSubtype === t)}>{t}</button>
            ))}
          </div>
          {errors.trailerSubtype && <p className="text-xs text-red-400 mt-1.5 font-mono">{errors.trailerSubtype}</p>}
        </div>
      )}
    </div>
  )
}

function AVStep2Details({ form, set, errors, decodeVin }: {
  form: AddVehicleForm
  set: <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => void
  errors: Record<string, string>
  decodeVin: () => void
}) {
  const makes = form.category === 'tractor' ? MAKES_TRACTOR
    : form.category === 'box-truck' || form.category === 'reefer-truck' ? MAKES_STRAIGHT
    : MAKES_TRAILER
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">VIN + details</h2>
        <p className="text-xs text-[#64748b] mt-0.5">Enter the VIN to decode year, make and model automatically.</p>
      </div>

      {/* VIN */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">VIN <span className="text-amber-400">*</span></label>
        <div className="flex gap-2">
          <input
            value={form.vin}
            onChange={e => { set('vin', e.target.value.toUpperCase()); set('vinDecoded', false) }}
            placeholder="e.g. 1XKWD40X3NJ987654"
            maxLength={17}
            className={`flex-1 px-3 py-2.5 rounded border text-sm font-mono ${errors.vin ? 'border-red-500/50' : 'border-[#1e2d47]'} bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40 transition-colors`}
          />
          <button
            type="button"
            onClick={decodeVin}
            disabled={form.vin.length < 5}
            className={`px-4 py-2.5 rounded text-xs font-semibold whitespace-nowrap transition-all ${form.vin.length >= 5 ? 'hover:opacity-90' : 'opacity-40 cursor-not-allowed'}`}
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Decode VIN
          </button>
        </div>
        {errors.vin && <p className="text-xs text-red-400 mt-1 font-mono">{errors.vin}</p>}
        {form.vinDecoded && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            VIN decoded · {form.year} {form.make} {form.model}
          </div>
        )}
      </div>

      {/* Year / Make / Model */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Year <span className="text-amber-400">*</span></label>
          <input value={form.year} onChange={e => set('year', e.target.value)} placeholder="2023" maxLength={4}
            className={`w-full px-3 py-2.5 rounded border text-sm ${errors.year ? 'border-red-500/50' : 'border-[#1e2d47]'} bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40 transition-colors`} />
          {errors.year && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors.year}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Make <span className="text-amber-400">*</span></label>
          <select value={form.make} onChange={e => set('make', e.target.value)}
            className={`w-full px-3 py-2.5 rounded border text-sm ${errors.make ? 'border-red-500/50' : 'border-[#1e2d47]'} bg-[#0d1424] text-[#e8edf5] focus:outline-none focus:border-amber-500/40 transition-colors`}>
            <option value="">Select</option>
            {makes.map(m => <option key={m}>{m}</option>)}
          </select>
          {errors.make && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors.make}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Model <span className="text-amber-400">*</span></label>
          <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="T680"
            className={`w-full px-3 py-2.5 rounded border text-sm ${errors.model ? 'border-red-500/50' : 'border-[#1e2d47]'} bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40 transition-colors`} />
          {errors.model && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors.model}</p>}
        </div>
      </div>

      {/* Unit number */}
      <div>
        <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Unit number</label>
        <input value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="Auto-assigned (editable)"
          className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm font-mono focus:outline-none focus:border-amber-500/40 transition-colors" />
        <p className="text-xs text-[#475569] mt-1">Leave blank to auto-assign</p>
      </div>

      {/* Plate */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Plate number <span className="text-amber-400">*</span></label>
          <input value={form.plateNum} onChange={e => set('plateNum', e.target.value.toUpperCase())} placeholder="R4K-2291"
            className={`w-full px-3 py-2.5 rounded border text-sm font-mono ${errors.plateNum ? 'border-red-500/50' : 'border-[#1e2d47]'} bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40 transition-colors`} />
          {errors.plateNum && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors.plateNum}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">State</label>
          <select value={form.plateState} onChange={e => set('plateState', e.target.value)}
            className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40 transition-colors">
            {US_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 rounded border border-blue-500/20 bg-blue-500/5 p-4">
        <label>
          <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Current odometer <span className="text-amber-400">*</span></span>
          <div className="relative"><input type="number" min="0" value={form.initialOdometer} onChange={event => set('initialOdometer', event.target.value)} placeholder="211480" className={`w-full rounded border bg-[#0d1424] px-3 py-2.5 pr-10 text-sm font-mono text-[#e8edf5] placeholder-[#475569] focus:outline-none ${errors.initialOdometer ? 'border-red-500/50' : 'border-[#1e2d47]'}`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748b]">mi</span></div>
          {errors.initialOdometer && <p className="mt-1 text-xs text-red-400">{errors.initialOdometer}</p>}
        </label>
        <label>
          <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Additional mileage before service <span className="text-amber-400">*</span></span>
          <div className="relative"><input type="number" min="1" value={form.serviceIntervalMiles} onChange={event => set('serviceIntervalMiles', event.target.value)} placeholder="10000" className={`w-full rounded border bg-[#0d1424] px-3 py-2.5 pr-10 text-sm font-mono text-[#e8edf5] placeholder-[#475569] focus:outline-none ${errors.serviceIntervalMiles ? 'border-red-500/50' : 'border-[#1e2d47]'}`} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#64748b]">mi</span></div>
          <p className="mt-1 text-[10px] text-[#475569]">Creates the recurring service interval used for mileage alerts.</p>
          {errors.serviceIntervalMiles && <p className="mt-1 text-xs text-red-400">{errors.serviceIntervalMiles}</p>}
        </label>
      </div>
    </div>
  )
}

function AVStep3Ownership({ form, set, errors }: { form: AddVehicleForm; set: <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => void; errors: Record<string, string> }) {
  const inp = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none focus:border-amber-500/40 transition-colors'
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">Ownership</h2>
        <p className="text-xs text-[#64748b] mt-0.5">Is this vehicle owned by your company or an independent owner-operator?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { val: 'company' as const, label: 'Company-owned', sub: 'Asset is on your company authority and liability', icon: '🏢' },
          { val: 'owner-op' as const, label: 'Owner-operator', sub: "Leased under your authority from an independent O/O", icon: '👤' },
        ].map(opt => (
          <button key={opt.val} type="button" onClick={() => set('ownerType', opt.val)}
            className={`px-4 py-4 rounded border text-left transition-all ${form.ownerType === opt.val ? 'border-amber-500/50' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
            style={{ background: form.ownerType === opt.val ? '#f59e0b08' : 'var(--card)' }}>
            <div className="text-xl mb-2">{opt.icon}</div>
            <div className={`text-sm font-semibold ${form.ownerType === opt.val ? 'text-amber-300' : 'text-[#94a3b8]'}`}>{opt.label}</div>
            <div className="text-xs text-[#475569] mt-1 leading-relaxed">{opt.sub}</div>
          </button>
        ))}
      </div>

      {form.ownerType === 'owner-op' && (
        <div className="rounded border border-[#1e2d47] p-4 space-y-3" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">Owner-operator details</div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Full name <span className="text-amber-400">*</span></label>
            <input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} placeholder="e.g. David Okonkwo" className={`${inp} ${errors.ownerName ? 'border-red-500/50' : ''}`} />
            {errors.ownerName && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors.ownerName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Phone <span className="text-amber-400">*</span></label>
              <input type="tel" value={form.ownerPhone} onChange={e => set('ownerPhone', e.target.value)} placeholder="(555) 000-0000" className={`${inp} ${errors.ownerPhone ? 'border-red-500/50' : ''}`} />
              {errors.ownerPhone && <p className="text-xs text-red-400 mt-0.5 font-mono">{errors.ownerPhone}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Email</label>
              <input type="email" value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} placeholder="owner@example.com" className={inp} />
            </div>
          </div>
          <div className="rounded bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-300">
            Owner-operator lease agreement and W-9 will be sent via the Onboarding flow after adding.
          </div>
        </div>
      )}

      {form.ownerType === 'company' && (
        <div className="rounded border border-[#1e2d47] px-4 py-3 text-xs text-[#64748b]" style={{ background: 'var(--card)' }}>
          Vehicle will be added under <span className="text-[#94a3b8] font-medium">iWay Dispatch LLC</span> company authority and assigned to your fleet's USDOT number.
        </div>
      )}
    </div>
  )
}

function AVStep4Docs({ form, set, errors: _errors }: { form: AddVehicleForm; set: <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => void; errors: Record<string, string> }) {
  const inp = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none focus:border-amber-500/40 transition-colors'
  const docUploads = [
    { key: 'registrationUploaded' as const, label: 'Registration / cab card', note: 'Current state registration or apportioned cab card', required: true, uploaded: form.registrationUploaded },
    { key: 'annualDotUploaded' as const, label: 'Annual DOT inspection', note: 'Current annual inspection report and expiration', required: true, uploaded: form.annualDotUploaded },
    { key: 'liabilityUploaded' as const, label: 'Auto liability insurance', note: 'Certificate showing the vehicle and required limits', required: true, uploaded: form.liabilityUploaded },
    { key: 'cargoUploaded' as const, label: 'Cargo insurance', note: 'Cargo coverage certificate when carried by this vehicle', required: true, uploaded: form.cargoUploaded },
    { key: 'physicalDamageUploaded' as const, label: 'Physical damage / collision', note: 'Comprehensive and collision coverage', required: form.ownerType === 'owner-op', uploaded: form.physicalDamageUploaded },
    { key: 'nonTruckingLiabilityUploaded' as const, label: 'Non-trucking liability', note: 'Required for owner-operators when operating off dispatch', required: form.ownerType === 'owner-op', uploaded: form.nonTruckingLiabilityUploaded },
    ...(form.ownerType === 'owner-op'
      ? [{ key: 'leaseAgreementUploaded' as const, label: 'Lease agreement', note: 'Executed lease between the owner and carrier', required: true, uploaded: form.leaseAgreementUploaded }]
      : []),
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-[#e8edf5]">Insurance + documents</h2>
        <p className="text-xs text-[#64748b] mt-0.5">Upload certificates now or skip and add via Compliance later.</p>
      </div>

      {/* Insurance details */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Insurance details (optional)</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1.5">Insurance carrier</label>
            <input value={form.insuranceCarrier} onChange={e => set('insuranceCarrier', e.target.value)} placeholder="e.g. Progressive Commercial" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1.5">Policy number</label>
            <input value={form.policyNum} onChange={e => set('policyNum', e.target.value)} placeholder="POL-00000000" className={inp} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748b] mb-1.5">Policy expiration</label>
          <input type="date" value={form.policyExp} onChange={e => set('policyExp', e.target.value)} className="w-48 px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40 transition-colors" />
        </div>
      </div>

      <div className="border-t border-[#1e2d47]" />

      {/* Document uploads */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Certificate uploads</div>
        {docUploads.map(d => (
          <div key={d.key} className="flex items-center justify-between px-4 py-3 rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm text-[#94a3b8]">{d.label}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${d.required ? 'bg-amber-500/10 text-amber-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>
                  {d.required ? 'Required' : 'Optional'}
                </span>
              </div>
              <div className="text-xs text-[#475569] mt-0.5">{d.uploaded ? `PDF uploaded · ${d.note}` : `${d.note} · Add now or later via Compliance`}</div>
            </div>
            {d.uploaded ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-400 font-mono">Uploaded</span>
                <button onClick={() => set(d.key, false)} className="text-xs text-[#475569] hover:text-red-400 transition-colors">Remove</button>
              </div>
            ) : (
              <button onClick={() => set(d.key, true)}
                className="text-xs px-3 py-1.5 rounded border border-[#2a3a54] text-[#64748b] hover:text-[#94a3b8] hover:border-[#3a4a64] transition-all">
                Upload PDF
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="rounded border border-[#1e2d47] px-4 py-3 space-y-2 text-xs" style={{ background: 'var(--card)' }}>
        <div className="font-mono font-semibold text-[#475569] uppercase tracking-wide mb-1">Vehicle summary</div>
        <div className="flex justify-between"><span className="text-[#64748b]">Unit</span><span className="font-mono text-[#94a3b8]">{form.unit || '(auto-assigned)'}</span></div>
        <div className="flex justify-between"><span className="text-[#64748b]">Type</span><span className="text-[#94a3b8]">
          {form.category === 'tractor' ? `Tractor · ${form.cabType}`
           : form.category === 'box-truck' ? `Box truck · ${form.truckSize}`
           : form.category === 'reefer-truck' ? `Reefer truck · ${form.truckSize}`
           : `Trailer · ${form.trailerSubtype}`}
        </span></div>
        <div className="flex justify-between"><span className="text-[#64748b]">Vehicle</span><span className="text-[#94a3b8]">{[form.year, form.make, form.model].filter(Boolean).join(' ') || '—'}</span></div>
        <div className="flex justify-between"><span className="text-[#64748b]">Plate</span><span className="font-mono text-[#94a3b8]">{form.plateState} · {form.plateNum || '—'}</span></div>
        <div className="flex justify-between"><span className="text-[#64748b]">Ownership</span><span className="text-[#94a3b8] capitalize">{form.ownerType === 'owner-op' ? `Owner-op · ${form.ownerName || '—'}` : 'Company-owned'}</span></div>
        <div className="flex justify-between"><span className="text-[#64748b]">Status after adding</span><span className="text-emerald-400">Available</span></div>
      </div>
    </div>
  )
}

function AVStep5Financial({ form, set, errors }: {
  form: AddVehicleForm
  set: <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => void
  errors: Record<string, string>
}) {
  const inputClass = 'w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40'
  const percentageSplit = form.driverPayMethod === 'percentage' && form.truckPayMethod === 'percentage'
  const driverPercent = Math.max(0, Math.min(100, Number(form.driverPayValue) || 0))
  const recurringDeductions = [
    { key: 'insuranceDeduction' as const, label: 'Driver insurance', note: 'Deducted once per pay week' },
    { key: 'trailerDeduction' as const, label: 'Trailer rental', note: 'Leave blank when not applicable' },
    { key: 'eldDeduction' as const, label: 'ELD service', note: 'Recurring weekly service fee' },
    { key: 'escrowDeduction' as const, label: 'Escrow installment', note: 'Applied until escrow target is met' },
  ]
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-[#e8edf5]">Financial settings</h2>
        <p className="text-xs text-[#64748b] mt-1">Define how load revenue is shared between the assigned driver and truck owner, then add recurring deductions.</p>
      </div>

      <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-[#e8edf5]">Load revenue allocation</div>
            <div className="text-xs text-[#64748b] mt-0.5">Calculated from gross linehaul and eligible accessorials</div>
          </div>
          {percentageSplit && (
            <span className={`text-xs font-mono px-2 py-1 rounded ${Number(form.driverPayValue) + Number(form.truckPayValue) === 100 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {Number(form.driverPayValue) + Number(form.truckPayValue)}% allocated
            </span>
          )}
        </div>
        {percentageSplit && (
          <div className="h-3 rounded-full overflow-hidden bg-[#1e2d47] flex mb-5">
            <div className="bg-blue-500 transition-all" style={{ width: `${driverPercent}%` }} />
            <div className="bg-amber-500 flex-1" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {[
            { title: 'Driver payment', methodKey: 'driverPayMethod' as const, valueKey: 'driverPayValue' as const, color: 'text-blue-400' },
            { title: 'Truck / owner payment', methodKey: 'truckPayMethod' as const, valueKey: 'truckPayValue' as const, color: 'text-amber-400' },
          ].map(payment => (
            <div key={payment.title} className="rounded border border-[#1e2d47] p-4 bg-[#0d1424]">
              <div className={`text-sm font-semibold mb-3 ${payment.color}`}>{payment.title}</div>
              <label className="block mb-3">
                <span className="block text-xs text-[#64748b] mb-1.5">Pay method</span>
                <select value={form[payment.methodKey]} onChange={event => set(payment.methodKey, event.target.value as AddVehicleForm[typeof payment.methodKey])} className={inputClass}>
                  <option value="percentage">Percentage of gross</option>
                  <option value="per-mile">Per loaded mile</option>
                  <option value="flat">Flat amount per load</option>
                </select>
              </label>
              <label className="block">
                <span className="block text-xs text-[#64748b] mb-1.5">Value</span>
                <div className="flex items-center rounded border border-[#1e2d47] bg-[#070c18]">
                  {form[payment.methodKey] !== 'percentage' && <span className="pl-3 text-[#64748b]">$</span>}
                  <input type="number" min="0" value={form[payment.valueKey]} onChange={event => set(payment.valueKey, event.target.value)} className="w-full px-3 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" />
                  {form[payment.methodKey] === 'percentage' && <span className="pr-3 text-[#64748b]">%</span>}
                  {form[payment.methodKey] === 'per-mile' && <span className="pr-3 text-[#64748b]">/mi</span>}
                </div>
              </label>
            </div>
          ))}
        </div>
        {(errors.driverPayValue || errors.truckPayValue || errors.paySplit) && (
          <div className="text-xs text-red-400 font-mono mt-3">{errors.paySplit || errors.driverPayValue || errors.truckPayValue}</div>
        )}
      </div>

      <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
        <div className="mb-4">
          <div className="text-sm font-semibold text-[#e8edf5]">Recurring deductions</div>
          <div className="text-xs text-[#64748b] mt-0.5">These deductions appear on the driver or owner settlement once per pay week.</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {recurringDeductions.map(deduction => (
            <label key={deduction.key}>
              <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">{deduction.label}</span>
              <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]">
                <span className="pl-3 text-[#64748b]">$</span>
                <input type="number" min="0" value={form[deduction.key]} onChange={event => set(deduction.key, event.target.value)} placeholder="0.00" className="w-full px-2 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" />
              </div>
              <span className="block text-[10px] text-[#475569] mt-1">{deduction.note}</span>
            </label>
          ))}
        </div>
        <button type="button" onClick={() => set('fuelCardDeduction', !form.fuelCardDeduction)} className={`w-full mt-4 flex items-center justify-between rounded border px-4 py-3 ${form.fuelCardDeduction ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-[#1e2d47]'}`}>
          <span className="text-left"><span className="block text-sm text-[#e8edf5]">Deduct fuel card transactions</span><span className="block text-xs text-[#64748b] mt-0.5">Actual card charges are imported into the weekly settlement</span></span>
          <span className={`w-9 h-5 rounded-full p-0.5 ${form.fuelCardDeduction ? 'bg-emerald-500' : 'bg-[#1e2d47]'}`}><span className={`block w-4 h-4 rounded-full bg-white transition-transform ${form.fuelCardDeduction ? 'translate-x-4' : ''}`} /></span>
        </button>
      </div>
    </div>
  )
}

function AVStep6Driver({ form, set, errors }: {
  form: AddVehicleForm
  set: <K extends keyof AddVehicleForm>(k: K, v: AddVehicleForm[K]) => void
  errors: Record<string, string>
}) {
  const choices = [...AVAILABLE_DRIVERS.filter(driver => driver.status !== 'Onboarding'), { id: 'later', name: 'Assign later', initials: '—', cdl: 'Vehicle remains available', phone: '', status: 'Available', miles: 0 }]
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-[#e8edf5]">Assign driver</h2>
        <p className="text-xs text-[#64748b] mt-1">Assign one primary driver to this truck. The assignment can be changed later from Assets or Load Manager.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {choices.map(driver => {
          const selected = form.assignedDriver === driver.name
          return (
            <button key={driver.id} type="button" onClick={() => set('assignedDriver', driver.name)} className={`flex items-center gap-3 rounded border p-4 text-left ${selected ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}>
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selected ? 'bg-amber-500 text-[#070c18]' : 'bg-[#1e2d47] text-[#64748b]'}`}>{driver.initials}</span>
              <span className="min-w-0"><span className={`block text-sm font-semibold ${selected ? 'text-amber-300' : 'text-[#94a3b8]'}`}>{driver.name}</span><span className="block text-xs text-[#475569] mt-0.5 truncate">{driver.cdl}{driver.phone ? ` · ${driver.phone}` : ''}</span></span>
            </button>
          )
        })}
      </div>
      {errors.assignedDriver && <div className="text-xs text-red-400 font-mono">{errors.assignedDriver}</div>}
    </div>
  )
}

function AVStep7Review({ form }: { form: AddVehicleForm }) {
  const vehicleType = form.category === 'tractor' ? `Tractor · ${form.cabType}` : form.category === 'trailer' ? `Trailer · ${form.trailerSubtype}` : `${form.category.replace('-', ' ')} · ${form.truckSize}`
  const deductions = [
    ['Insurance', form.insuranceDeduction],
    ['Trailer rental', form.trailerDeduction],
    ['ELD service', form.eldDeduction],
    ['Escrow', form.escrowDeduction],
  ].filter(([, value]) => value)
  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-[#e8edf5]">Review + approve</h2>
        <p className="text-xs text-[#64748b] mt-1">Confirm ownership, vehicle compliance, financial allocation and driver assignment before activating the truck.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: 'Owner', rows: [['Ownership', form.ownerType === 'company' ? 'Company-owned' : 'Owner-operator'], ['Legal owner', form.ownerType === 'company' ? 'Current Way Logistics' : form.ownerName]] },
          { title: 'Vehicle', rows: [['Unit', form.unit], ['Vehicle', `${form.year} ${form.make} ${form.model}`], ['Type', vehicleType], ['Plate', `${form.plateState} · ${form.plateNum}`]] },
          { title: 'Payment split', rows: [['Driver', `${form.driverPayValue}${form.driverPayMethod === 'percentage' ? '%' : form.driverPayMethod === 'per-mile' ? '/mi' : ' flat'}`], ['Truck / owner', `${form.truckPayValue}${form.truckPayMethod === 'percentage' ? '%' : form.truckPayMethod === 'per-mile' ? '/mi' : ' flat'}`], ['Assigned driver', form.assignedDriver]] },
          {
            title: 'Documents',
            rows: [
              ['Registration / cab card', form.registrationUploaded ? 'Uploaded' : 'Required'],
              ['Annual DOT inspection', form.annualDotUploaded ? 'Uploaded' : 'Required'],
              ['Auto liability', form.liabilityUploaded ? 'Uploaded' : 'Required'],
              ['Cargo insurance', form.cargoUploaded ? 'Uploaded' : 'Required'],
              ['Physical damage', form.physicalDamageUploaded ? 'Uploaded' : form.ownerType === 'owner-op' ? 'Required' : 'Optional'],
              ['Non-trucking liability', form.nonTruckingLiabilityUploaded ? 'Uploaded' : form.ownerType === 'owner-op' ? 'Required' : 'Optional'],
              ...(form.ownerType === 'owner-op' ? [['Lease agreement', form.leaseAgreementUploaded ? 'Uploaded' : 'Required']] : []),
            ],
          },
        ].map(section => (
          <div key={section.title} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">{section.title}</div>
            <div className="space-y-2">{section.rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-xs"><span className="text-[#64748b]">{label}</span><span className="text-[#e8edf5] text-right">{value || '—'}</span></div>)}</div>
          </div>
        ))}
      </div>
      <div className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
        <div className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">Weekly deductions</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
          {deductions.map(([label, value]) => <div key={label} className="flex justify-between text-xs"><span className="text-[#64748b]">{label}</span><span className="font-mono text-red-400">−${Number(value).toFixed(2)}</span></div>)}
          <div className="flex justify-between text-xs"><span className="text-[#64748b]">Fuel card</span><span className={form.fuelCardDeduction ? 'text-emerald-400' : 'text-[#475569]'}>{form.fuelCardDeduction ? 'Actual charges' : 'Not deducted'}</span></div>
        </div>
      </div>
      <div className="rounded border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">Approval activates the vehicle for dispatch and applies these financial settings to future settlements.</div>
    </div>
  )
}

/* ── Directory ── */
function DirectoryScreen() {
  const [tab, setTab] = useState<'brokers' | 'shippers' | 'factoring'>('brokers')
  const [selected, setSelected] = useState('Summit Freight')
  const BROKERS = [
    { name: 'Summit Freight', mc: 'MC 845210', terms: 'Net 30', avgDays: 34 },
    { name: 'Northline Brokerage', mc: 'MC 603118', terms: 'Net 30', avgDays: 41 },
    { name: 'Crossroads Logistics', mc: 'MC 771904', terms: 'Quick pay', avgDays: 3 },
    { name: 'Blue Ridge Transport', mc: 'MC 512377', terms: 'Net 45', avgDays: 58 },
    { name: 'Gulfline Freight', mc: 'MC 699045', terms: 'Net 30', avgDays: 29 },
    { name: 'Prairie Crossing', mc: 'MC 430981', terms: 'Net 30', avgDays: 0 },
  ]
  const daysColor = (d: number) => d === 0 ? '#64748b' : d < 20 ? '#10b981' : d < 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8edf5]">Directory</h1>
        <button className="px-4 py-2 rounded text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>+ Add broker</button>
      </div>
      <div className="flex gap-2">
        {[{ id: 'brokers', label: 'Brokers · 23' }, { id: 'shippers', label: 'Shippers + receivers · 64' }, { id: 'factoring', label: 'Factoring companies · 2' }].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)} className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${tab === t.id ? 'bg-[#1e3a5f] text-blue-300 border border-blue-500/40' : 'border border-[#1e2d47] text-[#64748b]'}`}>{t.label}</button>
        ))}
      </div>
      {tab === 'brokers' && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
            <div className="p-3"><input placeholder="Search brokers" className="w-full bg-transparent text-xs text-[#94a3b8] placeholder-[#475569] border border-[#1e2d47] rounded px-3 py-2 focus:outline-none" /></div>
            <div className="divide-y divide-[#1e2d47]">
              {BROKERS.map((b) => (
                <button key={b.name} onClick={() => setSelected(b.name)} className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${selected === b.name ? 'bg-[#111827]' : 'hover:bg-[#0d1424]'}`}>
                  <div>
                    <div className={`text-sm font-medium ${selected === b.name ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{b.name}</div>
                    <div className="text-xs text-[#475569] mt-0.5">{b.mc} · {b.terms}</div>
                  </div>
                  {b.avgDays > 0 && <span className="text-xs font-mono font-semibold" style={{ color: daysColor(b.avgDays) }}>{b.avgDays} days</span>}
                  {b.avgDays === 0 && <span className="text-xs text-emerald-400 font-mono">New</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="col-span-3 rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-[#e8edf5]">{selected}</h2>
                <div className="text-xs text-[#64748b] mt-0.5">Broker · MC 845210 · Dallas, TX · customer since Mar 2022</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded">Credit approved</span>
                <button className="text-xs border border-[#1e2d47] text-[#64748b] px-3 py-1.5 rounded hover:bg-[#111827]">Edit</button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[['Loads this year', '46'], ['Revenue this year', '$118,400'], ['Open invoices', '$9,870'], ['Avg days to pay', '34']].map(([l, v]) => (
                <div key={l} className="rounded border border-[#1e2d47] p-3" style={{ background: 'var(--muted)' }}>
                  <div className="text-xs text-[#475569]">{l}</div>
                  <div className="text-base font-bold font-mono text-[#e8edf5] mt-0.5">{v}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-2">
                <div className="text-[#475569] font-medium uppercase tracking-wide text-xs mb-2">Billing</div>
                {[['Bill To email', 'ap@summitfreight.example'], ['Payment terms', 'Net 30'], ['Factored loads', 'Yes · via factor'], ['Tracking updates', 'Link + email every stop']].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-[#475569]">{k}</span>
                    <span className="text-[#94a3b8] text-right max-w-[60%]">{v}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[#475569] font-medium uppercase tracking-wide text-xs mb-2">Recent loads</div>
                <div className="space-y-2">
                  {[['LD-10482', 'Dallas → Memphis', 'In transit', '$2,450'],
                    ['LD-10477', 'Fort Worth → Tulsa', 'Assigned', '$1,280'],
                    ['LD-10459', 'Memphis → Houston', 'Completed', '$3,860']].map(([id, route, s, r]) => (
                    <div key={id} className="flex items-center gap-2">
                      <span className="font-mono text-amber-400">{id}</span>
                      <span className="text-[#475569] flex-1 truncate">{route}</span>
                      <span className={`text-xs ${s === 'Completed' ? 'text-emerald-400' : s === 'In transit' ? 'text-blue-400' : 'text-amber-400'}`}>{s}</span>
                      <span className="font-mono text-[#64748b]">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {tab !== 'brokers' && (
        <div className="rounded border border-[#1e2d47] p-8 text-center text-[#475569] text-sm" style={{ background: 'var(--card)' }}>
          {tab === 'shippers' ? 'Shippers + receivers directory — 64 facilities' : 'Factoring companies — 2 active'}
        </div>
      )}
    </div>
  )
}

/* ── Accounting ── */
function AccountingScreen() {
  const { loads: operationLoads, financialSettings } = useOperations()
  const [payees, setPayees] = useState([
    {
      name: 'J. Carter', role: 'Driver · T-104', status: 'Initiated', terms: 'Third-party owned · Driver share 28%',
      loads: [
        { id: 'LD-10482', route: 'Dallas, TX → Memphis, TN', pickup: 'Sep 22', miles: 452, gross: 2450, share: 686, tonu: false },
        { id: 'LD-10468', route: 'Dallas, TX → Little Rock, AR', pickup: 'Sep 23', miles: 0, gross: 250, share: 70, tonu: true },
        { id: 'LD-10459', route: 'Memphis, TN → Houston, TX', pickup: 'Sep 25', miles: 586, gross: 3860, share: 1080.80, tonu: false },
      ],
      deductions: [['Fuel card (weekly)', 349.60], ['Insurance', 150], ['Escrow installment', 100], ['Cash advance Sep 24', 50]] as [string, number][],
      note: 'Escrow: $400 paid of $1,000 target',
    },
    {
      name: 'Crossway Trucking LLC', role: 'Owner · T-104', status: 'Initiated', terms: 'Owner settlement · 72% of linehaul',
      loads: [
        { id: 'LD-10482', route: 'Dallas, TX → Memphis, TN', pickup: 'Sep 22', miles: 452, gross: 2450, share: 1764, tonu: false },
        { id: 'LD-10459', route: 'Memphis, TN → Houston, TX', pickup: 'Sep 25', miles: 586, gross: 3860, share: 2779.20, tonu: false },
      ],
      deductions: [['Liability insurance', 225], ['Trailer rental', 175], ['ELD service', 35]] as [string, number][],
      note: 'Paid by ACH · Account ending 4482',
    },
    {
      name: 'R. Diaz', role: 'Driver · T-112', status: 'Approved', terms: 'Company driver · $0.62 per loaded mile',
      loads: [
        { id: 'LD-10479', route: 'Houston, TX → Atlanta, GA', pickup: 'Sep 23', miles: 793, gross: 3100, share: 491.66, tonu: false },
        { id: 'LD-10463', route: 'Atlanta, GA → Mobile, AL', pickup: 'Sep 26', miles: 328, gross: 1420, share: 203.36, tonu: false },
      ],
      deductions: [['Cash advance Sep 22', 75]] as [string, number][],
      note: 'Approved Sep 28 by M. Owens',
    },
    {
      name: 'A. Bekele', role: 'Driver · T-108', status: 'Initiated', terms: 'Company driver · 26% of linehaul',
      loads: [
        { id: 'LD-10477', route: 'Fort Worth, TX → Tulsa, OK', pickup: 'Sep 24', miles: 272, gross: 1280, share: 332.80, tonu: false },
        { id: 'LD-10466', route: 'Tulsa, OK → Dallas, TX', pickup: 'Sep 26', miles: 258, gross: 1175, share: 305.50, tonu: false },
      ],
      deductions: [['Insurance', 85], ['Fuel advance', 120]] as [string, number][],
      note: 'No outstanding escrow balance',
    },
    {
      name: 'M. Okafor', role: 'Driver + owner · T-101', status: 'Approved', terms: 'Owner-operator · 82% of linehaul',
      loads: [
        { id: 'LD-10471', route: 'Austin, TX → Denver, CO', pickup: 'Sep 22', miles: 920, gross: 3420, share: 2804.40, tonu: false },
        { id: 'LD-10461', route: 'Denver, CO → Amarillo, TX', pickup: 'Sep 25', miles: 437, gross: 2050, share: 1681, tonu: false },
      ],
      deductions: [['Fuel card', 812.44], ['Occupational accident', 68], ['ELD service', 35]] as [string, number][],
      note: 'Approved Sep 28 by M. Owens',
    },
    {
      name: 'K. Brooks', role: 'Driver · T-109', status: 'Initiated', terms: 'Company driver · $0.60 per loaded mile',
      loads: [
        { id: 'LD-10474', route: 'Dallas, TX → Shreveport, LA', pickup: 'Sep 24', miles: 188, gross: 950, share: 112.80, tonu: false },
      ],
      deductions: [['Insurance', 62.50]] as [string, number][],
      note: 'First settlement · Direct deposit pending verification',
    },
  ])
  const [selected, setSelected] = useState('J. Carter')
  const [accountingAction, setAccountingAction] = useState<'adjustment' | 'move' | null>(null)
  const [adjustmentLabel, setAdjustmentLabel] = useState('')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'deduction' | 'reimbursement'>('deduction')
  const [moveLoadId, setMoveLoadId] = useState('')
  const [targetWeek, setTargetWeek] = useState('Sep 28 – Oct 4, 2026')
  const [actionError, setActionError] = useState('')
  const [nextWeekLoads, setNextWeekLoads] = useState<{
    id: string
    route: string
    pickup: string
    miles: number
    gross: number
    share: number
    payee: string
    role: string
    targetWeek: string
  }[]>([])
  const [payWeekView, setPayWeekView] = useState<'previous' | 'current' | 'next'>('current')
  const [settlementSearch, setSettlementSearch] = useState('')
  const previousSettlements = [
    { id: 'STL-0920-001', payee: 'J. Carter', role: 'Driver · T-104', week: 'Sep 14 – 20, 2026', status: 'Approved', approvedDate: 'Sep 23, 2026', gross: 1654.80, deductions: 599.60, net: 1055.20, loads: ['LD-10441', 'LD-10436', 'LD-10429'] },
    { id: 'STL-0920-002', payee: 'Crossway Trucking LLC', role: 'Owner · T-104', week: 'Sep 14 – 20, 2026', status: 'Approved', approvedDate: 'Sep 23, 2026', gross: 4255.20, deductions: 435, net: 3820.20, loads: ['LD-10441', 'LD-10436'] },
    { id: 'STL-0920-003', payee: 'R. Diaz', role: 'Driver · T-112', week: 'Sep 14 – 20, 2026', status: 'Approved', approvedDate: 'Sep 22, 2026', gross: 1218.42, deductions: 75, net: 1143.42, loads: ['LD-10438', 'LD-10431'] },
    { id: 'STL-0913-004', payee: 'A. Bekele', role: 'Driver · T-108', week: 'Sep 7 – 13, 2026', status: 'Approved', approvedDate: 'Sep 16, 2026', gross: 986.70, deductions: 205, net: 781.70, loads: ['LD-10417', 'LD-10409'] },
    { id: 'STL-0913-005', payee: 'K. Brooks', role: 'Driver · T-109', week: 'Sep 7 – 13, 2026', status: 'Voided', approvedDate: '—', gross: 510, deductions: 62.50, net: 447.50, loads: ['LD-10412'] },
  ]
  const [pdfSettlement, setPdfSettlement] = useState<(typeof previousSettlements)[number] | null>(null)
  const filteredPreviousSettlements = previousSettlements.filter(settlement => {
    const query = settlementSearch.trim().toLowerCase()
    return !query || [settlement.id, settlement.payee, settlement.role, settlement.week, ...settlement.loads]
      .some(value => value.toLowerCase().includes(query))
  })

  useEffect(() => {
    const completedLoads = operationLoads.filter(load => load.status === 'Completed')
    if (completedLoads.length === 0) return
    setPayees(current => {
      const next = [...current]
      completedLoads.forEach(load => {
        if (!next.some(payee => payee.loads.some(existingLoad => existingLoad.id === load.id))) {
          const route = load.stops.map(stop => `${stop.city}, ${stop.state}`).filter(location => location !== ', ').join(' → ')
          const pickup = load.stops.find(stop => stop.type === 'PICKUP')?.date || 'Completed'
          next.unshift({
            name: load.driver,
            role: `Driver · ${load.truck}`,
            status: 'Initiated',
            terms: `Driver financial setting · ${financialSettings.driverPercent}% of gross`,
            loads: [{
              id: load.id,
              route,
              pickup,
              miles: load.miles,
              gross: load.rate,
              share: load.rate * (financialSettings.driverPercent / 100),
              tonu: false,
            }],
            deductions: financialSettings.driverWeeklyDeduction > 0
              ? [['Driver weekly deduction', financialSettings.driverWeeklyDeduction]]
              : [],
            note: `Created automatically when ${load.id} was completed by the driver`,
          })
          next.unshift({
            name: `Owner · ${load.truck}`,
            role: `Truck settlement · ${load.truck}`,
            status: 'Initiated',
            terms: `Truck financial setting · ${financialSettings.truckPercent}% of gross`,
            loads: [{
              id: load.id,
              route,
              pickup,
              miles: load.miles,
              gross: load.rate,
              share: load.rate * (financialSettings.truckPercent / 100),
              tonu: false,
            }],
            deductions: financialSettings.truckWeeklyDeduction > 0
              ? [['Truck weekly deduction', financialSettings.truckWeeklyDeduction]]
              : [],
            note: `Created automatically from completed load ${load.id}`,
          })
        }
      })
      return next
    })
  }, [operationLoads, financialSettings])

  const selectedPayee = payees.find(payee => payee.name === selected) || payees[0]
  const grossShare = selectedPayee.loads.reduce((sum, load) => sum + load.share, 0)
  const deductions = selectedPayee.deductions.reduce((sum, deduction) => sum + deduction[1], 0)
  const netPay = grossShare - deductions

  function openAdjustment() {
    setAdjustmentLabel('')
    setAdjustmentAmount('')
    setAdjustmentType('deduction')
    setActionError('')
    setAccountingAction('adjustment')
  }

  function addAdjustment() {
    const amount = Number(adjustmentAmount)
    if (!adjustmentLabel.trim()) {
      setActionError('Enter a description for this adjustment')
      return
    }
    if (!amount || amount <= 0) {
      setActionError('Enter an amount greater than zero')
      return
    }
    const signedAmount = adjustmentType === 'deduction' ? amount : -amount
    setPayees(current => current.map(payee => payee.name === selectedPayee.name
      ? { ...payee, deductions: [...payee.deductions, [adjustmentLabel.trim(), signedAmount] as [string, number]] }
      : payee))
    setAccountingAction(null)
  }

  function openMoveLoad() {
    setMoveLoadId(selectedPayee.loads[0]?.id || '')
    setTargetWeek('Sep 28 – Oct 4, 2026')
    setActionError('')
    setAccountingAction('move')
  }

  function moveLoad() {
    if (!moveLoadId) {
      setActionError('Select a load to move')
      return
    }
    const movedLoad = selectedPayee.loads.find(load => load.id === moveLoadId)
    if (movedLoad && targetWeek !== 'Sep 14 – 20, 2026') {
      setNextWeekLoads(current => [
        ...current.filter(load => !(load.id === movedLoad.id && load.payee === selectedPayee.name)),
        {
          ...movedLoad,
          payee: selectedPayee.name,
          role: selectedPayee.role,
          targetWeek,
        },
      ])
    }
    setPayees(current => current.map(payee => payee.name === selectedPayee.name
      ? {
          ...payee,
          loads: payee.loads.filter(load => load.id !== moveLoadId),
          note: movedLoad ? `${movedLoad.id} moved to pay week ${targetWeek}` : payee.note,
        }
      : payee))
    setAccountingAction(null)
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8edf5]">Settlements</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            {payWeekView === 'previous' ? 'Previous settlement archive' : payWeekView === 'current' ? 'Pay week Sep 21 – 27, 2026' : 'Pay week Sep 28 – Oct 4, 2026'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {payWeekView === 'current' && (
            <div className="text-xs text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded font-mono bg-amber-500/10">
              Cut-off Wed, Sep 30 · 3 days left
            </div>
          )}
          {payWeekView === 'previous' && (
            <button className="text-xs px-3 py-2 border border-[#1e2d47] text-[#64748b] rounded hover:bg-[#111827]">Export approved PDFs</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { id: 'previous' as const, number: '1', label: 'Previous pay week', date: 'Sep 14 – 20', detail: 'Approved archive' },
          { id: 'current' as const, number: '2', label: 'Current pay week', date: 'Sep 21 – 27', detail: `${payees.filter(payee => payee.status !== 'Approved').length} awaiting approval` },
          { id: 'next' as const, number: '3', label: 'Next pay week', date: 'Sep 28 – Oct 4', detail: 'Upcoming' },
        ].map(week => (
          <button
            key={week.id}
            onClick={() => setPayWeekView(week.id)}
            className={`rounded border p-4 text-left transition-all ${payWeekView === week.id ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47] hover:border-[#2a3a54]'}`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${payWeekView === week.id ? 'bg-amber-500 text-[#070c18]' : 'bg-[#1e2d47] text-[#64748b]'}`}>{week.number}</span>
              <div>
                <div className={`text-sm font-semibold ${payWeekView === week.id ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{week.label}</div>
                <div className="text-xs text-[#64748b] mt-0.5">{week.date} · {week.detail}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {payWeekView === 'previous' && (
        <div className="rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[#1e2d47]">
            <div>
              <div className="text-sm font-semibold text-[#e8edf5]">Previous settlements</div>
              <div className="text-xs text-[#64748b] mt-0.5">Search by payee, settlement ID, truck, pay week or load</div>
            </div>
            <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424] w-72">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[#475569] ml-3 shrink-0">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                value={settlementSearch}
                onChange={event => setSettlementSearch(event.target.value)}
                placeholder="Search settlements"
                className="w-full px-2.5 py-2 bg-transparent text-xs text-[#e8edf5] placeholder-[#475569] focus:outline-none"
              />
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1e2d47]">
                {['SETTLEMENT', 'PAYEE', 'PAY WEEK', 'LOADS', 'NET PAY', 'STATUS', 'PDF'].map(header => (
                  <th key={header} className="text-left px-4 py-3 text-[#475569] font-medium">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {filteredPreviousSettlements.map(settlement => (
                <tr key={settlement.id} className="hover:bg-[#111827]">
                  <td className="px-4 py-3 font-mono text-amber-400">{settlement.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-[#e8edf5] font-medium">{settlement.payee}</div>
                    <div className="text-[#475569] mt-0.5">{settlement.role}</div>
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{settlement.week}</td>
                  <td className="px-4 py-3 font-mono text-[#64748b]">{settlement.loads.length}</td>
                  <td className="px-4 py-3 font-mono text-[#e8edf5]">${settlement.net.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded font-medium ${settlement.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{settlement.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={settlement.status !== 'Approved'}
                      onClick={() => setPdfSettlement(settlement)}
                      className={`px-3 py-1.5 rounded border font-medium ${settlement.status === 'Approved' ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10' : 'border-[#1e2d47] text-[#475569] cursor-not-allowed'}`}
                    >
                      Open PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredPreviousSettlements.length === 0 && (
            <div className="py-10 text-center text-sm text-[#475569]">No previous settlements match “{settlementSearch}”.</div>
          )}
        </div>
      )}

      {payWeekView === 'next' && (
        <div className="rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47]">
            <div>
              <div className="text-sm font-semibold text-[#e8edf5]">Next pay week loads · {nextWeekLoads.length}</div>
              <div className="text-xs text-[#64748b] mt-0.5">Moved loads and newly completed work scheduled for the next settlement period</div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400">Preparing</span>
          </div>
          {nextWeekLoads.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2d47]">
                  {['LOAD', 'PAYEE', 'ROUTE', 'PICKUP', 'PAY WEEK', 'GROSS', 'PAYEE SHARE'].map(header => (
                    <th key={header} className="text-left px-4 py-3 text-[#475569] font-medium">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2d47]">
                {nextWeekLoads.map(load => (
                  <tr key={`${load.id}-${load.payee}`} className="hover:bg-[#111827]">
                    <td className="px-4 py-3 font-mono text-amber-400">{load.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-[#e8edf5] font-medium">{load.payee}</div>
                      <div className="text-[#475569] mt-0.5">{load.role}</div>
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{load.route}</td>
                    <td className="px-4 py-3 text-[#64748b]">{load.pickup}</td>
                    <td className="px-4 py-3 text-blue-400">{load.targetWeek}</td>
                    <td className="px-4 py-3 font-mono text-[#64748b]">${load.gross.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-[#e8edf5]">${load.share.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" className="w-5 h-5">
                  <path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14H3V6a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-[#e8edf5]">Next pay week is ready</div>
              <div className="text-xs text-[#64748b] mt-1">Loads completed Sep 28 – Oct 4 or moved from the current week will appear here.</div>
            </div>
          )}
        </div>
      )}

      {payWeekView === 'current' && <div className="grid grid-cols-5 gap-4">
        {/* Payee list */}
        <div className="col-span-2 rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
          <div className="px-4 py-3 border-b border-[#1e2d47] text-sm font-semibold text-[#e8edf5]">Payees · {payees.length}</div>
          <div className="divide-y divide-[#1e2d47]">
            {payees.map((p) => {
              const payeeGross = p.loads.reduce((sum, load) => sum + load.share, 0)
              const payeeDeductions = p.deductions.reduce((sum, deduction) => sum + deduction[1], 0)
              return (
              <button key={p.name} onClick={() => setSelected(p.name)} className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all ${selected === p.name ? 'bg-[#111827]' : 'hover:bg-[#0d1424]'}`}>
                <div>
                  <div className={`text-sm font-medium ${selected === p.name ? 'text-[#e8edf5]' : 'text-[#94a3b8]'}`}>{p.name}</div>
                  <div className="text-xs text-[#475569] mt-0.5">{p.role}</div>
                  <div className="text-xs text-[#64748b] mt-1 font-mono">{p.loads.length} load{p.loads.length === 1 ? '' : 's'} · Net ${(payeeGross - payeeDeductions).toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${p.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{p.status}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={`w-3.5 h-3.5 ${selected === p.name ? 'text-amber-400' : 'text-[#475569]'}`}>
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </button>
              )
            })}
          </div>
        </div>

        {/* Settlement detail */}
        <div className="col-span-3 rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-[#e8edf5]">{selectedPayee.name} · Settlement detail</div>
            <span className={`text-xs px-2 py-0.5 rounded ${selectedPayee.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{selectedPayee.status}</span>
          </div>
          <div className="text-xs text-[#64748b] mb-4">{selectedPayee.role} · {selectedPayee.terms} · Current Way Logistics</div>

          <table className="w-full text-xs mb-4">
            <thead>
              <tr className="border-b border-[#1e2d47]">
                <th className="text-left py-2 text-[#475569]">LOAD</th>
                <th className="text-left py-2 text-[#475569]">ROUTE · PICKUP DATE</th>
                <th className="text-right py-2 text-[#475569]">MILES</th>
                <th className="text-right py-2 text-[#475569]">GROSS REVENUE</th>
                <th className="text-right py-2 text-[#475569]">DRIVER SHARE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d47]">
              {selectedPayee.loads.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 font-mono text-amber-400">{l.id}</td>
                  <td className="py-2.5 text-[#94a3b8]">{l.route} · {l.pickup}{l.tonu ? ' · TONU' : ''}</td>
                  <td className="py-2.5 text-right font-mono text-[#64748b]">{l.miles || '—'}</td>
                  <td className="py-2.5 text-right font-mono text-[#e8edf5]">${l.gross.toFixed(2)}</td>
                  <td className="py-2.5 text-right font-mono text-[#e8edf5]">${l.share.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-[#1e2d47] pt-3 space-y-1.5 text-xs mb-4">
            <div className="text-[#64748b] font-medium uppercase tracking-wide text-xs mb-2">Deductions (applied once per week)</div>
            {selectedPayee.deductions.map(([label, amount]) => (
              <div key={label} className="flex justify-between">
                <span className="text-[#64748b]">{label}</span>
                <span className={`font-mono ${amount < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {amount < 0 ? '+' : '−'}${Math.abs(amount).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="text-xs text-[#475569] mt-2">{selectedPayee.note}</div>
          </div>

          {/* Net pay box */}
          <div className="rounded p-4 mb-4" style={{ background: '#0d1a2e', border: '1px solid #1e2d47' }}>
            <div className="text-xs text-[#64748b] mb-1">Net pay</div>
            <div className="text-2xl font-bold font-mono text-[#e8edf5]">${netPay.toFixed(2)}</div>
            <div className="text-xs text-[#475569] mt-1">Gross share ${grossShare.toFixed(2)} – deductions ${deductions.toFixed(2)}</div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAdjustment}
              disabled={selectedPayee.status === 'Approved'}
              className={`px-4 py-2 rounded border border-[#1e2d47] text-xs ${
                selectedPayee.status === 'Approved'
                  ? 'text-[#475569] opacity-50 cursor-not-allowed'
                  : 'text-[#64748b] hover:text-[#94a3b8]'
              }`}
            >
              Add adjustment
            </button>
            <button
              onClick={openMoveLoad}
              disabled={selectedPayee.loads.length === 0}
              className={`px-4 py-2 rounded border border-[#1e2d47] text-xs ${selectedPayee.loads.length === 0 ? 'text-[#475569] opacity-50 cursor-not-allowed' : 'text-[#64748b] hover:text-[#94a3b8]'}`}
            >
              Move a load to another week
            </button>
            <button
              disabled={selectedPayee.status === 'Approved'}
              onClick={() => {
                recordSettlementEscrow(selectedPayee.name, selectedPayee.deductions)
                setPayees(current => current.map(payee => payee.name === selectedPayee.name ? { ...payee, status: 'Approved' } : payee))
              }}
              className={`px-4 py-2 rounded text-xs font-semibold ml-auto ${selectedPayee.status === 'Approved' ? 'bg-emerald-500/15 text-emerald-400 cursor-default' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
            >
              {selectedPayee.status === 'Approved' ? 'Settlement approved' : 'Approve settlement'}
            </button>
          </div>
        </div>
      </div>}

      {pdfSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setPdfSettlement(null)} />
          <div className="relative z-10 w-full max-w-2xl max-h-full overflow-y-auto rounded shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-[#111827] border-b border-[#1e2d47]">
              <div>
                <div className="text-sm font-semibold text-[#e8edf5]">{pdfSettlement.id}.pdf</div>
                <div className="text-xs text-[#64748b]">Approved settlement copy · Read only</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 rounded border border-[#1e2d47] text-xs text-[#94a3b8] hover:text-white">Print / Save PDF</button>
                <button onClick={() => setPdfSettlement(null)} className="text-[#64748b] hover:text-white" aria-label="Close PDF">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-white text-slate-900 p-10 min-h-[680px]">
              <div className="flex items-start justify-between border-b border-slate-200 pb-6">
                <div>
                  <div className="text-2xl font-bold">iWay Dispatch</div>
                  <div className="text-sm text-slate-500 mt-1">Current Way Logistics</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold tracking-wider text-slate-500">SETTLEMENT STATEMENT</div>
                  <div className="font-mono font-bold mt-1">{pdfSettlement.id}</div>
                  <div className="text-xs text-emerald-700 mt-1">APPROVED</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 py-6 border-b border-slate-200">
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Payee</div>
                  <div className="font-semibold mt-1">{pdfSettlement.payee}</div>
                  <div className="text-sm text-slate-500">{pdfSettlement.role}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase">Pay period</div>
                  <div className="font-semibold mt-1">{pdfSettlement.week}</div>
                  <div className="text-sm text-slate-500">Approved {pdfSettlement.approvedDate}</div>
                </div>
              </div>
              <div className="py-6">
                <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Included loads</div>
                <div className="border border-slate-200 rounded">
                  {pdfSettlement.loads.map((load, index) => (
                    <div key={load} className={`flex items-center justify-between px-4 py-3 ${index > 0 ? 'border-t border-slate-200' : ''}`}>
                      <span className="font-mono text-sm">{load}</span>
                      <span className="text-sm text-slate-500">Completed</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ml-auto w-72 space-y-3 border-t border-slate-200 pt-5">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Gross share</span><span className="font-mono">${pdfSettlement.gross.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-slate-500">Deductions</span><span className="font-mono text-red-700">−${pdfSettlement.deductions.toFixed(2)}</span></div>
                <div className="flex justify-between border-t border-slate-300 pt-3"><span className="font-semibold">Net pay</span><span className="font-mono text-xl font-bold">${pdfSettlement.net.toFixed(2)}</span></div>
              </div>
              <div className="mt-16 pt-4 border-t border-slate-200 text-xs text-slate-400">
                This approved settlement is a system-generated copy retained in the iWay audit record.
              </div>
            </div>
          </div>
        </div>
      )}

      {accountingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAccountingAction(null)} />
          <div className="relative z-10 w-full max-w-md rounded border border-[#1e2d47] shadow-2xl" style={{ background: 'var(--background)' }}>
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#1e2d47]">
              <div>
                <div className="text-base font-semibold text-[#e8edf5]">
                  {accountingAction === 'adjustment' ? 'Add settlement adjustment' : 'Move load to another week'}
                </div>
                <div className="text-xs text-[#64748b] mt-0.5">{selectedPayee.name} · {selectedPayee.role}</div>
              </div>
              <button onClick={() => setAccountingAction(null)} className="text-[#475569] hover:text-[#94a3b8]" aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
                  <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {accountingAction === 'adjustment' ? (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Adjustment type</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'deduction' as const, label: 'Deduction', sub: 'Reduces net pay' },
                      { value: 'reimbursement' as const, label: 'Reimbursement', sub: 'Increases net pay' },
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setAdjustmentType(option.value)}
                        className={`rounded border px-3 py-3 text-left ${adjustmentType === option.value ? 'border-amber-500/50 bg-amber-500/10' : 'border-[#1e2d47]'}`}
                      >
                        <span className={`block text-sm font-medium ${adjustmentType === option.value ? 'text-amber-300' : 'text-[#94a3b8]'}`}>{option.label}</span>
                        <span className="block text-xs text-[#475569] mt-0.5">{option.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Description <span className="text-amber-400">*</span></label>
                  <input
                    value={adjustmentLabel}
                    onChange={event => setAdjustmentLabel(event.target.value)}
                    placeholder="e.g. Lumper reimbursement"
                    className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none focus:border-amber-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Amount <span className="text-amber-400">*</span></label>
                  <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424] focus-within:border-amber-500/40">
                    <span className="pl-3 text-sm text-[#64748b]">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={adjustmentAmount}
                      onChange={event => setAdjustmentAmount(event.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-2.5 bg-transparent text-[#e8edf5] placeholder-[#475569] text-sm font-mono focus:outline-none"
                    />
                  </div>
                </div>
                {actionError && <div className="text-xs text-red-400 font-mono">{actionError}</div>}
              </div>
            ) : (
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Load <span className="text-amber-400">*</span></label>
                  <select
                    value={moveLoadId}
                    onChange={event => setMoveLoadId(event.target.value)}
                    className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40"
                  >
                    {selectedPayee.loads.map(load => (
                      <option key={load.id} value={load.id}>{load.id} · {load.route} · ${load.share.toFixed(2)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Move to pay week</label>
                  <select
                    value={targetWeek}
                    onChange={event => setTargetWeek(event.target.value)}
                    className="w-full px-3 py-2.5 rounded border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40"
                  >
                    <option>Sep 14 – 20, 2026</option>
                    <option>Sep 28 – Oct 4, 2026</option>
                    <option>Oct 5 – 11, 2026</option>
                  </select>
                </div>
                <div className="rounded border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
                  Moving this load removes its share from the current settlement and recalculates net pay.
                </div>
                {actionError && <div className="text-xs text-red-400 font-mono">{actionError}</div>}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-[#1e2d47]" style={{ background: 'var(--card)' }}>
              <button onClick={() => setAccountingAction(null)} className="px-4 py-2.5 rounded border border-[#1e2d47] text-sm text-[#64748b] hover:text-[#94a3b8]">
                Cancel
              </button>
              <button
                onClick={accountingAction === 'adjustment' ? addAdjustment : moveLoad}
                className="px-5 py-2.5 rounded text-sm font-semibold hover:opacity-90"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                {accountingAction === 'adjustment' ? 'Apply adjustment' : 'Move load'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Reports ── */
function ReportsScreen() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Reports</h1>
      <div className="grid grid-cols-2 gap-3">
        {['Driver earnings', 'Gross revenue', 'Net payable', 'Expenses for tax', 'Dashboard KPIs', 'Load profitability'].map((r) => (
          <div key={r} className="rounded border border-[#1e2d47] p-4 flex items-center justify-between hover:border-amber-500/30 cursor-pointer transition-all" style={{ background: 'var(--card)' }}>
            <span className="text-sm text-[#94a3b8]">{r}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-[#475569]"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Settings ── */
function SettingsScreen() {
  const { financialSettings, updateFinancialSettings } = useOperations()
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Settings</h1>
      <div className="rounded border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-[#e8edf5]">Driver + truck financial settings</h2>
          <p className="text-xs text-[#64748b] mt-1">Applied automatically when a driver completes a load and settlements are created.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Driver share of gross</span>
            <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]">
              <input
                type="number"
                min="0"
                max="100"
                value={financialSettings.driverPercent}
                onChange={event => updateFinancialSettings({ ...financialSettings, driverPercent: Number(event.target.value) })}
                className="w-full px-3 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none"
              />
              <span className="pr-3 text-[#64748b]">%</span>
            </div>
          </label>
          <label>
            <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Truck owner share of gross</span>
            <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]">
              <input
                type="number"
                min="0"
                max="100"
                value={financialSettings.truckPercent}
                onChange={event => updateFinancialSettings({ ...financialSettings, truckPercent: Number(event.target.value) })}
                className="w-full px-3 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none"
              />
              <span className="pr-3 text-[#64748b]">%</span>
            </div>
          </label>
          <label>
            <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Driver weekly deduction</span>
            <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]">
              <span className="pl-3 text-[#64748b]">$</span>
              <input
                type="number"
                min="0"
                value={financialSettings.driverWeeklyDeduction}
                onChange={event => updateFinancialSettings({ ...financialSettings, driverWeeklyDeduction: Number(event.target.value) })}
                className="w-full px-2 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none"
              />
            </div>
          </label>
          <label>
            <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Truck weekly deduction</span>
            <div className="flex items-center rounded border border-[#1e2d47] bg-[#0d1424]">
              <span className="pl-3 text-[#64748b]">$</span>
              <input
                type="number"
                min="0"
                value={financialSettings.truckWeeklyDeduction}
                onChange={event => updateFinancialSettings({ ...financialSettings, truckWeeklyDeduction: Number(event.target.value) })}
                className="w-full px-2 py-2.5 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none"
              />
            </div>
          </label>
        </div>
        <div className="mt-4 rounded border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-300">
          Current split: {financialSettings.driverPercent}% driver + {financialSettings.truckPercent}% truck. Changes apply to newly completed loads.
        </div>
      </div>
      <div className="rounded border border-[#1e2d47]" style={{ background: 'var(--card)' }}>
        {['Carrier profile & legal name', 'Invoice prefix & numbering', 'Users & roles', 'Pay-week cut-off & time zone', 'Audit log', 'Notification preferences'].map((item, i, arr) => (
          <button key={item} className={`w-full flex items-center justify-between px-4 py-3.5 text-sm text-[#94a3b8] hover:bg-[#111827] hover:text-[#e8edf5] transition-all text-left ${i < arr.length - 1 ? 'border-b border-[#1e2d47]' : ''}`}>
            {item}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 text-[#475569]"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ))}
      </div>
    </div>
  )
}
