import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

type AppView = 'landing' | 'driver' | 'carrier' | 'fleet' | 'admin'

interface Props {
  onNavigate: (view: AppView) => void
}

const apps = [
  {
    id: 'driver' as AppView,
    label: 'Driver Mobile App',
    tag: 'APPLICATION 1',
    color: '#10b981',
    tagColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/5',
    hoverBg: 'hover:bg-emerald-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <path d="M12 18h.01" strokeLinecap="round" />
      </svg>
    ),
    description: 'Execute assigned transportation work. Accept loads, navigate, capture BOL/POD, report exceptions, track earnings.',
    users: 'All Drivers — Carrier, Fleet Company & Owner-Operator',
    features: ['Load acceptance & execution', 'BOL & POD capture', 'Exception reporting', 'Earnings & settlements', 'Compliance monitoring'],
  },
  {
    id: 'carrier' as AppView,
    label: 'Carrier Admin Portal',
    tag: 'APPLICATION 2',
    color: '#f59e0b',
    tagColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/5',
    hoverBg: 'hover:bg-amber-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    description: 'Operational command center. Manage loads, dispatch, drivers, equipment, customers, brokers, settlements, and Fleet Companies.',
    users: 'Carriers, Dispatchers, Operations Managers',
    features: ['Dispatch board', 'Load management', 'Fleet Company oversight', 'Settlement engine', 'Compliance authority'],
  },
  {
    id: 'fleet' as AppView,
    label: 'Fleet Company Portal',
    tag: 'APPLICATION 3',
    color: '#3b82f6',
    tagColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/5',
    hoverBg: 'hover:bg-blue-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
        <path d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 .001M13 16l2-6h4l2 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    description: 'Manage owned trucks, drivers, and financial relationship with Carrier. Control driver pay, maintenance, and fleet settlements.',
    users: 'Fleet/Truck-Owning Companies',
    features: ['Driver & truck management', 'Maintenance records', 'Settlement visibility', 'Driver pay configuration', 'Escrow tracking'],
  },
  {
    id: 'admin' as AppView,
    label: 'iWay Platform Admin',
    tag: 'APPLICATION 4',
    color: '#a855f7',
    tagColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/5',
    hoverBg: 'hover:bg-purple-500/10',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    description: 'Govern and operate the iWay platform. Onboard carriers, monitor cross-tenant operations, manage billing and platform configuration.',
    users: 'iWay Platform Operations Team',
    features: ['Carrier onboarding', 'Cross-tenant visibility', 'Case management', 'Platform billing', 'Audit & compliance'],
  },
]

const stats = [
  { value: '4', label: 'Integrated Applications' },
  { value: '3', label: 'User Personas' },
  { value: '15', label: 'Core Epics' },
  { value: '12', label: 'Business Rules' },
]

const hierarchy = [
  { level: 0, label: 'iWAY PLATFORM', sublabel: 'Platform Admin', color: '#a855f7' },
  { level: 1, label: 'CARRIERS', sublabel: 'Carrier Admin Portal', color: '#f59e0b' },
  { level: 2, label: 'FLEET COMPANIES', sublabel: 'Fleet Company Portal', color: '#3b82f6' },
  { level: 3, label: 'DRIVERS', sublabel: 'Driver Mobile App', color: '#10b981' },
]

