import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type AppView = 'landing' | 'driver' | 'carrier' | 'fleet' | 'admin'
type Screen = 'dashboard' | 'drivers' | 'equipment' | 'loads' | 'maintenance' | 'settlements' | 'driver-pay' | 'escrow' | 'compliance'

interface Props {
  onNavigate: (view: AppView) => void
}

const navItems: { id: Screen; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'loads', label: 'Loads' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'settlements', label: 'Settlements' },
  { id: 'driver-pay', label: 'Driver Pay' },
  { id: 'escrow', label: 'Escrow' },
  { id: 'compliance', label: 'Compliance' },
]

export default function FleetPortal({ onNavigate }: Props) {
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
        <div className="w-1 h-4 rounded-full bg-blue-500" />
        <span className="font-semibold text-[#e8edf5]">Fleet Portal</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-mono border border-blue-500/30 text-blue-400">APPLICATION 3</span>
        <div className="ml-2 hidden md:flex items-center gap-1.5 px-3 py-1 rounded border border-[#1e2d47] text-xs text-[#64748b]" style={{ background: 'var(--muted)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          XYZ Trucking LLC · Carrier: ABC Transport
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => { logout(); onNavigate('landing') }} className="text-xs text-[#475569] hover:text-[#64748b] transition-colors px-2 py-1 rounded border border-[#1e2d47]">Sign out</button>
          <div className="w-8 h-8 rounded bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-semibold text-blue-300">{user?.avatar || 'FP'}</div>
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
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-[#111827]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-auto pt-4 border-t border-[#1e2d47] space-y-0.5">
            {['Documents', 'Reports', 'Users', 'Settings'].map((item) => (
              <button key={item} className="flex items-center px-3 py-2 rounded text-xs text-[#475569] hover:text-[#64748b] hover:bg-[#111827] transition-all w-full text-left">
                {item}
              </button>
            ))}
          </div>
        </nav>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          {screen === 'dashboard' && <FleetDashboard setScreen={setScreen} />}
          {screen === 'drivers' && <FleetDrivers />}
          {screen === 'equipment' && <FleetEquipment />}
          {screen === 'loads' && <FleetLoads />}
          {screen === 'maintenance' && <FleetMaintenance />}
          {screen === 'settlements' && <FleetSettlements />}
          {screen === 'driver-pay' && <FleetDriverPay />}
          {screen === 'escrow' && <FleetEscrow />}
          {screen === 'compliance' && <FleetCompliance />}
        </main>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, color = '#3b82f6', onClick }: { label: string; value: string | number; sub?: string; color?: string; onClick?: () => void }) {
  return (
    <div
      className={`rounded border border-[#1e2d47] p-4 ${onClick ? 'cursor-pointer hover:border-blue-500/30 transition-all' : ''}`}
      style={{ background: 'var(--card)' }}
      onClick={onClick}
    >
      <div className="text-xs text-[#64748b] mb-1">{label}</div>
      <div className="font-mono text-xl font-semibold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[#475569] mt-0.5">{sub}</div>}
    </div>
  )
}

