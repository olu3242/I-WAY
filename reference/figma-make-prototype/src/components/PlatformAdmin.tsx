import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type AppView = 'landing' | 'driver' | 'carrier' | 'fleet' | 'admin'
type Screen = 'dashboard' | 'carriers' | 'fleet-cos' | 'drivers' | 'loads' | 'payments' | 'cases' | 'compliance' | 'config' | 'audit'

interface Props {
  onNavigate: (view: AppView) => void
}

const navItems: { id: Screen; label: string }[] = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'carriers', label: 'Carriers' },
  { id: 'fleet-cos', label: 'Fleet Companies' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'loads', label: 'Loads' },
  { id: 'payments', label: 'Payments' },
  { id: 'cases', label: 'Cases' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'config', label: 'Configuration' },
  { id: 'audit', label: 'Audit' },
]

export default function PlatformAdmin({ onNavigate }: Props) {
  const { user, logout } = useAuth()
  const [screen, setScreen] = useState<Screen>('dashboard')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <header className="border-b border-[#1e2d47] px-4 md:px-6 py-3 flex items-center gap-4">
        <button onClick={() => onNavigate('landing')} className="text-[#64748b] hover:text-[#94a3b8] transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="w-1 h-4 rounded-full bg-purple-500" />
        <span className="font-semibold text-[#e8edf5]">iWay Admin</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono border border-purple-500/30 text-purple-400">APPLICATION 4</span>
        <div className="ml-2 hidden md:flex items-center gap-1.5 px-3 py-1 rounded border border-[#1e2d47] text-xs text-[#64748b]" style={{ background: 'var(--muted)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          iWay Platform Operations · Elevated Access
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            5 Open Cases
          </div>
          <button onClick={() => { logout(); onNavigate('landing') }} className="text-xs text-[#475569] hover:text-[#64748b] transition-colors px-2 py-1 rounded border border-[#1e2d47]">Sign out</button>
          <div className="w-8 h-8 rounded bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-xs font-semibold text-purple-300">{user?.avatar || 'PA'}</div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-52 border-r border-[#1e2d47] p-3 hidden md:flex flex-col gap-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex items-center px-3 py-2.5 rounded text-sm transition-all text-left ${
                screen === item.id
                  ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#111827]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-4 border-t border-[#1e2d47] space-y-0.5">
            {['Risk', 'Settlements', 'Platform Billing', 'Users & Access', 'System'].map((item) => (
              <button key={item} className="flex items-center px-3 py-2 rounded text-xs text-[#475569] hover:text-[#64748b] hover:bg-[#111827] transition-all w-full text-left">
                {item}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {screen === 'dashboard' && <PlatformDashboard setScreen={setScreen} />}
          {screen === 'carriers' && <CarriersView />}
          {screen === 'fleet-cos' && <FleetCosView />}
          {screen === 'drivers' && <DriversView />}
          {screen === 'loads' && <LoadsView />}
          {screen === 'payments' && <PaymentsView />}
          {screen === 'cases' && <CasesView />}
          {screen === 'compliance' && <ComplianceView />}
          {screen === 'config' && <ConfigView />}
          {screen === 'audit' && <AuditView />}
        </main>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color = '#a855f7', onClick }: { label: string; value: string | number; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <div
      className={`rounded border border-[#1e2d47] p-4 ${onClick ? 'cursor-pointer hover:border-purple-500/30 transition-all' : ''}`}
      style={{ background: 'var(--card)' }}
      onClick={onClick}
    >
      <div className="text-xs text-[#64748b] mb-1">{label}</div>
      <div className="font-mono text-xl font-semibold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[#475569] mt-0.5">{sub}</div>}
    </div>
  )
}

function PlatformDashboard({ setScreen }: { setScreen: (s: Screen) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#e8edf5]">Platform Executive Dashboard</h1>
        <p className="text-xs text-[#64748b] mt-0.5 font-mono">Cross-tenant visibility · Sep 30, 2025</p>
      </div>

      <div>
        <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Platform Overview</div>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <MetricCard label="Active Carriers" value={34} color="#a855f7" onClick={() => setScreen('carriers')} />
          <MetricCard label="Fleet Companies" value={121} color="#3b82f6" onClick={() => setScreen('fleet-cos')} />
          <MetricCard label="Total Drivers" value={4821} color="#10b981" onClick={() => setScreen('drivers')} />
          <MetricCard label="Active Loads" value={2340} color="#f59e0b" onClick={() => setScreen('loads')} />
          <MetricCard label="Open Cases" value={5} color="#ef4444" onClick={() => setScreen('cases')} />
          <MetricCard label="Platform MRR" value="$284K" color="#10b981" />
        </div>
      </div>

      <div>
        <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Payment Health</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Settlement Volume (MTD)" value="$18.4M" color="#10b981" onClick={() => setScreen('payments')} />
          <MetricCard label="Failed Payments" value={3} color="#ef4444" sub="needs resolution" onClick={() => setScreen('payments')} />
          <MetricCard label="Returned ACH" value={1} color="#ef4444" onClick={() => setScreen('payments')} />
          <MetricCard label="Pending Payouts" value={142} color="#f59e0b" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Carrier status breakdown */}
        <div className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-mono text-[#64748b] font-semibold mb-4">CARRIER STATUS</div>
          {[
            { status: 'Active', count: 28, color: '#10b981' },
            { status: 'Under Review', count: 4, color: '#f59e0b' },
            { status: 'Restricted', count: 2, color: '#ef4444' },
            { status: 'Pending', count: 3, color: '#64748b' },
            { status: 'Closed', count: 1, color: '#475569' },
          ].map((r) => (
            <div key={r.status} className="flex items-center justify-between py-1.5 border-b border-[#1e2d47] last:border-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                <span className="text-sm text-[#64748b]">{r.status}</span>
              </div>
              <span className="font-mono text-sm font-semibold" style={{ color: r.color }}>{r.count}</span>
            </div>
          ))}
        </div>

        {/* Recent cases */}
        <div className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-mono text-[#64748b] font-semibold mb-4">RECENT CASES</div>
          {[
            { id: 'CS-2891', category: 'Payment', priority: 'High', from: 'ABC Transport' },
            { id: 'CS-2887', category: 'Settlement', priority: 'Medium', from: 'XYZ Trucking' },
            { id: 'CS-2882', category: 'Compliance', priority: 'High', from: 'Driver DRV-042' },
            { id: 'CS-2876', category: 'Technical', priority: 'Low', from: 'Delta Fleet' },
          ].map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-[#1e2d47] last:border-0">
              <div>
                <div className="font-mono text-xs text-purple-400">{c.id}</div>
                <div className="text-xs text-[#475569]">{c.category} · {c.from}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded font-mono ${c.priority === 'High' ? 'text-red-400 bg-red-500/10' : c.priority === 'Medium' ? 'text-amber-400 bg-amber-500/10' : 'text-[#64748b] bg-[#1e2d47]'}`}>
                {c.priority}
              </span>
            </div>
          ))}
        </div>

        {/* Compliance platform */}
        <div className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-mono text-[#64748b] font-semibold mb-4">PLATFORM COMPLIANCE</div>
          {[
            { label: 'Carriers with issues', value: 3, color: '#ef4444' },
            { label: 'Fleet Cos. with issues', value: 7, color: '#f59e0b' },
            { label: 'Expired driver docs', value: 14, color: '#ef4444' },
            { label: 'Expired equipment docs', value: 8, color: '#f59e0b' },
          ].map((r) => (
            <div key={r.label} className="flex justify-between py-1.5 border-b border-[#1e2d47] last:border-0 text-sm">
              <span className="text-[#64748b]">{r.label}</span>
              <span className="font-mono font-semibold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CarriersView() {
  const carriers = [
    { name: 'ABC Transport Co.', mc: 'MC-789123', drivers: 112, trucks: 100, loads: 34, status: 'Active', since: 'Jan 2023', plan: 'Enterprise' },
    { name: 'Lone Star Freight', mc: 'MC-445892', drivers: 67, trucks: 58, loads: 21, status: 'Active', since: 'Mar 2023', plan: 'Professional' },
    { name: 'Great Plains Trucking', mc: 'MC-123456', drivers: 34, trucks: 29, loads: 8, status: 'Active', since: 'Jul 2024', plan: 'Starter' },
    { name: 'Pacific Coast Haul', mc: 'MC-998712', drivers: 28, trucks: 24, loads: 5, status: 'Under Review', since: 'Sep 2025', plan: 'Pending' },
    { name: 'Midwest Express LLC', mc: 'MC-654321', drivers: 18, trucks: 15, loads: 0, status: 'Restricted', since: 'Feb 2024', plan: 'Professional' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8edf5]">Carriers</h1>
        <button className="px-4 py-2 rounded text-sm font-medium" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          + Onboard Carrier
        </button>
      </div>
      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
                {['Carrier', 'MC Number', 'Drivers', 'Trucks', 'Active Loads', 'Status', 'Member Since', 'Plan'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {carriers.map((c) => (
                <tr key={c.mc} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors cursor-pointer last:border-0">
                  <td className="px-4 py-3 font-medium text-[#e8edf5]">{c.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-purple-400">{c.mc}</td>
                  <td className="px-4 py-3 font-mono text-[#94a3b8]">{c.drivers}</td>
                  <td className="px-4 py-3 font-mono text-[#94a3b8]">{c.trucks}</td>
                  <td className="px-4 py-3 font-mono text-amber-400">{c.loads}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      c.status === 'Active' ? 'text-emerald-400 bg-emerald-500/10' :
                      c.status === 'Restricted' ? 'text-red-400 bg-red-500/10' :
                      'text-amber-400 bg-amber-500/10'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748b]">{c.since}</td>
                  <td className="px-4 py-3 text-xs text-[#64748b]">{c.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FleetCosView() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Fleet Companies — Platform View</h1>
      <div className="rounded border border-purple-500/20 px-4 py-3 text-xs font-mono text-purple-400" style={{ background: '#a855f708' }}>
        Cross-tenant visibility only. iWay Admin should not perform Carrier operational actions such as assigning Fleet Company drivers to loads.
      </div>
      {[
        { name: 'XYZ Trucking LLC', carrier: 'ABC Transport Co.', trucks: 22, drivers: 28, agreement: 'Active', escrow: '$24,500', compliance: 'OK' },
        { name: 'Delta Fleet Solutions', carrier: 'ABC Transport Co.', trucks: 18, drivers: 21, agreement: 'Active', escrow: '$18,200', compliance: 'OK' },
        { name: 'Star Haul Inc.', carrier: 'Lone Star Freight', trucks: 14, drivers: 16, agreement: 'Active', escrow: '$12,800', compliance: '1 issue' },
        { name: 'Rio Grande Carriers', carrier: 'Lone Star Freight', trucks: 9, drivers: 10, agreement: 'Suspended', escrow: '$8,100', compliance: '3 issues' },
      ].map((f) => (
        <div key={f.name} className="rounded-lg border border-[#1e2d47] p-4 flex flex-wrap items-center gap-4" style={{ background: 'var(--card)' }}>
          <div className="flex-1 min-w-[180px]">
            <div className="font-medium text-[#e8edf5]">{f.name}</div>
            <div className="text-xs text-[#475569] mt-0.5">Carrier: {f.carrier}</div>
          </div>
          <div className="flex gap-6 text-xs">
            <div><div className="text-[#475569]">Trucks</div><div className="font-mono text-[#94a3b8] mt-0.5">{f.trucks}</div></div>
            <div><div className="text-[#475569]">Drivers</div><div className="font-mono text-[#94a3b8] mt-0.5">{f.drivers}</div></div>
            <div><div className="text-[#475569]">Escrow</div><div className="font-mono text-emerald-400 mt-0.5">{f.escrow}</div></div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-mono ${f.agreement === 'Active' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
              {f.agreement}
            </span>
            <span className={`text-xs font-mono ${f.compliance === 'OK' ? 'text-emerald-400' : 'text-red-400'}`}>
              {f.compliance}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function DriversView() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Drivers — Platform View</h1>
      <div className="rounded border border-purple-500/20 px-4 py-3 text-xs font-mono text-purple-400" style={{ background: '#a855f708' }}>
        Cross-tenant visibility for support, risk, and compliance monitoring. Sensitive actions require elevated permission and reason codes.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
        {[
          { label: 'Total Drivers', value: 4821, color: '#a855f7' },
          { label: 'Active / Dispatched', value: 2118, color: '#f59e0b' },
          { label: 'Compliance Issues', value: 34, color: '#ef4444' },
          { label: 'Onboarding', value: 67, color: '#3b82f6' },
        ].map((kv) => (
          <div key={kv.label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-xs text-[#64748b]">{kv.label}</div>
            <div className="font-mono text-xl font-semibold mt-1" style={{ color: kv.color }}>{kv.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoadsView() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Loads — Platform View</h1>
      <div className="rounded border border-purple-500/20 px-4 py-3 text-xs font-mono text-purple-400" style={{ background: '#a855f708' }}>
        Read-only cross-carrier load visibility. Load creation and commercial management owned by individual Carriers (BR-001).
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Active Loads', value: 2340, color: '#f59e0b' },
          { label: 'Delayed', value: 47, color: '#ef4444' },
          { label: 'Pickups Today', value: 312, color: '#10b981' },
          { label: 'Deliveries Today', value: 289, color: '#10b981' },
        ].map((kv) => (
          <div key={kv.label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-xs text-[#64748b]">{kv.label}</div>
            <div className="font-mono text-xl font-semibold mt-1" style={{ color: kv.color }}>{kv.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PaymentsView() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Platform Financial Operations</h1>
      <div className="rounded border border-purple-500/20 px-4 py-3 text-xs font-mono text-purple-400" style={{ background: '#a855f708' }}>
        iWay monitors payment health. Carrier accounting remains owned by individual Carriers.
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Settlement Volume MTD', value: '$18.4M', color: '#10b981' },
          { label: 'Failed Payments', value: 3, color: '#ef4444' },
          { label: 'Returned ACH', value: 1, color: '#ef4444' },
          { label: 'Subscription Revenue MTD', value: '$284K', color: '#a855f7' },
          { label: 'Platform Fees Collected', value: '$42K', color: '#a855f7' },
          { label: 'Banking Issues', value: 2, color: '#f59e0b' },
        ].map((kv) => (
          <div key={kv.label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-xs text-[#64748b]">{kv.label}</div>
            <div className="font-mono text-xl font-semibold mt-1" style={{ color: kv.color }}>{kv.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CasesView() {
  const cases = [
    { id: 'CS-2891', category: 'Payment', origin: 'ABC Transport Co.', status: 'In Progress', priority: 'High', assigned: 'Ops Team A', updated: '30 min ago' },
    { id: 'CS-2887', category: 'Settlement', origin: 'XYZ Trucking LLC', status: 'Assigned', priority: 'Medium', assigned: 'Ops Team B', updated: '2h ago' },
    { id: 'CS-2882', category: 'Compliance', origin: 'Driver DRV-042', status: 'Waiting on User', priority: 'High', assigned: 'Compliance', updated: '1d ago' },
    { id: 'CS-2876', category: 'Technical', origin: 'Delta Fleet Solutions', status: 'New', priority: 'Low', assigned: 'Unassigned', updated: '1d ago' },
    { id: 'CS-2871', category: 'Dispute', origin: 'Star Haul Inc.', status: 'In Progress', priority: 'Medium', assigned: 'Ops Team A', updated: '2d ago' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8edf5]">Case Management</h1>
        <button className="px-4 py-2 rounded text-sm font-medium" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
          + New Case
        </button>
      </div>
      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
              {['Case ID', 'Category', 'Origin', 'Status', 'Priority', 'Assigned To', 'Updated'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors cursor-pointer last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-purple-400 font-semibold">{c.id}</td>
                <td className="px-4 py-3 text-xs text-[#94a3b8]">{c.category}</td>
                <td className="px-4 py-3 text-xs text-[#64748b]">{c.origin}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    c.status === 'In Progress' ? 'text-amber-400 bg-amber-500/10' :
                    c.status === 'New' ? 'text-blue-400 bg-blue-500/10' :
                    c.status === 'Waiting on User' ? 'text-purple-400 bg-purple-500/10' :
                    'text-[#64748b] bg-[#1e2d47]'
                  }`}>{c.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-mono ${c.priority === 'High' ? 'text-red-400' : c.priority === 'Medium' ? 'text-amber-400' : 'text-[#64748b]'}`}>
                    {c.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[#64748b]">{c.assigned}</td>
                <td className="px-4 py-3 text-xs text-[#475569]">{c.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ComplianceView() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Platform Compliance Monitor</h1>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Carriers with violations', value: 3, color: '#ef4444' },
          { label: 'Fleet Cos. with violations', value: 7, color: '#f59e0b' },
          { label: 'Expired driver docs (platform)', value: 34, color: '#ef4444' },
          { label: 'Equipment out of compliance', value: 18, color: '#f59e0b' },
        ].map((kv) => (
          <div key={kv.label} className="rounded border border-[#1e2d47] p-4" style={{ background: 'var(--card)' }}>
            <div className="text-xs text-[#64748b]">{kv.label}</div>
            <div className="font-mono text-2xl font-bold mt-1" style={{ color: kv.color }}>{kv.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConfigView() {
  const configs = [
    { category: 'Document Types', items: 24, lastModified: 'Sep 15, 2025', owner: 'Platform' },
    { category: 'Notification Templates', items: 38, lastModified: 'Sep 22, 2025', owner: 'Platform' },
    { category: 'Platform Roles', items: 12, lastModified: 'Aug 1, 2025', owner: 'Platform' },
    { category: 'Feature Flags', items: 17, lastModified: 'Sep 29, 2025', owner: 'Platform' },
    { category: 'Standard Statuses', items: 8, lastModified: 'Jul 12, 2025', owner: 'Platform' },
    { category: 'Default Expiration Rules', items: 11, lastModified: 'Sep 1, 2025', owner: 'Platform' },
    { category: 'Supported Payment Methods', items: 5, lastModified: 'Jun 30, 2025', owner: 'Platform' },
    { category: 'Platform Fee Configuration', items: 3, lastModified: 'Sep 10, 2025', owner: 'Platform' },
    { category: 'Security Settings', items: 9, lastModified: 'Sep 25, 2025', owner: 'Platform' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Platform Configuration</h1>
      <div className="rounded border border-purple-500/20 px-4 py-3 text-xs font-mono text-purple-400" style={{ background: '#a855f708' }}>
        Global configuration owned by iWay Platform Admin. Carriers may configure Carrier-level overrides only where iWay permits.
      </div>
      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
              {['Category', 'Items', 'Last Modified', 'Owner', 'Action'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {configs.map((c) => (
              <tr key={c.category} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors last:border-0">
                <td className="px-4 py-3 font-medium text-[#e8edf5]">{c.category}</td>
                <td className="px-4 py-3 font-mono text-[#94a3b8]">{c.items}</td>
                <td className="px-4 py-3 text-xs text-[#64748b]">{c.lastModified}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-purple-400">{c.owner}</span>
                </td>
                <td className="px-4 py-3">
                  <button className="text-xs text-[#3b82f6] hover:text-blue-300 transition-colors">Configure</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditView() {
  const events = [
    { id: 'AUD-8821', action: 'Fleet Settlement Approved', actor: 'dispatcher@abctransport.com', tenant: 'ABC Transport Co.', time: '09:41 AM', category: 'Financial' },
    { id: 'AUD-8820', action: 'Driver DRV-042 Restricted', actor: 'ops@abctransport.com', tenant: 'ABC Transport Co.', time: '09:38 AM', category: 'Compliance' },
    { id: 'AUD-8819', action: 'Load IW-1024 Created', actor: 'dispatch@abctransport.com', tenant: 'ABC Transport Co.', time: '09:22 AM', category: 'Dispatch' },
    { id: 'AUD-8818', action: 'Carrier Pacific Coast Haul — Status: Under Review', actor: 'admin@iway.io', tenant: 'iWay Platform', time: '09:15 AM', category: 'Platform' },
    { id: 'AUD-8817', action: 'Escrow Adjustment — XYZ Trucking', actor: 'accounting@abctransport.com', tenant: 'ABC Transport Co.', time: '08:54 AM', category: 'Financial' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Audit Log</h1>
      <div className="rounded border border-purple-500/20 px-4 py-3 text-xs font-mono text-purple-400" style={{ background: '#a855f708' }}>
        BR-012: Financial, compliance, dispatch, user-access, and status-changing actions generate immutable audit events.
      </div>
      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
                {['Event ID', 'Action', 'Actor', 'Tenant', 'Time', 'Category'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-purple-400">{e.id}</td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8] max-w-xs">{e.action}</td>
                  <td className="px-4 py-3 text-xs text-[#64748b]">{e.actor}</td>
                  <td className="px-4 py-3 text-xs text-[#475569]">{e.tenant}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{e.time}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                      e.category === 'Financial' ? 'text-emerald-400 bg-emerald-500/10' :
                      e.category === 'Compliance' ? 'text-amber-400 bg-amber-500/10' :
                      e.category === 'Platform' ? 'text-purple-400 bg-purple-500/10' :
                      'text-blue-400 bg-blue-500/10'
                    }`}>{e.category}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