export default function LandingPage({ onNavigate }: Props) {
  const { user, logout } = useAuth()
  const [hoveredApp, setHoveredApp] = useState<AppView | null>(null)

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Top nav */}
      <header className="border-b border-[#1e2d47] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-[#070c18]">
              <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V21a1 1 0 01-1.447.894l-4-2A1 1 0 017 19v-4.586L3.293 6.707A1 1 0 013 6V4z"/>
            </svg>
          </div>
          <span className="font-semibold text-lg tracking-tight text-[#e8edf5]">iWay</span>
          <span className="text-xs px-2 py-0.5 rounded-full border border-[#1e2d47] text-[#64748b] font-mono">v2.0</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#64748b]">
          <a href="#ecosystem" className="hover:text-[#e8edf5] transition-colors">Ecosystem</a>
          <a href="#hierarchy" className="hover:text-[#e8edf5] transition-colors">Architecture</a>
          <a href="#apps" className="hover:text-[#e8edf5] transition-colors">Applications</a>
        </nav>
        {user ? (
          <div className="flex items-center gap-2">
            <button onClick={() => onNavigate(user.appType)} className="px-4 py-2 rounded text-sm font-medium transition-colors" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
              Back to {user.role}
            </button>
            <button onClick={logout} className="px-3 py-2 rounded text-xs border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8] transition-colors">Sign out</button>
          </div>
        ) : (
          <button onClick={() => onNavigate('carrier')} className="px-4 py-2 rounded text-sm font-medium transition-colors" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            Launch Portal
          </button>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(90deg, #3b82f6 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full opacity-10 blur-[100px]" style={{ background: '#f59e0b' }} />

        <div className="relative max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-mono text-[#64748b] tracking-wider uppercase">Master Product Requirements — Version 2.0</span>
          </div>

          <h1 className="font-display text-4xl md:text-6xl leading-tight mb-6 max-w-3xl">
            One Platform.{' '}
            <span style={{ color: 'var(--primary)' }}>Four Applications.</span>{' '}
            Total Logistics Control.
          </h1>

          <p className="text-[#94a3b8] text-lg max-w-2xl mb-10 leading-relaxed">
            iWay connects Drivers, Carriers, Fleet Companies, and Platform Operations in a single unified ecosystem —
            with clear ownership, strict tenant isolation, and auditable financial flows at every layer.
          </p>

          <div className="flex flex-wrap gap-3 mb-16">
            <button
              onClick={() => onNavigate('carrier')}
              className="px-6 py-3 rounded font-medium text-sm transition-all hover:opacity-90"
              style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              Carrier Admin Portal →
            </button>
            <button
              onClick={() => onNavigate('fleet')}
              className="px-6 py-3 rounded font-medium text-sm border border-[#1e2d47] text-[#94a3b8] hover:text-[#e8edf5] hover:border-[#3b82f6]/50 transition-all"
            >
              Fleet Company Portal
            </button>
            <button
              onClick={() => onNavigate('driver')}
              className="px-6 py-3 rounded font-medium text-sm border border-[#1e2d47] text-[#94a3b8] hover:text-[#e8edf5] hover:border-emerald-500/50 transition-all"
            >
              Driver App
            </button>
            <button
              onClick={() => onNavigate('admin')}
              className="px-6 py-3 rounded font-medium text-sm border border-[#1e2d47] text-[#64748b] hover:text-[#94a3b8] transition-all"
            >
              Platform Admin
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="border border-[#1e2d47] rounded p-4" style={{ background: 'var(--card)' }}>
                <div className="font-mono text-2xl font-semibold" style={{ color: 'var(--primary)' }}>{s.value}</div>
                <div className="text-xs text-[#64748b] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform hierarchy */}
      <section id="hierarchy" className="px-6 py-16 border-t border-[#1e2d47]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-mono text-[#64748b] tracking-wider uppercase">Governing Hierarchy</span>
            <h2 className="text-2xl font-semibold mt-2 text-[#e8edf5]">Platform Architecture</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Hierarchy visual */}
            <div className="space-y-0">
              {hierarchy.map((item, i) => (
                <div key={item.label} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-3 h-3 rounded-full mt-3 shrink-0"
                      style={{ background: item.color }}
                    />
                    {i < hierarchy.length - 1 && (
                      <div className="w-px flex-1 min-h-[40px]" style={{ background: `${item.color}40` }} />
                    )}
                  </div>
                  <div
                    className="flex-1 rounded border p-4 mb-2 cursor-pointer transition-all"
                    style={{
                      borderColor: `${item.color}40`,
                      background: `${item.color}08`,
                      marginLeft: `${item.level * 20}px`,
                    }}
                    onClick={() => onNavigate(item.level === 0 ? 'admin' : item.level === 1 ? 'carrier' : item.level === 2 ? 'fleet' : 'driver')}
                  >
                    <div className="font-mono text-xs font-semibold" style={{ color: item.color }}>{item.label}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">{item.sublabel}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ownership model */}
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[#94a3b8] mb-4">Fundamental Ownership Principle</div>
              {[
                { label: 'Fleet Company', action: 'Adds Driver', color: '#3b82f6' },
                { label: 'Driver', action: 'Completes Information', color: '#10b981' },
                { label: 'Carrier', action: 'Reviews & Approves', color: '#f59e0b' },
                { label: 'System', action: 'Driver becomes Dispatch Eligible', color: '#a855f7' },
              ].map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="flex flex-col items-center w-3">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: step.color }} />
                    {i < 3 && <div className="w-px h-6 opacity-30" style={{ background: step.color }} />}
                  </div>
                  <div className="flex-1 border border-[#1e2d47] rounded px-3 py-2" style={{ background: 'var(--card)' }}>
                    <span className="font-medium text-xs" style={{ color: step.color }}>{step.label}</span>
                    <span className="text-[#64748b] text-xs"> → {step.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* App cards */}
      <section id="apps" className="px-6 py-16 border-t border-[#1e2d47]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10">
            <span className="text-xs font-mono text-[#64748b] tracking-wider uppercase">Four-Application Ecosystem</span>
            <h2 className="text-2xl font-semibold mt-2 text-[#e8edf5]">Choose Your Application</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {apps.map((app) => (
              <div
                key={app.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all duration-200 ${app.borderColor} ${app.bgColor} ${app.hoverBg}`}
                style={{ background: hoveredApp === app.id ? undefined : 'var(--card)' }}
                onMouseEnter={() => setHoveredApp(app.id)}
                onMouseLeave={() => setHoveredApp(null)}
                onClick={() => onNavigate(app.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className={`text-xs font-mono font-semibold tracking-wider mb-1 ${app.tagColor}`}>{app.tag}</div>
                    <h3 className="text-base font-semibold text-[#e8edf5]">{app.label}</h3>
                  </div>
                  <div style={{ color: app.color }}>{app.icon}</div>
                </div>

                <p className="text-sm text-[#64748b] mb-4 leading-relaxed">{app.description}</p>

                <div className="text-xs text-[#475569] mb-4 border border-[#1e2d47] rounded px-3 py-2" style={{ background: 'var(--muted)' }}>
                  <span className="text-[#64748b]">Users: </span>{app.users}
                </div>

                <ul className="space-y-1.5 mb-5">
                  {app.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#64748b]">
                      <span className="w-1 h-1 rounded-full shrink-0" style={{ background: app.color }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  className="w-full py-2.5 rounded text-sm font-medium transition-all border"
                  style={{ borderColor: `${app.color}50`, color: app.color }}
                >
                  Enter {app.label.split(' ').slice(-2).join(' ')} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business rules */}
      <section className="px-6 py-16 border-t border-[#1e2d47]">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <span className="text-xs font-mono text-[#64748b] tracking-wider uppercase">Core Business Rules</span>
            <h2 className="text-2xl font-semibold mt-2 text-[#e8edf5]">No-Duplication Principles</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { code: 'BR-001', label: 'Load Ownership', desc: 'Only the Carrier can create and commercially manage Carrier loads.' },
              { code: 'BR-002', label: 'Dispatch Authority', desc: 'Only authorized Carrier users can assign or reassign loads.' },
              { code: 'BR-004', label: 'Fleet Driver Ownership', desc: 'Fleet Company manages its driver\'s employment and pay relationship.' },
              { code: 'BR-006', label: 'Fleet Settlement', desc: 'Carrier calculates and approves payments owed to Fleet Companies.' },
              { code: 'BR-010', label: 'Tenant Isolation', desc: 'One Carrier cannot access another Carrier\'s operational or financial data.' },
              { code: 'BR-012', label: 'Auditability', desc: 'Financial, compliance, and dispatch actions must generate audit events.' },
            ].map((rule) => (
              <div key={rule.code} className="border border-[#1e2d47] rounded p-4" style={{ background: 'var(--card)' }}>
                <div className="font-mono text-xs text-[#f59e0b] font-semibold mb-2">{rule.code}</div>
                <div className="text-sm font-medium text-[#e8edf5] mb-1">{rule.label}</div>
                <div className="text-xs text-[#64748b] leading-relaxed">{rule.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e2d47] px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--primary)' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-[#070c18]">
                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 14.414V21a1 1 0 01-1.447.894l-4-2A1 1 0 017 19v-4.586L3.293 6.707A1 1 0 013 6V4z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#e8edf5]">iWay</span>
            <span className="text-xs text-[#475569] font-mono">Master Product Requirements v2.0</span>
          </div>
          <div className="flex gap-4 text-xs text-[#475569]">
            {apps.map((app) => (
              <button
                key={app.id}
                onClick={() => onNavigate(app.id)}
                className={`hover:text-[#94a3b8] transition-colors ${app.tagColor}`}
              >
                {app.label.split(' ').slice(-2).join(' ')}
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