function FleetDashboard({ setScreen }: { setScreen: (s: Screen) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#e8edf5]">Fleet Dashboard</h1>
          <p className="text-xs text-[#64748b] mt-0.5 font-mono">XYZ Trucking LLC · Sep 30, 2025</p>
        </div>
        <button
          className="px-4 py-2 rounded text-sm font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors"
          onClick={() => setScreen('drivers')}
        >
          + Add Driver
        </button>
      </div>

      <div>
        <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Equipment</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Total Trucks" value={22} color="#3b82f6" onClick={() => setScreen('equipment')} />
          <Tile label="Active / Dispatched" value={14} color="#f59e0b" />
          <Tile label="Available" value={6} color="#10b981" />
          <Tile label="In Maintenance" value={2} color="#64748b" onClick={() => setScreen('maintenance')} />
        </div>
      </div>

      <div>
        <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Drivers</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Tile label="Total Drivers" value={28} color="#3b82f6" onClick={() => setScreen('drivers')} />
          <Tile label="Active / On Load" value={14} color="#f59e0b" />
          <Tile label="Available" value={12} color="#10b981" />
        </div>
      </div>

      <div>
        <div className="text-xs font-mono text-[#475569] uppercase tracking-wider mb-3">Financials</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Weekly Earnings" value="$36,400" color="#10b981" onClick={() => setScreen('settlements')} />
          <Tile label="MTD Earnings" value="$148,200" color="#10b981" />
          <Tile label="YTD Earnings" value="$1.24M" color="#10b981" />
          <Tile label="Escrow Balance" value="$24,500" color="#3b82f6" onClick={() => setScreen('escrow')} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-mono text-[#64748b] font-semibold mb-3">SETTLEMENTS</div>
          {[
            { label: 'Pending', value: 2, color: '#f59e0b' },
            { label: 'Paid This Month', value: 8, color: '#10b981' },
            { label: 'Disputed', value: 0, color: '#ef4444' },
          ].map((r) => (
            <div key={r.label} className="flex justify-between py-2 border-b border-[#1e2d47] last:border-0 text-sm">
              <span className="text-[#64748b]">{r.label}</span>
              <span className="font-mono font-semibold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="text-xs font-mono text-[#64748b] font-semibold mb-3">ALERTS</div>
          {[
            { label: 'Compliance Exceptions', value: 2, color: '#f59e0b' },
            { label: 'Maintenance Due', value: 3, color: '#f59e0b' },
            { label: 'Documents Expiring', value: 1, color: '#ef4444' },
          ].map((r) => (
            <div key={r.label} className="flex justify-between py-2 border-b border-[#1e2d47] last:border-0 text-sm">
              <span className="text-[#64748b]">{r.label}</span>
              <span className="font-mono font-semibold" style={{ color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FleetDrivers() {
  const drivers = [
    { name: 'James Williams', id: 'DRV-042', truck: 'T221', status: 'Dispatched', cdl: 'Valid', carrierApproved: 'Approved', payModel: '28% of load' },
    { name: 'Carlos Mendez', id: 'DRV-056', truck: 'T198', status: 'Available', cdl: 'Valid', carrierApproved: 'Approved', payModel: '27% of load' },
    { name: 'Sarah Mitchell', id: 'DRV-071', truck: 'T240', status: 'On Leave', cdl: 'Expiring Soon', carrierApproved: 'Approved', payModel: '$0.52/mile' },
    { name: 'Tony Ramirez', id: 'DRV-088', truck: '—', status: 'Onboarding', cdl: 'Under Review', carrierApproved: 'Pending', payModel: 'TBD' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8edf5]">Drivers</h1>
        <button className="px-4 py-2 rounded text-sm font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
          + Invite Driver
        </button>
      </div>

      <div className="rounded border border-blue-500/20 px-4 py-3 text-xs font-mono text-[#64748b]" style={{ background: '#3b82f608' }}>
        Fleet Company manages driver employment & pay. Carrier (ABC Transport Co.) controls dispatch eligibility.
      </div>

      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
              {['Driver', 'ID', 'Truck', 'Status', 'CDL', 'Carrier Approval', 'Pay Model'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.id} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors last:border-0 cursor-pointer">
                <td className="px-4 py-3 font-medium text-[#e8edf5]">{d.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-400">{d.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{d.truck}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                    d.status === 'Available' ? 'text-emerald-400 bg-emerald-500/10' :
                    d.status === 'Dispatched' ? 'text-amber-400 bg-amber-500/10' :
                    d.status === 'Onboarding' ? 'text-blue-400 bg-blue-500/10' :
                    'text-[#64748b] bg-[#1e2d47]'
                  }`}>{d.status}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-mono ${d.cdl === 'Valid' ? 'text-emerald-400' : d.cdl === 'Expiring Soon' ? 'text-amber-400' : 'text-[#64748b]'}`}>
                    {d.cdl}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-mono ${d.carrierApproved === 'Approved' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {d.carrierApproved}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono text-[#64748b]">{d.payModel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FleetEquipment() {
  const equipment = [
    { unit: 'T221', vin: '3AKJHHDR2JSJE8901', driver: 'James Williams', status: 'Assigned', odometer: '284,321', inspection: 'Valid', registration: 'Valid' },
    { unit: 'T198', vin: '1M2AX07Y0GM002341', driver: 'Carlos Mendez', status: 'Available', odometer: '192,440', inspection: 'Valid', registration: 'Valid' },
    { unit: 'T240', vin: '3AKJGLDR7JSJF1247', driver: 'Sarah Mitchell', status: 'In Maintenance', odometer: '341,782', inspection: 'Expired', registration: 'Valid' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8edf5]">Equipment</h1>
        <button className="px-4 py-2 rounded text-sm font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
          + Add Truck
        </button>
      </div>
      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
                {['Unit', 'VIN', 'Driver', 'Status', 'Odometer', 'Inspection', 'Registration'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipment.map((e) => (
                <tr key={e.unit} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-blue-400 font-semibold">{e.unit}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[#475569]">{e.vin}</td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8]">{e.driver}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${e.status === 'Available' ? 'text-emerald-400 bg-emerald-500/10' : e.status === 'Assigned' ? 'text-amber-400 bg-amber-500/10' : 'text-[#64748b] bg-[#1e2d47]'}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{e.odometer} mi</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${e.inspection === 'Valid' ? 'text-emerald-400' : 'text-red-400'}`}>{e.inspection}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${e.registration === 'Valid' ? 'text-emerald-400' : 'text-red-400'}`}>{e.registration}</span>
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

function FleetLoads() {
  const loads = [
    { id: 'IW-1021', driver: 'John Smith', truck: 'T221', pickup: 'Dallas, TX', delivery: 'Atlanta, GA', status: 'In Transit', revenue: '$2,800', settlement: 'Pending' },
    { id: 'IW-1022', driver: 'Carlos Mendez', truck: 'T198', pickup: 'Houston, TX', delivery: 'Miami, FL', status: 'Accepted', revenue: '$3,200', settlement: 'Pending' },
    { id: 'IW-1015', driver: 'James Williams', truck: 'T221', pickup: 'Memphis, TN', delivery: 'Nashville, TN', status: 'Delivered', revenue: '$1,400', settlement: 'Calculated' },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Load Visibility</h1>
      <div className="rounded border border-[#1e2d47] px-4 py-3 text-xs font-mono text-[#64748b]" style={{ background: 'var(--muted)' }}>
        View only — loads dispatched by ABC Transport Co. Load assignment and commercial rates controlled by Carrier.
      </div>
      <div className="rounded-lg border border-[#1e2d47] overflow-hidden" style={{ background: 'var(--card)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2d47]" style={{ background: 'var(--muted)' }}>
              {['Load ID', 'Driver', 'Truck', 'Pickup', 'Delivery', 'Status', 'Revenue', 'Settlement'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#64748b] font-semibold uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loads.map((l) => (
              <tr key={l.id} className="border-b border-[#1e2d47] hover:bg-[#111827] transition-colors last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-blue-400 font-semibold">{l.id}</td>
                <td className="px-4 py-3 text-xs text-[#94a3b8]">{l.driver}</td>
                <td className="px-4 py-3 font-mono text-xs text-[#64748b]">{l.truck}</td>
                <td className="px-4 py-3 text-xs text-[#64748b]">{l.pickup}</td>
                <td className="px-4 py-3 text-xs text-[#64748b]">{l.delivery}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${l.status === 'Delivered' ? 'text-emerald-400 bg-emerald-500/10' : l.status === 'In Transit' ? 'text-amber-400 bg-amber-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-sm text-emerald-400">{l.revenue}</td>
                <td className="px-4 py-3 text-xs text-[#64748b] font-mono">{l.settlement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FleetMaintenance() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[#e8edf5]">Maintenance</h1>
        <button className="px-4 py-2 rounded text-sm font-medium border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors">
          + Add Record
        </button>
      </div>
      {[
        { truck: 'T240', type: 'Oil Change + Filter', vendor: 'Prime Truck Service', date: 'Sep 28, 2025', cost: '$380', status: 'Completed', invoice: 'Uploaded' },
        { truck: 'T221', type: 'Annual DOT Inspection', vendor: 'Certified Truck Inspections', date: 'Oct 5, 2025 (Scheduled)', cost: '$250', status: 'Scheduled', invoice: 'Pending' },
        { truck: 'T198', type: 'Tire Replacement (4x)', vendor: 'Loves Truck Stop Tire', date: 'Sep 15, 2025', cost: '$1,240', status: 'Completed', invoice: 'Uploaded' },
      ].map((r) => (
        <div key={r.truck + r.type} className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-mono text-xs text-blue-400 font-semibold">{r.truck}</div>
              <div className="font-medium text-[#e8edf5] mt-0.5">{r.type}</div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-mono ${r.status === 'Completed' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
              {r.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><div className="text-[#475569]">Vendor</div><div className="text-[#94a3b8] mt-0.5">{r.vendor}</div></div>
            <div><div className="text-[#475569]">Date</div><div className="text-[#94a3b8] mt-0.5">{r.date}</div></div>
            <div><div className="text-[#475569]">Cost</div><div className="font-mono text-[#e8edf5] mt-0.5">{r.cost}</div></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FleetSettlements() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Settlements</h1>
      <div className="rounded border border-[#1e2d47] px-4 py-3 text-xs font-mono text-[#64748b]" style={{ background: 'var(--muted)' }}>
        Settlements generated by ABC Transport Co. Fleet Company can view, download, acknowledge, or dispute.
      </div>

      {[
        { period: 'Sep 22 – Sep 28, 2025', gross: '$18,000', mgmtFee: '-$1,800', fuel: '-$3,200', insurance: '-$400', escrow: '-$300', other: '-$150', net: '$12,150', status: 'Pending Review' },
        { period: 'Sep 15 – Sep 21, 2025', gross: '$21,400', mgmtFee: '-$2,140', fuel: '-$3,800', insurance: '-$400', escrow: '-$300', other: '-$120', net: '$14,640', status: 'Acknowledged' },
      ].map((s) => (
        <div key={s.period} className="rounded-lg border border-[#1e2d47] p-5" style={{ background: 'var(--card)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-xs text-blue-400 font-semibold">{s.period}</div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-mono ${s.status === 'Acknowledged' ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'}`}>
              {s.status}
            </span>
          </div>
          <div className="space-y-1.5 mb-4">
            {[
              ['Gross Revenue', s.gross, 'positive'],
              ['Management Fee', s.mgmtFee, 'negative'],
              ['Fuel', s.fuel, 'negative'],
              ['Insurance', s.insurance, 'negative'],
              ['Escrow', s.escrow, 'negative'],
              ['Other', s.other, 'negative'],
            ].map(([label, val, sign]) => (
              <div key={String(label)} className="flex justify-between text-sm">
                <span className="text-[#64748b]">{String(label)}</span>
                <span className={`font-mono ${sign === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>{String(val)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm pt-2 border-t border-[#1e2d47]">
              <span className="font-semibold text-[#e8edf5]">NET PAYABLE</span>
              <span className="font-mono font-bold text-emerald-300">{s.net}</span>
            </div>
          </div>
          {s.status === 'Pending Review' && (
            <div className="flex gap-2">
              <button className="flex-1 py-2 rounded border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors">Dispute</button>
              <button className="flex-1 py-2 rounded bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors">Acknowledge</button>
            </div>
          )}
          {s.status === 'Acknowledged' && (
            <button className="w-full py-2 rounded border border-[#1e2d47] text-[#64748b] text-xs hover:text-[#94a3b8] transition-colors">Download PDF</button>
          )}
        </div>
      ))}
    </div>
  )
}

function FleetDriverPay() {
  const drivers = [
    { name: 'James Williams', model: 'Percentage', rate: '28% of load revenue', thisWeek: '$3,402', mtd: '$13,608' },
    { name: 'Carlos Mendez', model: 'Percentage', rate: '27% of load revenue', thisWeek: '$3,213', mtd: '$12,852' },
    { name: 'Sarah Mitchell', model: 'Per-Mile', rate: '$0.52 / mile', thisWeek: '$2,184', mtd: '$8,736' },
  ]

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Driver Pay</h1>

      <div className="rounded-lg border border-blue-500/30 p-5" style={{ background: 'var(--card)' }}>
        <div className="text-xs font-mono text-blue-400 font-semibold mb-3">THIS WEEK — NET FLEET SETTLEMENT: $12,150</div>
        <div className="space-y-2.5">
          {drivers.map((d) => (
            <div key={d.name} className="flex items-center justify-between py-2 border-b border-[#1e2d47] last:border-0">
              <div>
                <div className="text-sm font-medium text-[#e8edf5]">{d.name}</div>
                <div className="text-xs text-[#475569] mt-0.5">{d.model} · {d.rate}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-semibold text-emerald-400">{d.thisWeek}</div>
                <div className="text-xs text-[#475569] font-mono mt-0.5">MTD: {d.mtd}</div>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <span className="text-sm font-semibold text-[#e8edf5]">Company Retained</span>
            <span className="font-mono text-sm font-bold text-blue-300">$3,351</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-[#475569] border border-[#1e2d47] rounded p-3 font-mono" style={{ background: 'var(--muted)' }}>
        BR-007: Fleet Company controls payment to its own drivers. Carrier does not determine how the Fleet Company divides its net settlement.
      </div>
    </div>
  )
}

function FleetEscrow() {
  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Escrow Account</h1>

      <div className="rounded-lg border border-blue-500/30 p-5" style={{ background: 'var(--card)' }}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs font-mono text-blue-400 font-semibold">CURRENT BALANCE</div>
            <div className="font-mono text-3xl font-bold text-[#e8edf5] mt-1">$24,500</div>
          </div>
          <div className="text-right text-xs text-[#64748b]">
            <div>Carrier: ABC Transport Co.</div>
            <div className="mt-0.5">Maintained by Carrier</div>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { desc: 'Opening Balance (Sep 1)', amount: '+$22,100', type: 'positive', date: 'Sep 1' },
            { desc: 'Weekly Contribution (Wk 37)', amount: '+$300', type: 'positive', date: 'Sep 15' },
            { desc: 'Weekly Contribution (Wk 38)', amount: '+$300', type: 'positive', date: 'Sep 22' },
            { desc: 'Weekly Contribution (Wk 39)', amount: '+$300', type: 'positive', date: 'Sep 29' },
            { desc: 'Insurance Claim Deduction', amount: '-$500', type: 'negative', date: 'Sep 10' },
          ].map((row) => (
            <div key={row.desc} className="flex items-center justify-between py-2 border-b border-[#1e2d47] last:border-0 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-[#475569] w-12">{row.date}</span>
                <span className="text-[#94a3b8]">{row.desc}</span>
              </div>
              <span className={`font-mono text-sm ${row.type === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>{row.amount}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-[#475569] border border-[#1e2d47] rounded p-3 font-mono" style={{ background: 'var(--muted)' }}>
        Fleet Company can dispute a transaction but cannot independently change the Carrier-maintained escrow ledger.
      </div>
    </div>
  )
}

function FleetCompliance() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold text-[#e8edf5]">Compliance</h1>
      <div className="rounded border border-[#1e2d47] px-4 py-3 text-xs font-mono text-[#64748b]" style={{ background: 'var(--muted)' }}>
        Fleet Company submits documents. Carrier (ABC Transport Co.) controls dispatch eligibility for all drivers and equipment.
      </div>
      <div className="space-y-3">
        {[
          { entity: 'James Williams', type: 'CDL Class A', status: 'Valid', expiry: 'Jan 10, 2027', carrierStatus: 'Approved' },
          { entity: 'Carlos Mendez', type: 'Medical Certificate', status: 'Valid', expiry: 'Feb 28, 2026', carrierStatus: 'Approved' },
          { entity: 'Sarah Mitchell', type: 'CDL Class A', status: 'Expiring Soon', expiry: 'Nov 30, 2025', carrierStatus: 'Approved' },
          { entity: 'T240', type: 'Annual Inspection', status: 'Expired', expiry: 'Sep 10, 2025', carrierStatus: 'Flagged' },
          { entity: 'XYZ Trucking LLC', type: 'Liability Insurance', status: 'Valid', expiry: 'Dec 31, 2025', carrierStatus: 'Approved' },
        ].map((c) => (
          <div key={c.entity + c.type} className="flex items-center justify-between rounded-lg border border-[#1e2d47] px-4 py-3" style={{ background: 'var(--card)' }}>
            <div>
              <div className="text-sm font-medium text-[#e8edf5]">{c.entity}</div>
              <div className="text-xs text-[#475569] mt-0.5">{c.type} · Expires {c.expiry}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${c.status === 'Valid' ? 'text-emerald-400 bg-emerald-500/10' : c.status === 'Expiring Soon' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'}`}>
                {c.status}
              </span>
              <span className={`text-xs font-mono ${c.carrierStatus === 'Approved' ? 'text-emerald-400' : 'text-red-400'}`}>
                Carrier: {c.carrierStatus}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
