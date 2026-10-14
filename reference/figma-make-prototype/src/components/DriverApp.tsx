import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getVehicleServiceProjection, useOperations, WorkflowLoad } from '../context/OperationsContext'
import { MobileFrame } from './auth/DriverLogin'
import { DispatcherRecord, INITIAL_DISPATCHERS } from '../data/dispatchers'

type AppView = 'landing' | 'driver' | 'carrier' | 'fleet' | 'admin'
interface Props { onNavigate: (view: AppView) => void }

type Tab = 'loads' | 'truck' | 'documents' | 'pay' | 'chat' | 'profile'
type LoadView = 'list' | 'detail' | 'at-stop'

const ACTIVE_LOAD = {
  id: 'LD-10483',
  status: 'Accepted',
  broker: 'Summit Freight',
  commodity: 'General freight',
  miles: 452,
  rate: 2450,
  paymentTerms: 'Net 30',
  weight: '38,500 lb',
  equipment: "53' dry van",
  dispatcher: 'Tunji A.',
  pickupRef: 'PU-55821',
  stops: [
    {
      type: 'PICKUP' as const,
      facility: 'Lone Star Distribution',
      address: '4100 Irving Blvd, Dallas, TX 75247',
      date: 'Tue, Sep 29',
      window: '08:00 – 11:00',
      done: false,
    },
    {
      type: 'DROP-OFF' as const,
      facility: 'Riverside Foods DC',
      address: '2200 Channel Ave, Memphis, TN 38113',
      date: 'Wed, Sep 30',
      window: '06:00 – 14:00',
      done: false,
    },
  ],
}

export default function DriverApp({ onNavigate }: Props) {
  const { user, logout } = useAuth()
  const { loads, setLoadStatus, completeStop, sendDocumentNotification, updateBolDocument } = useOperations()
  const workflowLoad = loads.find(load =>
    load.driver === user?.name && ['Assigned', 'Accepted', 'In transit', 'Completed'].includes(load.status)
  )
  const activeLoad = workflowLoad ? {
    ...workflowLoad,
    dispatcher: workflowLoad.dispatcher || 'Carrier dispatch',
    pickupRef: workflowLoad.stops.find(stop => stop.type === 'PICKUP')?.ref || 'Pending',
    stops: workflowLoad.stops.map(stop => ({
      ...stop,
      date: stop.date || 'Date pending',
      window: stop.windowFrom && stop.windowTo ? `${stop.windowFrom} – ${stop.windowTo}` : 'Window pending',
      done: workflowLoad.completedStopIndexes.includes(workflowLoad.stops.indexOf(stop)),
    })),
  } : ACTIVE_LOAD
  const assignedDispatcher = INITIAL_DISPATCHERS.find(dispatcher => dispatcher.name === activeLoad.dispatcher)
    || INITIAL_DISPATCHERS[0]
  const [tab, setTab] = useState<Tab>('loads')
  const [loadView, setLoadView] = useState<LoadView>('list')
  const [stopIndex, setStopIndex] = useState(0)
  const [loadAccepted, setLoadAccepted] = useState(workflowLoad?.status === 'Accepted' || workflowLoad?.status === 'In transit' || workflowLoad?.status === 'Completed')
  const [tripStarted, setTripStarted] = useState(workflowLoad?.status === 'In transit')
  const [arrivedAtStop, setArrivedAtStop] = useState(false)
  const [bolNumber, setBolNumber] = useState('')
  const [bolUploaded, setBolUploaded] = useState(false)
  const [fallbackBolDocument, setFallbackBolDocument] = useState<WorkflowLoad['bolDocument']>()
  const [stopComplete, setStopComplete] = useState(false)
  const [showHeadingPrompt, setShowHeadingPrompt] = useState(workflowLoad?.status === 'Accepted')
  const [showDetailArrivalPrompt, setShowDetailArrivalPrompt] = useState(workflowLoad?.status === 'In transit')
  const [completedStops, setCompletedStops] = useState<number[]>(workflowLoad?.completedStopIndexes || [])
  const [loadCompleted, setLoadCompleted] = useState(workflowLoad?.status === 'Completed')

  const goToDetail = () => setLoadView('detail')
  const goToStop = (idx: number, arrived = false) => {
    setStopIndex(idx)
    setArrivedAtStop(arrived)
    setStopComplete(false)
    setShowHeadingPrompt(false)
    setShowDetailArrivalPrompt(false)
    setLoadView('at-stop')
  }
  const goToNextStop = () => {
    const nextStop = activeLoad.stops.findIndex((_, index) => !completedStops.includes(index))
    goToStop(nextStop >= 0 ? nextStop : activeLoad.stops.length - 1)
  }
  const handleAccept = () => {
    setLoadAccepted(true)
    setShowHeadingPrompt(true)
    if (workflowLoad) setLoadStatus(workflowLoad.id, 'Accepted')
  }
  const handleStopComplete = () => {
    const nextCompleted = Array.from(new Set([...completedStops, stopIndex]))
    setCompletedStops(nextCompleted)
    setStopComplete(true)
    if (workflowLoad) completeStop(workflowLoad.id, stopIndex)
    if (nextCompleted.length >= activeLoad.stops.length) {
      setLoadCompleted(true)
      setTripStarted(false)
      setLoadView('list')
    } else {
      setTripStarted(true)
      setArrivedAtStop(false)
      setBolNumber('')
      setBolUploaded(false)
      setStopComplete(false)
      setShowDetailArrivalPrompt(true)
      setLoadView('detail')
    }
  }
  const goBack = () => {
    if (loadView === 'at-stop') setLoadView('detail')
    else if (loadView === 'detail') setLoadView('list')
    else if (tab !== 'loads') setTab('loads')
    else onNavigate('landing')
  }

  return (
    <MobileFrame>
      <div className="flex flex-col h-full" style={{ background: '#0d1117' }}>
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <span className="text-xs font-semibold text-[#e8edf5]">9:41</span>
          <div className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-[#e8edf5]">
              <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-3.5 text-[#e8edf5]">
              <rect x="1" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <rect x="3" y="8.5" width="12" height="7" rx="1" />
              <path d="M21 10v4a2 2 0 000-4z" />
            </svg>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {tab === 'loads' && loadView === 'list' && (
            <LoadsHome
              user={user}
              load={activeLoad}
              loadAccepted={loadAccepted}
              tripStarted={tripStarted}
              loadCompleted={loadCompleted}
              completedStops={completedStops}
              onViewLoad={goToDetail}
              onStartTrip={() => {
                setTripStarted(true)
                setShowDetailArrivalPrompt(true)
                if (workflowLoad) setLoadStatus(workflowLoad.id, 'In transit')
                goToDetail()
              }}
              onNavigateBack={() => onNavigate('landing')}
            />
          )}
          {tab === 'loads' && loadView === 'detail' && (
            <LoadDetail
              load={activeLoad}
              dispatcher={assignedDispatcher}
              loadAccepted={loadAccepted}
              tripStarted={tripStarted}
              completedStops={completedStops}
              showHeadingPrompt={showHeadingPrompt}
              showArrivalPrompt={showDetailArrivalPrompt}
              onBack={() => setLoadView('list')}
              onAccept={handleAccept}
              onHeadToStop={goToNextStop}
              onChat={() => { setLoadView('list'); setTab('chat') }}
              onConfirmHeading={() => {
                setTripStarted(true)
                setShowHeadingPrompt(false)
                setShowDetailArrivalPrompt(true)
                if (workflowLoad) setLoadStatus(workflowLoad.id, 'In transit')
              }}
              onDismissHeading={() => setShowHeadingPrompt(false)}
              onConfirmArrival={() => {
                const nextStop = activeLoad.stops.findIndex((_, index) => !completedStops.includes(index))
                goToStop(nextStop >= 0 ? nextStop : activeLoad.stops.length - 1, true)
              }}
              onDismissArrival={() => setShowDetailArrivalPrompt(false)}
            />
          )}
          {tab === 'loads' && loadView === 'at-stop' && (
            <AtStop
              load={activeLoad}
              stop={activeLoad.stops[stopIndex]}
              stopNum={stopIndex + 1}
              totalStops={activeLoad.stops.length}
              arrivedAtStop={arrivedAtStop}
              bolNumber={bolNumber}
              bolUploaded={bolUploaded}
              bolDocument={workflowLoad?.bolDocument || fallbackBolDocument}
              stopComplete={stopComplete}
              onBack={() => setLoadView('detail')}
              onConfirmArrival={() => { setArrivedAtStop(true); setShowHeadingPrompt(false) }}
              onBolChange={setBolNumber}
              onBolUpload={() => {
                setBolUploaded(true)
              }}
              onSaveSignatures={(document) => {
                if (workflowLoad) {
                  updateBolDocument(workflowLoad.id, document)
                  sendDocumentNotification(workflowLoad.id, stopIndex, activeLoad.stops[stopIndex].type === 'PICKUP' ? 'BOL' : 'POD')
                } else {
                  setFallbackBolDocument(document)
                }
              }}
              onComplete={handleStopComplete}
            />
          )}
          {tab === 'documents' && <DocumentsTab />}
          {tab === 'truck' && <TruckTab user={user} truckUnit={workflowLoad?.truck || user?.truckUnit || 'T-104'} />}
          {tab === 'pay' && <PayTab />}
          {tab === 'chat' && <ChatTab dispatcher={assignedDispatcher} loadId={activeLoad.id} />}
          {tab === 'profile' && <ProfileTab user={user} onLogout={() => { logout(); onNavigate('landing') }} onBack={() => onNavigate('landing')} />}
        </div>

        {/* Bottom tab bar */}
        {loadView === 'list' && (
          <div className="shrink-0 border-t border-[#1e2d47] px-2 pb-3 pt-2 flex items-center" style={{ background: '#0d1117' }}>
            {([
              { id: 'loads', label: 'Loads', icon: TruckIcon },
              { id: 'truck', label: 'Truck', icon: VehicleIcon },
              { id: 'documents', label: 'Documents', icon: DocIcon },
              { id: 'pay', label: 'Pay', icon: PayIcon },
              { id: 'chat', label: 'Chat', icon: ChatIcon },
              { id: 'profile', label: 'Profile', icon: ProfileIcon },
            ] as { id: Tab; label: string; icon: React.FC<{ active: boolean }> }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 flex flex-col items-center gap-0.5 py-1"
              >
                <t.icon active={tab === t.id} />
                <span className="text-[10px]" style={{ color: tab === t.id ? '#f59e0b' : '#475569' }}>{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Home indicator */}
        {loadView === 'list' && (
          <div className="flex justify-center pb-1.5 shrink-0">
            <div className="w-28 h-1 rounded-full bg-[#e8edf5]/15" />
          </div>
        )}
      </div>
    </MobileFrame>
  )
}

/* ── Loads Home (Screen 15) ── */
function LoadsHome({ user, load, loadAccepted, tripStarted, loadCompleted, completedStops, onViewLoad, onStartTrip, onNavigateBack }: {
  user: ReturnType<typeof useAuth>['user']; loadAccepted: boolean; tripStarted: boolean;
  load: typeof ACTIVE_LOAD; loadCompleted: boolean; completedStops: number[];
  onViewLoad: () => void; onStartTrip: () => void; onNavigateBack: () => void;
}) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-3 flex items-center justify-between shrink-0">
        <div>
          <div className="text-xs text-[#64748b]">Tue, Sep 29 · T-104</div>
          <div className="text-base font-bold text-[#e8edf5]">Good morning, {user?.name?.split(' ')[0] || 'Jordan'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-[#64748b]">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          <div className="w-7 h-7 rounded-full bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center text-xs font-bold text-emerald-300">
            {user?.avatar || user?.name?.split(' ').map((n: string) => n[0]).join('') || 'JD'}
          </div>
        </div>
      </div>

      {/* Expiry alert */}
      <div className="mx-5 mb-3 flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3.5 py-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-amber-400 shrink-0">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex-1">
          <div className="text-xs font-medium text-amber-300">Medical card expires in 19 days</div>
          <div className="text-xs text-amber-500/70 mt-0.5">Tap to upload your renewal</div>
        </div>
      </div>

      {/* Status tiles */}
      <div className="grid grid-cols-2 gap-2.5 px-5 mb-4">
        {[
          { label: 'New', value: 1, color: '#f59e0b' },
          { label: 'Accepted', value: loadAccepted ? 1 : 0, color: '#3b82f6' },
          { label: 'In transit', value: tripStarted ? 1 : 0, color: '#10b981' },
          { label: 'Completed this week', value: loadCompleted ? 7 : 6, color: '#64748b' },
        ].map((tile) => (
          <button key={tile.label} onClick={onViewLoad} className="rounded-xl border border-[#1e2d47] px-3.5 py-3 text-left transition-all hover:border-[#2a3a54]" style={{ background: '#111827' }}>
            <div className="text-xl font-bold font-mono" style={{ color: tile.color }}>{tile.value}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{tile.label}</div>
          </button>
        ))}
      </div>

      {/* Active load card */}
      <div className="mx-5 mb-4 rounded-xl border border-amber-500/30 overflow-hidden" style={{ background: '#111827' }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-sm font-semibold text-amber-400">{load.id}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${loadCompleted ? 'bg-emerald-500/20 text-emerald-400' : loadAccepted ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {loadCompleted ? 'Completed' : loadAccepted ? 'Accepted' : 'Assigned to you'}
            </span>
          </div>

          {/* Route */}
          <div className="mb-3">
            {load.stops.map((stop, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center self-stretch">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 z-10 ${
                    completedStops.includes(i)
                      ? 'border-emerald-400 bg-emerald-400'
                      : stop.type === 'PICKUP'
                        ? 'border-emerald-400 bg-[#111827]'
                        : 'border-blue-400 bg-[#111827]'
                  }`} />
                  {i < load.stops.length - 1 && (
                    <div className="w-0.5 flex-1 min-h-8 my-1 bg-gradient-to-b from-emerald-400 via-blue-400 to-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.45)]" />
                  )}
                </div>
                <div className={`flex-1 ${i < load.stops.length - 1 ? 'pb-3' : ''}`}>
                  <div className={`text-[10px] font-semibold tracking-wider mb-0.5 ${stop.type === 'PICKUP' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {stop.type === 'PICKUP' ? 'PICKUP' : 'DROP-OFF'} {
                      load.stops.filter(candidate => candidate.type === stop.type).length > 1
                        ? `${load.stops.slice(0, i + 1).filter(candidate => candidate.type === stop.type).length} OF ${load.stops.filter(candidate => candidate.type === stop.type).length}`
                        : ''
                    }
                  </div>
                  <div className="text-xs font-medium text-[#e8edf5]">{stop.facility}</div>
                  <div className="text-xs text-[#475569]">{stop.date} · {stop.window}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-[#64748b] mb-4">
            <span>{load.miles} mi</span>
            <span>·</span>
            <span>{load.commodity}</span>
            <span>·</span>
            <span>{load.weight}</span>
          </div>

          {/* CTA */}
          {loadCompleted ? (
            <div className="w-full py-3 rounded-xl text-center font-semibold text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Load sent to settlement
            </div>
          ) : !loadAccepted ? (
            <button onClick={onViewLoad} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: '#f59e0b', color: '#0d1117' }}>
              View load details
            </button>
          ) : !tripStarted ? (
            <button onClick={onStartTrip} className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: '#f59e0b', color: '#0d1117' }}>
              Start trip
            </button>
          ) : (
            <button onClick={onViewLoad} className="w-full py-3 rounded-xl font-semibold text-sm bg-emerald-500 text-white">
              View active load →
            </button>
          )}
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}

/* ── Load Detail (Screen 16) ── */
function LoadDetail({ load, dispatcher, loadAccepted, tripStarted, completedStops, showHeadingPrompt, showArrivalPrompt, onBack, onAccept, onHeadToStop, onChat, onConfirmHeading, onDismissHeading, onConfirmArrival, onDismissArrival }: {
  load: typeof ACTIVE_LOAD; completedStops: number[];
  dispatcher: DispatcherRecord;
  loadAccepted: boolean; tripStarted: boolean; showHeadingPrompt: boolean; showArrivalPrompt: boolean;
  onBack: () => void; onAccept: () => void; onHeadToStop: () => void; onChat: () => void;
  onConfirmHeading: () => void; onDismissHeading: () => void;
  onConfirmArrival: () => void; onDismissArrival: () => void;
}) {
  const [showRateConfirmation, setShowRateConfirmation] = useState(false)
  const nextStop = load.stops.find((_, index) => !completedStops.includes(index))
  const nextStopLabel = nextStop?.type === 'PICKUP' ? 'pickup' : 'drop-off'
  const arrivalTypeLabel = nextStop?.type === 'PICKUP' ? 'pickup' : 'delivery'
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Header */}
      <div className="px-5 pt-3 pb-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#64748b] mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Loads
        </button>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-[#e8edf5]">{load.id}</span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${loadAccepted ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
            {loadAccepted ? (tripStarted ? 'In transit' : 'Accepted') : 'Assigned to you'}
          </span>
        </div>
        <div className="text-xs text-[#64748b] mt-0.5">{load.broker} · {load.commodity} · {load.miles} mi</div>
      </div>

      <div className={`flex-1 overflow-y-auto px-5 space-y-4 ${showHeadingPrompt ? 'pb-44' : showArrivalPrompt ? 'pb-36' : 'pb-28'}`}>
        {/* Stops timeline */}
        <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
          {load.stops.map((stop, i) => (
            <div key={i} className="relative">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${completedStops.includes(i) ? 'border-emerald-500 bg-emerald-500 text-white' : stop.type === 'PICKUP' ? 'border-emerald-400 text-emerald-400' : 'border-blue-400 text-blue-400'}`}>
                    {completedStops.includes(i) ? '✓' : i + 1}
                  </div>
                  {i < load.stops.length - 1 && <div className="w-0.5 h-10 bg-gradient-to-b from-emerald-400 to-blue-500 rounded-full my-1 shadow-[0_0_6px_rgba(59,130,246,0.35)]" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-semibold uppercase tracking-wider ${stop.type === 'PICKUP' ? 'text-emerald-400' : 'text-blue-400'}`}>
                      {stop.type} {
                        load.stops.filter(candidate => candidate.type === stop.type).length > 1
                          ? `${load.stops.slice(0, i + 1).filter(candidate => candidate.type === stop.type).length} OF ${load.stops.filter(candidate => candidate.type === stop.type).length}`
                          : ''
                      }
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#e8edf5]">{stop.facility}</div>
                  <div className="text-xs text-[#64748b] mt-0.5">{stop.address}</div>
                  <div className="text-xs text-[#94a3b8] mt-1">{stop.date} · {stop.window}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Load facts */}
        <div className="rounded-xl border border-blue-500/25 p-4" style={{ background: '#3b82f610' }}>
          <div className="text-xs text-blue-400 font-semibold uppercase tracking-wide mb-3">Assigned dispatcher</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">{dispatcher.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#e8edf5]">{dispatcher.name}</div>
              <div className="text-xs text-[#64748b] mt-0.5">{dispatcher.region} · {dispatcher.phone}</div>
            </div>
            <button onClick={() => { window.location.href = `tel:${dispatcher.phone.replace(/\D/g, '')}` }} className="w-9 h-9 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center" aria-label={`Call ${dispatcher.name}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M5 4h4l2 5-3 2a14 14 0 006 6l2-3 5 2v4a2 2 0 01-2 2C9.6 22 2 14.4 2 5a2 2 0 012-2h1z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button onClick={onChat} className="w-9 h-9 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 flex items-center justify-center" aria-label={`Chat with ${dispatcher.name}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-[#1e2d47] divide-y divide-[#1e2d47]" style={{ background: '#111827' }}>
          {[
            ['Pickup #', load.pickupRef],
            ['Weight', load.weight],
            ['Equipment', load.equipment],
            ['Dispatcher', load.dispatcher],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-[#64748b]">{k}</span>
              <span className="text-xs font-medium text-[#94a3b8]">{v}</span>
            </div>
          ))}
        </div>

        {/* Rate confirmation */}
        <button onClick={() => setShowRateConfirmation(true)} className="w-full flex items-center gap-2 text-xs text-blue-400 py-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          View rate confirmation (PDF)
        </button>
      </div>

      {showRateConfirmation && (
        <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#0d1117' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d47] shrink-0">
            <div>
              <div className="text-sm font-bold text-[#e8edf5]">Rate confirmation</div>
              <div className="text-xs text-[#64748b] mt-0.5">{load.id}-rate-confirmation.pdf</div>
            </div>
            <button onClick={() => setShowRateConfirmation(false)} className="text-[#64748b]" aria-label="Close PDF">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#070c18]">
            <div className="bg-white text-slate-900 rounded-sm p-6 min-h-full shadow-xl">
              <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="text-lg font-bold">{load.broker}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Broker-carrier rate confirmation</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-500">LOAD NUMBER</div>
                  <div className="font-mono font-bold mt-0.5">{load.id}</div>
                </div>
              </div>
              <div className="py-4 border-b border-slate-200">
                <div className="text-xs font-semibold text-slate-500 mb-3">LOAD ITINERARY</div>
                <div className="space-y-3">
                  {load.stops.map((stop, index) => (
                    <div key={`${stop.facility}-${index}`} className="flex gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${stop.type === 'PICKUP' ? 'bg-emerald-600' : 'bg-blue-600'}`}>{index + 1}</div>
                      <div>
                        <div className="text-xs font-bold">{stop.type === 'PICKUP' ? 'PICKUP' : 'DELIVERY'} · {stop.facility}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{stop.address}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{stop.date} · {stop.window}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 border-b border-slate-200 text-xs">
                <div><div className="text-slate-500">Commodity</div><div className="font-semibold mt-0.5">{load.commodity}</div></div>
                <div><div className="text-slate-500">Weight</div><div className="font-semibold mt-0.5">{load.weight}</div></div>
                <div><div className="text-slate-500">Equipment</div><div className="font-semibold mt-0.5">{load.equipment}</div></div>
                <div><div className="text-slate-500">Estimated miles</div><div className="font-semibold mt-0.5">{load.miles} mi</div></div>
                <div><div className="text-slate-500">Pickup reference</div><div className="font-semibold mt-0.5">{load.pickupRef}</div></div>
                <div><div className="text-slate-500">Payment terms</div><div className="font-semibold mt-0.5">{load.paymentTerms || 'Net 30'}</div></div>
              </div>
              <div className="flex items-center justify-between py-5">
                <div>
                  <div className="text-xs font-semibold text-slate-500">AGREED LINEHAUL RATE</div>
                  <div className="text-xs text-slate-400 mt-0.5">All-inclusive unless noted otherwise</div>
                </div>
                <div className="text-2xl font-mono font-bold">${load.rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] leading-relaxed text-slate-400">
                By accepting this load, the carrier agrees to the pickup and delivery requirements, rates, and accessorial policies listed in this confirmation. Submit signed delivery documents promptly after completion.
              </div>
            </div>
          </div>
          <div className="shrink-0 px-5 py-3 border-t border-[#1e2d47]">
            <button onClick={() => window.print()} className="w-full py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-semibold">
              Print or save PDF
            </button>
          </div>
        </div>
      )}

      {/* Fixed footer CTA */}
      <div className="absolute bottom-16 left-0 right-0 px-5 py-3" style={{ background: 'linear-gradient(to top, #0d1117 60%, transparent)' }}>
        {showHeadingPrompt && loadAccepted ? (
          <div className="rounded-xl border border-blue-400/70 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)]" style={{ background: '#f8fafc' }}>
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900">Headed to pickup?</div>
                <div className="text-[11px] text-slate-500 truncate">{load.stops.find(stop => stop.type === 'PICKUP')?.facility}</div>
              </div>
              <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            </div>
            <div className="flex gap-2">
              <button onClick={onDismissHeading} className="flex-1 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700">Not yet</button>
              <button onClick={onConfirmHeading} className="flex-[1.65] py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold">Yes, heading there</button>
            </div>
          </div>
        ) : showArrivalPrompt && tripStarted ? (
          <div className="flex items-center gap-2 rounded-xl border border-blue-400/70 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)]" style={{ background: '#f8fafc' }}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-bold text-slate-900">At the {arrivalTypeLabel}?</div>
              <div className="truncate text-[10px] text-slate-500">Geofence arrival detected</div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button onClick={onDismissArrival} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-700">
                Not yet
              </button>
              <button onClick={onConfirmArrival} className="rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white">
                I've arrived
              </button>
            </div>
          </div>
        ) : !loadAccepted ? (
          <div className="flex gap-3">
            <button className="flex-1 py-3.5 rounded-xl border border-red-500/40 text-red-400 text-sm font-semibold">Reject</button>
            <button onClick={onAccept} className="flex-1 py-3.5 rounded-xl text-sm font-semibold" style={{ background: '#f59e0b', color: '#0d1117' }}>Accept load</button>
          </div>
        ) : !tripStarted ? (
          <button onClick={onHeadToStop} className="w-full py-3.5 rounded-xl text-sm font-semibold bg-emerald-500 text-white">
            Head to {nextStopLabel} →
          </button>
        ) : (
          <button onClick={onHeadToStop} className="w-full py-3.5 rounded-xl text-sm font-semibold" style={{ background: '#f59e0b', color: '#0d1117' }}>
            At {nextStopLabel} · Check in →
          </button>
        )}
      </div>

      {/* Home indicator */}
      <div className="flex justify-center py-2 shrink-0">
        <div className="w-28 h-1 rounded-full bg-[#e8edf5]/15" />
      </div>
    </div>
  )
}

/* ── At the Stop (Screen 17) ── */
function SignatureValue({ value, className = '' }: { value?: string; className?: string }) {
  return value?.startsWith('data:image') ? (
    <img src={value} alt="Electronic signature" className={`max-h-16 max-w-full object-contain object-left ${className}`} />
  ) : (
    <span className={`font-display italic ${className}`}>{value || 'Missing'}</span>
  )
}

function ElectronicSignatureField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [mode, setMode] = useState<'type' | 'draw'>(value.startsWith('data:image') ? 'draw' : 'type')
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    drawing.current = true
    canvas.setPointerCapture(event.pointerId)
    const current = point(event)
    context.beginPath()
    context.moveTo(current.x, current.y)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    const current = point(event)
    context.lineWidth = 4
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#0f172a'
    context.lineTo(current.x, current.y)
    context.stroke()
  }

  function finishDrawing() {
    if (!drawing.current || !canvasRef.current) return
    drawing.current = false
    onChange(canvasRef.current.toDataURL('image/png'))
  }

  function clearDrawing() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[#94a3b8]">{label} *</span>
        <div className="flex rounded-lg border border-[#1e2d47] p-0.5">
          <button type="button" onClick={() => { setMode('type'); onChange('') }} className={`px-2 py-1 rounded text-[10px] ${mode === 'type' ? 'bg-blue-500/15 text-blue-400' : 'text-[#64748b]'}`}>Type</button>
          <button type="button" onClick={() => { setMode('draw'); onChange('') }} className={`px-2 py-1 rounded text-[10px] ${mode === 'draw' ? 'bg-blue-500/15 text-blue-400' : 'text-[#64748b]'}`}>Draw</button>
        </div>
      </div>
      {mode === 'type' ? (
        <input value={value} onChange={event => onChange(event.target.value)} placeholder="Type full legal name" className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-lg font-display italic text-[#e8edf5] placeholder-[#475569] focus:outline-none focus:border-amber-500/40" />
      ) : value.startsWith('data:image') ? (
        <div className="rounded-xl border border-emerald-500/30 bg-white p-3">
          <SignatureValue value={value} />
          <button type="button" onClick={clearDrawing} className="w-full mt-2 py-1.5 rounded border border-slate-200 text-xs text-slate-500">Clear and redraw</button>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1e2d47] overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={finishDrawing}
            onPointerCancel={finishDrawing}
            className="block w-full h-28 touch-none cursor-crosshair"
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200"><span className="text-[10px] text-slate-400">Sign above using a finger, stylus or mouse</span><button type="button" onClick={clearDrawing} className="text-[10px] text-slate-500">Clear</button></div>
        </div>
      )}
    </div>
  )
}

function AtStop({ load, stop, stopNum, totalStops, arrivedAtStop, bolNumber, bolUploaded, bolDocument, stopComplete, onBack, onConfirmArrival, onBolChange, onBolUpload, onSaveSignatures, onComplete }: {
  load: typeof ACTIVE_LOAD;
  stop: typeof ACTIVE_LOAD.stops[0]; stopNum: number; totalStops: number;
  arrivedAtStop: boolean;
  bolNumber: string; bolUploaded: boolean; bolDocument?: WorkflowLoad['bolDocument']; stopComplete: boolean;
  onBack: () => void; onConfirmArrival: () => void; onBolChange: (v: string) => void;
  onBolUpload: () => void; onSaveSignatures: (document: NonNullable<WorkflowLoad['bolDocument']>) => void; onComplete: () => void;
}) {
  const [showArrivalConfirmation, setShowArrivalConfirmation] = useState(!arrivedAtStop)
  const [showSignatureSheet, setShowSignatureSheet] = useState(false)
  const [showBolPdf, setShowBolPdf] = useState(false)
  const [driverSignature, setDriverSignature] = useState(bolDocument?.driverSignature || '')
  const [shipperSignature, setShipperSignature] = useState(bolDocument?.shipperSignature || '')
  const [receiverSignature, setReceiverSignature] = useState(bolDocument?.receiverSignature || '')
  const [localBolDocument, setLocalBolDocument] = useState<WorkflowLoad['bolDocument']>(bolDocument)
  const [signatureConsent, setSignatureConsent] = useState(false)
  const activeBolDocument = bolDocument || localBolDocument
  const stopTypeNumber = load.stops
    .slice(0, stopNum)
    .filter(candidate => candidate.type === stop.type).length
  const stopTypeTotal = load.stops.filter(candidate => candidate.type === stop.type).length
  const stopTypeLabel = stop.type === 'PICKUP' ? 'Pickup' : 'Drop-off'
  const arrivalTypeLabel = stop.type === 'PICKUP' ? 'pickup' : 'delivery'
  const pickupSignaturesComplete = !!activeBolDocument?.driverSignature && !!activeBolDocument?.shipperSignature
  const deliverySignatureComplete = !!activeBolDocument?.receiverSignature
  const signaturesComplete = stop.type === 'PICKUP' ? pickupSignaturesComplete : deliverySignatureComplete

  function saveSignatures() {
    if (!signatureConsent) return
    if (stop.type === 'PICKUP' && (!driverSignature.trim() || !shipperSignature.trim())) return
    if (stop.type === 'DROP-OFF' && !receiverSignature.trim()) return
    const savedDocument = {
      number: bolNumber || activeBolDocument?.number || `BOL-${load.id.replace('LD-', '')}`,
      driverSignature: stop.type === 'PICKUP' ? driverSignature.trim() : activeBolDocument?.driverSignature || driverSignature.trim(),
      shipperSignature: stop.type === 'PICKUP' ? shipperSignature.trim() : activeBolDocument?.shipperSignature || shipperSignature.trim(),
      receiverSignature: stop.type === 'DROP-OFF' ? receiverSignature.trim() : activeBolDocument?.receiverSignature || '',
      pickupSignedAt: stop.type === 'PICKUP' ? new Date().toLocaleString() : activeBolDocument?.pickupSignedAt,
      deliverySignedAt: stop.type === 'DROP-OFF' ? new Date().toLocaleString() : activeBolDocument?.deliverySignedAt,
    }
    setLocalBolDocument(savedDocument)
    onSaveSignatures(savedDocument)
    setShowSignatureSheet(false)
    setShowBolPdf(true)
  }
  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Header */}
      <div className="px-5 pt-3 pb-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#64748b] mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {load.id}
        </button>
        <div className="text-xs font-mono text-[#64748b] font-medium">{load.id} · Stop {stopNum} of {totalStops}</div>
        <div className="text-lg font-bold text-[#e8edf5] mt-0.5">
          {stopTypeLabel}{stopTypeTotal > 1 ? ` ${stopTypeNumber} of ${stopTypeTotal}` : ''} · {stop.facility}
        </div>
        {arrivedAtStop ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Arrival confirmed · detention clock active
          </div>
        ) : showArrivalConfirmation ? (
          <div className="mt-3 rounded-xl border border-blue-400/70 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.25)]" style={{ background: '#f8fafc' }}>
            <div className="text-sm font-bold text-slate-900">
              You're at the {arrivalTypeLabel}. Confirm arrival?
            </div>
            <div className="mt-1 text-[11px] leading-4 text-slate-500">
              Detected within 300 m of the facility. Detention starts 2 hours after the appointment.
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => setShowArrivalConfirmation(false)}
                className="flex-1 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
              >
                Not yet
              </button>
              <button
                onClick={() => {
                  setShowArrivalConfirmation(false)
                  onConfirmArrival()
                }}
                className="flex-[1.65] py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold"
              >
                Yes, I've arrived
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowArrivalConfirmation(true)}
            className="mt-3 w-full py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-300"
          >
            Confirm arrival manually
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-28">
        {/* Checklist */}
        <div className="rounded-xl border border-[#1e2d47]" style={{ background: '#111827' }}>
          {[
            { label: 'Arrival confirmed', sub: `Geofence · ${arrivedAtStop ? '07:42' : 'pending'}`, done: arrivedAtStop, action: null },
            { label: stop.type === 'PICKUP' ? 'BOL + signatures' : 'POD + receiver signature', sub: stop.type === 'PICKUP' ? 'Driver and shipper electronic signatures' : 'Uses the same signed pickup BOL', done: signaturesComplete, action: signaturesComplete ? null : 'Add' },
            { label: 'Detention / lumper', sub: 'Log extras with a receipt', done: false, action: 'Add' },
            { label: 'Report TONU', sub: 'Load cancelled on site', done: false, action: 'Report', danger: true },
          ].map((item, i) => (
            <div key={item.label} className={`flex items-center gap-3 px-4 py-3.5 ${i > 0 ? 'border-t border-[#1e2d47]' : ''}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.done ? 'border-emerald-500 bg-emerald-500' : 'border-[#2a3a54]'}`}>
                {item.done && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-3 h-3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm text-[#e8edf5]">{item.label}</div>
                <div className="text-xs text-[#475569] mt-0.5">{item.sub}</div>
              </div>
              {item.action && (
                <button className={`text-xs px-3 py-1.5 rounded-lg font-medium ${item.danger ? 'text-red-400 border border-red-500/30 bg-red-500/10' : 'text-blue-400 border border-blue-500/30 bg-blue-500/10'}`}>
                  {item.action}
                </button>
              )}
              {item.done && <span className="text-xs text-emerald-400 font-medium">Done</span>}
            </div>
          ))}
        </div>

        {/* BOL number */}
        <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
          <div className="text-xs font-medium text-[#64748b] mb-2">BOL number</div>
          <input
            value={bolNumber || activeBolDocument?.number || ''}
            onChange={(e) => onBolChange(e.target.value)}
            placeholder="Enter or scan"
            readOnly={stop.type === 'DROP-OFF'}
            className="w-full bg-[#0d1424] border border-[#1e2d47] rounded-xl px-4 py-3 text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none"
          />
          <button onClick={() => {
            if (stop.type === 'PICKUP') onBolUpload()
            setShowSignatureSheet(true)
          }} className="w-full mt-3 py-3 rounded-xl border border-[#1e2d47] text-sm text-[#64748b] flex items-center justify-center gap-2 hover:text-[#94a3b8] transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            {stop.type === 'PICKUP' ? (pickupSignaturesComplete ? 'View or update signed BOL' : 'Upload BOL + collect signatures') : (deliverySignatureComplete ? 'View signed POD' : 'Open BOL + collect receiver signature')}
          </button>
          {(pickupSignaturesComplete || deliverySignatureComplete) && (
            <button onClick={() => setShowBolPdf(true)} className="w-full mt-2 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-xs font-semibold text-blue-400">View signed PDF copy</button>
          )}
        </div>
      </div>

      {/* Complete button */}
      <div className="absolute bottom-4 left-0 right-0 px-5" style={{ background: 'linear-gradient(to top, #0d1117 60%, transparent)' }}>
        <button
          onClick={onComplete}
          disabled={!arrivedAtStop || !signaturesComplete}
          className="w-full py-4 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
          style={{ background: '#f59e0b', color: '#0d1117' }}
        >
          {stop.type === 'PICKUP'
            ? `Complete pickup${stopTypeTotal > 1 ? ` ${stopTypeNumber} of ${stopTypeTotal}` : ''}`
            : `Complete drop-off${stopTypeTotal > 1 ? ` ${stopTypeNumber} of ${stopTypeTotal}` : ''} & upload POD`}
        </button>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center pb-2 shrink-0">
        <div className="w-28 h-1 rounded-full bg-[#e8edf5]/15" />
      </div>

      {showSignatureSheet && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/75">
          <div className="w-full rounded-t-2xl border-t border-[#1e2d47] px-5 pt-4 pb-6 max-h-[94%] overflow-y-auto" style={{ background: '#111827' }}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div><div className="text-base font-bold text-[#e8edf5]">{stop.type === 'PICKUP' ? 'Sign bill of lading' : 'Receiver proof of delivery'}</div><div className="text-xs text-[#64748b] mt-0.5">{activeBolDocument?.number || bolNumber || `BOL-${load.id.replace('LD-', '')}`} · Electronic signature</div></div>
              <button onClick={() => setShowSignatureSheet(false)} className="text-[#64748b]" aria-label="Close signature sheet">×</button>
            </div>
            <div className="rounded-xl border border-[#1e2d47] p-3 mb-4 text-xs" style={{ background: '#0d1424' }}>
              <div className="flex justify-between"><span className="text-[#64748b]">Load</span><span className="font-mono text-amber-400">{load.id}</span></div>
              <div className="flex justify-between mt-2 gap-4"><span className="text-[#64748b]">Facility</span><span className="text-[#e8edf5] text-right">{stop.facility}</span></div>
            </div>
            {stop.type === 'PICKUP' ? (
              <div className="space-y-4">
                <ElectronicSignatureField label="Driver electronic signature" value={driverSignature} onChange={setDriverSignature} />
                <ElectronicSignatureField label="Shipper electronic signature" value={shipperSignature} onChange={setShipperSignature} />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#1e2d47] p-3"><div className="text-[10px] text-[#64748b] mb-1">DRIVER SIGNED</div><SignatureValue value={activeBolDocument?.driverSignature} className="text-base text-[#e8edf5]" /></div>
                  <div className="rounded-xl border border-[#1e2d47] p-3"><div className="text-[10px] text-[#64748b] mb-1">SHIPPER SIGNED</div><SignatureValue value={activeBolDocument?.shipperSignature} className="text-base text-[#e8edf5]" /></div>
                </div>
                <ElectronicSignatureField label="Receiver electronic signature" value={receiverSignature} onChange={setReceiverSignature} />
              </div>
            )}
            <button onClick={() => setSignatureConsent(!signatureConsent)} className="w-full flex items-start gap-3 mt-4 text-left"><span className={`w-5 h-5 rounded border shrink-0 flex items-center justify-center ${signatureConsent ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[#2a3a54]'}`}>{signatureConsent ? '✓' : ''}</span><span className="text-xs text-[#64748b]">The signer agrees that this electronic signature is legally equivalent to a handwritten signature and confirms the freight information shown.</span></button>
            <button onClick={saveSignatures} disabled={!signatureConsent || (stop.type === 'PICKUP' ? !driverSignature.trim() || !shipperSignature.trim() : !receiverSignature.trim())} className="w-full mt-5 py-3.5 rounded-xl bg-amber-500 text-[#0d1117] text-sm font-semibold disabled:opacity-40">Apply signatures + save PDF</button>
          </div>
        </div>
      )}

      {showBolPdf && (
        <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#0d1117' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d47]"><div><div className="text-sm font-bold text-[#e8edf5]">Signed BOL / POD</div><div className="text-xs text-[#64748b]">{activeBolDocument?.number || `BOL-${load.id.replace('LD-', '')}`}.pdf</div></div><button onClick={() => setShowBolPdf(false)} className="text-[#64748b]" aria-label="Close signed document">×</button></div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#070c18]">
            <div className="bg-white text-slate-900 min-h-full p-6">
              <div className="flex justify-between border-b border-slate-200 pb-5"><div><div className="text-xl font-bold">Bill of Lading</div><div className="text-xs text-slate-500">Electronic original · iWay Dispatch</div></div><div className="text-right"><div className="font-mono font-bold">{activeBolDocument?.number || `BOL-${load.id.replace('LD-', '')}`}</div><div className="text-xs text-slate-500">{load.id}</div></div></div>
              <div className="py-5 space-y-3 text-xs border-b border-slate-200"><div className="flex justify-between"><span className="text-slate-500">Route</span><span>{load.stops[0].facility} → {load.stops[load.stops.length - 1].facility}</span></div><div className="flex justify-between"><span className="text-slate-500">Commodity</span><span>{load.commodity}</span></div><div className="flex justify-between"><span className="text-slate-500">Weight</span><span>{load.weight}</span></div></div>
              <div className="py-5 space-y-5">
                {[['Driver', activeBolDocument?.driverSignature, activeBolDocument?.pickupSignedAt], ['Shipper', activeBolDocument?.shipperSignature, activeBolDocument?.pickupSignedAt], ['Receiver', activeBolDocument?.receiverSignature, activeBolDocument?.deliverySignedAt]].map(([role, signature, signedAt]) => (
                  <div key={role as string} className="border-b border-slate-200 pb-4"><div className="text-[10px] font-bold text-slate-500">{role as string} ELECTRONIC SIGNATURE</div><div className="mt-2"><SignatureValue value={signature} className="text-2xl" /></div><div className="text-[10px] text-slate-400 mt-1">{signedAt || 'Not signed yet'}</div></div>
                ))}
              </div>
              <div className="mt-8 text-[10px] text-slate-400">This electronic record is retained by the driver, carrier, broker, shipper and receiver as the shared load document.</div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-[#1e2d47]"><button onClick={() => window.print()} className="w-full py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-semibold">Print or save signed PDF</button></div>
        </div>
      )}
    </div>
  )
}

/* ── Assigned Truck Tab ── */
function TruckTab({ user, truckUnit }: { user: ReturnType<typeof useAuth>['user']; truckUnit: string }) {
  const { loads, vehicles, updateVehicle, serviceRecords: allServiceRecords, addServiceRecord } = useOperations()
  const normalizedUnit = truckUnit.includes('-') ? truckUnit : truckUnit.replace(/^([A-Z]+)(\d+)$/, '$1-$2')
  const assignedVehicle = vehicles.find(vehicle => vehicle.unit === normalizedUnit)
  const [previewDocument, setPreviewDocument] = useState<string | null>(null)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [serviceSaved, setServiceSaved] = useState(false)
  const [serviceForm, setServiceForm] = useState({ date: '', category: 'Preventive maintenance', odometer: '', vendor: '', amount: '', notes: '', receipt: false })
  const serviceRecords = allServiceRecords.filter(record => record.vehicleUnit === normalizedUnit)
  const serviceProjection = assignedVehicle ? getVehicleServiceProjection(assignedVehicle, loads) : null
  const vehicle = {
    unit: normalizedUnit,
    vin: assignedVehicle?.vin || 'VIN pending carrier update',
    type: assignedVehicle?.type || 'Tractor · sleeper',
    plate: assignedVehicle?.plate || 'Plate pending',
    trailer: assignedVehicle?.trailer || 'No trailer paired',
    odometer: assignedVehicle?.odometer || 'Odometer not recorded',
  }
  const documents = [
    { name: 'Annual DOT inspection', value: assignedVehicle?.annualDotExpiry || 'Missing', status: assignedVehicle?.annualDotExpiry && assignedVehicle.annualDotExpiry !== 'Missing' ? 'valid' : 'missing', canOpen: !!assignedVehicle?.annualDotExpiry && assignedVehicle.annualDotExpiry !== 'Missing' },
    { name: 'Registration / IRP cab card', value: assignedVehicle?.registrationExpiry || 'Missing', status: assignedVehicle?.registrationExpiry && assignedVehicle.registrationExpiry !== 'Missing' ? 'valid' : 'missing', canOpen: !!assignedVehicle?.registrationExpiry && assignedVehicle.registrationExpiry !== 'Missing' },
    { name: 'Physical damage insurance', value: assignedVehicle?.physicalDamageExpiry || 'Missing', status: assignedVehicle?.physicalDamageExpiry === 'Missing' || !assignedVehicle?.physicalDamageExpiry ? 'missing' : 'warning', canOpen: !!assignedVehicle?.physicalDamageExpiry && assignedVehicle.physicalDamageExpiry !== 'Missing' },
    { name: 'Form 2290 receipt', value: assignedVehicle?.form2290Expiry || 'Missing', status: assignedVehicle?.form2290Expiry && assignedVehicle.form2290Expiry !== 'Missing' ? 'valid' : 'missing', canOpen: !!assignedVehicle?.form2290Expiry && assignedVehicle.form2290Expiry !== 'Missing' },
    { name: 'NY HUT permit', value: assignedVehicle?.nyHutPermit || 'Missing', status: assignedVehicle?.nyHutPermit && assignedVehicle.nyHutPermit !== 'Missing' ? 'valid' : 'missing', canOpen: !!assignedVehicle?.nyHutPermit && assignedVehicle.nyHutPermit !== 'Missing' },
    { name: 'Service interval', value: `Every ${serviceProjection?.serviceInterval.toLocaleString() || '—'} mi`, status: 'valid', canOpen: false },
    { name: 'Next PM service', value: serviceProjection?.overdue ? 'Due now' : `Due in ${Math.round(serviceProjection?.milesRemaining || 0).toLocaleString()} mi`, status: serviceProjection?.dueSoon ? 'warning' : 'valid', canOpen: false },
  ]

  function saveServiceRecord() {
    if (!serviceForm.date || !serviceForm.odometer || !serviceForm.vendor) return
    addServiceRecord({
      ...serviceForm,
      id: `svc-${Date.now()}`,
      vehicleUnit: normalizedUnit,
      date: new Date(`${serviceForm.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      odometer: `${Number(serviceForm.odometer).toLocaleString()} mi`,
      submittedBy: user?.name || 'Assigned driver',
      source: 'Driver App',
      createdAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    })
    if (assignedVehicle) {
      updateVehicle(assignedVehicle.unit, {
        ...assignedVehicle,
        odometer: `${Number(serviceForm.odometer).toLocaleString()} mi`,
        miles: '0',
        nextServiceMiles: assignedVehicle.serviceIntervalMiles || '10000',
        geoTrackedMiles: 0,
      })
    }
    setServiceSaved(true)
    setTimeout(() => {
      setShowServiceForm(false)
      setServiceSaved(false)
      setServiceForm({ date: '', category: 'Preventive maintenance', odometer: '', vendor: '', amount: '', notes: '', receipt: false })
    }, 800)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="px-5 pt-3 pb-3 shrink-0">
        <div className="text-lg font-bold text-[#e8edf5]">My truck</div>
        <div className="text-xs text-[#64748b] mt-0.5">Assigned vehicle, documents and service history</div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-6">
        <div className="rounded-xl border border-blue-500/25 px-4 py-3 flex items-center justify-between" style={{ background: '#3b82f610' }}>
          <div><div className="text-xs text-blue-400">Assigned vehicle</div><div className="font-mono text-lg font-bold text-[#e8edf5] mt-0.5">{vehicle.unit}</div></div>
          <span className={`text-xs px-2 py-1 rounded-full ${assignedVehicle?.status === 'Out of service' ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{assignedVehicle?.status || 'In service'}</span>
        </div>
        {serviceProjection?.dueSoon && (
          <div className={`rounded-xl border px-4 py-3 ${serviceProjection.overdue ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <div className={`text-sm font-bold ${serviceProjection.overdue ? 'text-red-400' : 'text-amber-300'}`}>{serviceProjection.overdue ? 'Truck service is due now' : `Service due in ${Math.round(serviceProjection.milesRemaining).toLocaleString()} miles`}</div>
            <div className="mt-1 text-xs text-[#64748b]">Updates from load distance and geolocation mileage while you and {vehicle.unit} are in service.</div>
          </div>
        )}

        <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
          <div className="text-base font-bold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Vehicle</div>
          {[
            ['Unit #', vehicle.unit],
            ['VIN', vehicle.vin],
            ['Type', vehicle.type],
            ['Plate', vehicle.plate],
            ['Assigned driver', assignedVehicle?.driver || user?.name || 'Driver'],
            ['Trailer', vehicle.trailer],
            ['Odometer', vehicle.odometer],
            ['Service interval', serviceProjection ? `${serviceProjection.serviceInterval.toLocaleString()} mi` : 'Not configured'],
            ['Miles until service', serviceProjection ? `${Math.round(serviceProjection.milesRemaining).toLocaleString()} mi` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3 border-b border-[#1e2d47] last:border-0">
              <span className="text-xs text-[#64748b]">{label}</span>
              <span className={`text-xs font-semibold text-[#e8edf5] text-right ${label === 'VIN' || label === 'Unit #' ? 'font-mono' : ''}`}>{value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
          <div className="text-base font-bold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Documents + maintenance</div>
          {documents.map(document => (
            <button key={document.name} disabled={!document.canOpen} onClick={() => document.canOpen && setPreviewDocument(document.name)} className={`w-full flex items-center justify-between gap-3 py-3 border-b border-[#1e2d47] last:border-0 text-left ${document.canOpen ? 'cursor-pointer' : 'cursor-default'}`}>
              <span className="text-xs text-[#e8edf5]">{document.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${document.status === 'valid' ? 'bg-emerald-500/15 text-emerald-400' : document.status === 'warning' ? 'bg-amber-500/15 text-amber-400' : 'bg-[#1e2d47] text-[#64748b]'}`}>{document.value}</span>
            </button>
          ))}
          <div className="text-[10px] text-[#475569] mt-3">Tap an available document to view its current copy.</div>
        </div>

        <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#1e2d47]">
            <div><div className="text-base font-bold text-[#e8edf5]">Service history</div><div className="text-xs text-[#64748b] mt-0.5">{serviceRecords.length} synced records</div></div>
            <button onClick={() => setShowServiceForm(true)} className="text-xs px-3 py-2 rounded-lg bg-amber-500 text-[#0d1117] font-semibold">+ Add service</button>
          </div>
          {serviceRecords.map(record => (
            <div key={record.id} className="py-3 border-b border-[#1e2d47] last:border-0">
              <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium text-[#e8edf5]">{record.category}</div><div className="text-xs text-[#64748b] mt-0.5">{record.vendor} · {record.date}</div></div><span className="text-xs font-mono text-[#94a3b8]">{record.odometer}</span></div>
              <div className="flex items-center justify-between mt-2"><span className="text-xs text-[#475569]">{record.notes}</span><span className="flex items-center gap-2">{record.amount && <span className="text-[10px] font-mono text-[#64748b]">${Number(record.amount).toFixed(2)}</span>}{record.receipt && <span className="text-[10px] text-blue-400">Receipt attached</span>}</span></div>
              <div className="mt-1 text-[10px] text-[#475569]">{record.source} · {record.submittedBy}</div>
            </div>
          ))}
        </div>

        <button className="w-full py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-semibold">Report vehicle defect</button>
      </div>

      {previewDocument && (
        <div className="absolute inset-0 z-20 flex flex-col" style={{ background: '#0d1117' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d47]"><div><div className="text-sm font-bold text-[#e8edf5]">{previewDocument}</div><div className="text-xs text-[#64748b]">{vehicle.unit} · Current document</div></div><button onClick={() => setPreviewDocument(null)} className="text-[#64748b]" aria-label="Close document"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button></div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#070c18]"><div className="bg-white text-slate-900 min-h-full p-6"><div className="flex justify-between border-b border-slate-200 pb-5"><div><div className="text-xl font-bold">Current Way Logistics</div><div className="text-xs text-slate-500">{previewDocument}</div></div><div className="font-mono font-bold">{vehicle.unit}</div></div><div className="py-6 space-y-3 text-sm">{[['VIN', vehicle.vin], ['Plate', vehicle.plate], ['Vehicle', vehicle.type], ['Status', documents.find(document => document.name === previewDocument)?.value || 'Current']].map(([label, value]) => <div key={label} className="flex justify-between"><span className="text-slate-500">{label}</span><span>{value}</span></div>)}</div><div className="mt-10 border-2 border-dashed border-slate-200 rounded p-10 text-center text-sm text-slate-400">Document image / PDF copy</div></div></div>
          <div className="px-5 py-3 border-t border-[#1e2d47]"><button onClick={() => window.print()} className="w-full py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-semibold">Print or save PDF</button></div>
        </div>
      )}

      {showServiceForm && (
        <div className="absolute inset-0 z-20 flex items-end bg-black/70">
          <div className="w-full rounded-t-2xl border-t border-[#1e2d47] px-5 pt-4 pb-6 max-h-[92%] overflow-y-auto" style={{ background: '#111827' }}>
            {serviceSaved ? (
              <div className="py-10 text-center"><div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">✓</div><div className="text-base font-bold text-[#e8edf5]">Service record added</div><div className="text-xs text-[#64748b] mt-1">Carrier maintenance was notified.</div></div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-4"><div><div className="text-base font-bold text-[#e8edf5]">Add truck service</div><div className="text-xs text-[#64748b] mt-0.5">{vehicle.unit} · Report maintenance or repair</div></div><button onClick={() => setShowServiceForm(false)} className="text-[#64748b]" aria-label="Close service form">×</button></div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3"><label><span className="block text-xs text-[#94a3b8] mb-1.5">Service date *</span><input type="date" value={serviceForm.date} onChange={event => setServiceForm(current => ({ ...current, date: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none" /></label><label><span className="block text-xs text-[#94a3b8] mb-1.5">Odometer *</span><input type="number" value={serviceForm.odometer} onChange={event => setServiceForm(current => ({ ...current, odometer: event.target.value }))} placeholder="211480" className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none" /></label></div>
                  <label><span className="block text-xs text-[#94a3b8] mb-1.5">Service type</span><select value={serviceForm.category} onChange={event => setServiceForm(current => ({ ...current, category: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none"><option>Preventive maintenance</option><option>Oil + filter service</option><option>Tire service</option><option>Brake repair</option><option>Roadside repair</option><option>DOT inspection repair</option><option>Other</option></select></label>
                  <label><span className="block text-xs text-[#94a3b8] mb-1.5">Service provider *</span><input value={serviceForm.vendor} onChange={event => setServiceForm(current => ({ ...current, vendor: event.target.value }))} placeholder="Shop or service provider" className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none" /></label>
                  <div className="grid grid-cols-2 gap-3"><label><span className="block text-xs text-[#94a3b8] mb-1.5">Amount</span><input type="number" value={serviceForm.amount} onChange={event => setServiceForm(current => ({ ...current, amount: event.target.value }))} placeholder="0.00" className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none" /></label><button onClick={() => setServiceForm(current => ({ ...current, receipt: true }))} className={`self-end py-3 rounded-xl border text-xs font-semibold ${serviceForm.receipt ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-[#1e2d47] text-[#64748b]'}`}>{serviceForm.receipt ? 'Receipt attached' : 'Attach receipt'}</button></div>
                  <label><span className="block text-xs text-[#94a3b8] mb-1.5">Service notes</span><textarea value={serviceForm.notes} onChange={event => setServiceForm(current => ({ ...current, notes: event.target.value }))} placeholder="Work completed, parts replaced, or remaining concerns" rows={3} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none resize-none" /></label>
                  <button onClick={saveServiceRecord} className="w-full py-3.5 rounded-xl bg-amber-500 text-[#0d1117] text-sm font-semibold">Save service record</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Documents Tab (Screen 18) ── */
function DocumentsTab() {
  const { user } = useAuth()
  const { addDriverDocument } = useOperations()
  const [documents, setDocuments] = useState([
    { name: 'DOT medical card', status: 'expiring', detail: 'Expires in 19 days · Oct 18', color: '#f59e0b', canRenew: true },
    { name: 'CDL · Class A', status: 'valid', detail: 'Valid · Oct 2030', color: '#10b981', canRenew: false },
    { name: 'Annual MVR review', status: 'expired', detail: 'Expired · Sep 15', color: '#ef4444', canRenew: true },
    { name: 'Clearinghouse query', status: 'valid', detail: 'Valid · May 2027', color: '#10b981', canRenew: false },
    { name: 'Government ID', status: 'valid', detail: 'Valid · Aug 2031', color: '#10b981', canRenew: false },
    { name: 'TWIC card', status: 'na', detail: 'Not required for your loads', color: '#475569', canRenew: false },
  ])
  const [renewingDoc, setRenewingDoc] = useState<(typeof documents)[number] | null>(null)
  const [documentNumber, setDocumentNumber] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [fileUploaded, setFileUploaded] = useState(false)
  const [renewalError, setRenewalError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function openRenewal(document: (typeof documents)[number]) {
    setRenewingDoc(document)
    setDocumentNumber('')
    setExpirationDate('')
    setFileUploaded(false)
    setRenewalError('')
    setSubmitted(false)
  }

  function submitRenewal() {
    if (!expirationDate || !fileUploaded) {
      setRenewalError('Add the new expiration date and upload a document image')
      return
    }
    if (!renewingDoc) return
    setDocuments(current => current.map(document => document.name === renewingDoc.name
      ? {
          ...document,
          status: 'pending',
          detail: `Renewal submitted · expires ${new Date(`${expirationDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          color: '#3b82f6',
          canRenew: false,
        }
      : document))
    addDriverDocument({
      id: `${user?.id || 'driver'}-${Date.now()}`,
      driverId: user?.id || 'driver',
      driverName: user?.name || 'Driver',
      driverPhone: user?.phone || '',
      name: renewingDoc.name,
      documentNumber: documentNumber.trim(),
      expirationDate,
      fileName: `${(user?.name || 'driver').toLowerCase().replace(/\s+/g, '-')}-${renewingDoc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`,
      fileType: 'PDF or image',
      uploadedAt: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      status: 'Pending review',
    })
    setSubmitted(true)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 pt-3 pb-4 shrink-0">
        <div className="text-lg font-bold text-[#e8edf5]">My documents</div>
        <div className="text-xs text-[#64748b] mt-0.5">Keep these current to stay dispatchable</div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 space-y-2.5 pb-6">
        {documents.map((doc) => (
          <div key={doc.name} className="flex items-center justify-between rounded-xl border border-[#1e2d47] px-4 py-3.5" style={{ background: '#111827' }}>
            <div>
              <div className="text-sm font-medium text-[#e8edf5]">{doc.name}</div>
              <div className="text-xs mt-0.5" style={{ color: doc.color }}>{doc.detail}</div>
            </div>
            {doc.canRenew ? (
              <button onClick={() => openRenewal(doc)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: '#f59e0b', color: '#0d1117' }}>Renew</button>
            ) : doc.status === 'pending' ? (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">Pending review</span>
            ) : (
              <div className="w-2 h-2 rounded-full" style={{ background: doc.color }} />
            )}
          </div>
        ))}
        <div className="text-xs text-[#475569] text-center pt-2">Reminders arrive 60, 30, 14 and 7 days before a document expires. Your manager approves each upload.</div>
      </div>

      {renewingDoc && (
        <div className="absolute inset-0 z-20 flex items-end">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRenewingDoc(null)} />
          <div className="relative z-10 w-full rounded-t-2xl border-t border-[#1e2d47] px-5 pt-4 pb-6" style={{ background: '#111827' }}>
            {submitted ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 mx-auto rounded-full border border-emerald-500/40 bg-emerald-500/15 flex items-center justify-center mb-3">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" className="w-6 h-6">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-base font-bold text-[#e8edf5]">Renewal submitted</div>
                <div className="text-xs text-[#64748b] mt-1">Your carrier manager will review the new {renewingDoc.name}.</div>
                <button onClick={() => setRenewingDoc(null)} className="w-full mt-5 py-3 rounded-xl text-sm font-semibold" style={{ background: '#f59e0b', color: '#0d1117' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <div className="text-base font-bold text-[#e8edf5]">Renew {renewingDoc.name}</div>
                    <div className="text-xs text-[#64748b] mt-0.5">Upload the replacement document for carrier approval.</div>
                  </div>
                  <button onClick={() => setRenewingDoc(null)} className="text-[#64748b]" aria-label="Close renewal">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                      <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">Document number <span className="text-[#475569]">· optional</span></span>
                    <input
                      value={documentNumber}
                      onChange={event => setDocumentNumber(event.target.value)}
                      placeholder="Enter document or certificate number"
                      className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] placeholder-[#475569] text-sm focus:outline-none focus:border-amber-500/40"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-[#94a3b8] mb-1.5">New expiration date <span className="text-amber-400">*</span></span>
                    <input
                      type="date"
                      value={expirationDate}
                      onChange={event => setExpirationDate(event.target.value)}
                      className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-[#e8edf5] text-sm focus:outline-none focus:border-amber-500/40"
                    />
                  </label>
                  <button
                    onClick={() => setFileUploaded(true)}
                    className={`w-full py-4 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 ${
                      fileUploaded ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-[#1e2d47] text-[#94a3b8]'
                    }`}
                  >
                    {fileUploaded ? (
                      <>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        New document attached
                      </>
                    ) : (
                      'Take photo or upload document'
                    )}
                  </button>
                  {renewalError && <div className="text-xs text-red-400">{renewalError}</div>}
                  <button onClick={submitRenewal} className="w-full py-3.5 rounded-xl text-sm font-semibold" style={{ background: '#f59e0b', color: '#0d1117' }}>
                    Submit for review
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Pay Tab ── */
function PayTab() {
  type PayView = 'current' | 'history' | 'reports'
  interface PayDocument {
    title: string
    period: string
    status: string
    gross: number
    deductions: number
    net: number
    loads: number
    rows: { label: string; detail: string; amount: number }[]
  }
  const [view, setView] = useState<PayView>('current')
  const [selectedDocument, setSelectedDocument] = useState<PayDocument | null>(null)
  const settlements: PayDocument[] = [
    {
      title: 'Settlement STL-0920-001', period: 'Sep 14 – 20, 2026', status: 'Paid · Sep 23, 2026',
      gross: 1654.80, deductions: 599.60, net: 1055.20, loads: 3,
      rows: [
        { label: 'LD-10441', detail: 'Dallas → Shreveport', amount: 420 },
        { label: 'LD-10436', detail: 'Shreveport → Houston', amount: 684.80 },
        { label: 'LD-10429', detail: 'Houston → Dallas', amount: 550 },
        { label: 'Fuel, insurance + escrow', detail: 'Weekly deductions', amount: -599.60 },
      ],
    },
    {
      title: 'Settlement STL-0913-008', period: 'Sep 7 – 13, 2026', status: 'Paid · Sep 16, 2026',
      gross: 1482.40, deductions: 512.50, net: 969.90, loads: 3,
      rows: [
        { label: 'LD-10422', detail: 'Austin → Lubbock', amount: 492.80 },
        { label: 'LD-10417', detail: 'Lubbock → Fort Worth', amount: 513.60 },
        { label: 'LD-10409', detail: 'Fort Worth → Dallas', amount: 476 },
        { label: 'Fuel, insurance + escrow', detail: 'Weekly deductions', amount: -512.50 },
      ],
    },
    {
      title: 'Settlement STL-0906-014', period: 'Aug 31 – Sep 6, 2026', status: 'Paid · Sep 9, 2026',
      gross: 1736.20, deductions: 540, net: 1196.20, loads: 4,
      rows: [
        { label: 'Completed loads', detail: '4 loads · 1,842 loaded miles', amount: 1736.20 },
        { label: 'Fuel, insurance + escrow', detail: 'Weekly deductions', amount: -540 },
      ],
    },
  ]
  const reports: PayDocument[] = [
    {
      title: 'This week earnings report', period: 'Sep 21 – 27, 2026', status: 'Current settlement',
      gross: 1836.80, deductions: 649.60, net: 1187.20, loads: 3,
      rows: [
        { label: 'Linehaul earnings', detail: '2 completed loads', amount: 1766.80 },
        { label: 'TONU + accessorials', detail: '1 cancelled load', amount: 70 },
        { label: 'Fuel card', detail: 'Weekly usage', amount: -349.60 },
        { label: 'Insurance, escrow + advance', detail: 'Weekly deductions', amount: -300 },
      ],
    },
    {
      title: 'Last week earnings report', period: 'Sep 14 – 20, 2026', status: 'Final',
      gross: 1654.80, deductions: 599.60, net: 1055.20, loads: 3,
      rows: [
        { label: 'Linehaul earnings', detail: '3 completed loads', amount: 1654.80 },
        { label: 'Fuel card', detail: 'Weekly usage', amount: -349.60 },
        { label: 'Insurance + escrow', detail: 'Weekly deductions', amount: -250 },
      ],
    },
    {
      title: 'Last month earnings report', period: 'August 2026', status: 'Final',
      gross: 6980.40, deductions: 2052.20, net: 4928.20, loads: 13,
      rows: [
        { label: 'Linehaul earnings', detail: '12 completed loads', amount: 6760.40 },
        { label: 'Accessorial earnings', detail: 'Detention, TONU and lumper', amount: 220 },
        { label: 'Fuel card', detail: 'Monthly total', amount: -1212.20 },
        { label: 'Insurance, escrow + advances', detail: 'Monthly total', amount: -840 },
      ],
    },
    {
      title: 'Year-to-date earnings report', period: 'Jan 1 – Sep 27, 2026', status: 'Through current pay week',
      gross: 68420.60, deductions: 19284.40, net: 49136.20, loads: 118,
      rows: [
        { label: 'Linehaul earnings', detail: '112 completed loads', amount: 66180.60 },
        { label: 'Accessorial earnings', detail: 'Detention, TONU and lumper', amount: 2240 },
        { label: 'Fuel + operating deductions', detail: 'Year-to-date', amount: -12184.40 },
        { label: 'Insurance, escrow + advances', detail: 'Year-to-date', amount: -7100 },
      ],
    },
  ]

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="px-5 pt-3 pb-3 shrink-0">
        <div className="text-lg font-bold text-[#e8edf5]">Pay</div>
        <div className="text-xs text-[#64748b] mt-0.5">Settlements, history and earnings reports</div>
      </div>
      <div className="px-5 pb-3 shrink-0">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-[#1e2d47] p-1" style={{ background: '#111827' }}>
          {[
            { id: 'current' as const, label: 'This week' },
            { id: 'history' as const, label: 'History' },
            { id: 'reports' as const, label: 'Reports' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)} className={`py-2 rounded-lg text-xs font-semibold ${view === tab.id ? 'bg-amber-500 text-[#0d1117]' : 'text-[#64748b]'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 space-y-3 pb-6">
        {view === 'current' && (
          <>
            <div className="rounded-xl border border-emerald-500/30 p-5 text-center" style={{ background: '#10b98110' }}>
              <div className="text-xs text-emerald-400 font-mono font-semibold mb-1">NET PAY THIS WEEK</div>
              <div className="text-3xl font-bold font-mono text-[#e8edf5]">$1,187.20</div>
              <div className="text-xs text-[#64748b] mt-1">Gross $1,836.80 – deductions $649.60</div>
            </div>
            <div className="rounded-xl border border-[#1e2d47]" style={{ background: '#111827' }}>
              <div className="px-4 py-3 border-b border-[#1e2d47] text-xs font-semibold text-[#64748b] uppercase tracking-wide">Loads this period</div>
              {[['LD-10482', 'Dallas → Memphis', 686], ['LD-10468', 'Dallas → Little Rock · TONU', 70], ['LD-10459', 'Memphis → Houston', 1080.80]].map(([id, route, amount]) => (
                <div key={String(id)} className="flex items-center justify-between px-4 py-3 border-b border-[#1e2d47] last:border-0">
                  <div><div className="text-xs font-mono text-amber-400">{String(id)}</div><div className="text-xs text-[#64748b] mt-0.5">{String(route)}</div></div>
                  <div className="font-mono text-sm text-[#e8edf5]">${(amount as number).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#1e2d47] divide-y divide-[#1e2d47]" style={{ background: '#111827' }}>
              {[['Fuel card', -349.60], ['Insurance', -150], ['Escrow installment', -100], ['Cash advance', -50]].map(([label, amount]) => (
                <div key={String(label)} className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-[#64748b]">{String(label)}</span><span className="text-xs font-mono text-red-400">${(amount as number).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedDocument(reports[0])} className="w-full py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-semibold">View breakdown + PDF</button>
          </>
        )}
        {view === 'history' && settlements.map(settlement => (
          <div key={settlement.title} className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
            <div className="flex items-start justify-between">
              <div><div className="text-xs font-mono text-amber-400">{settlement.title.replace('Settlement ', '')}</div><div className="text-sm font-semibold text-[#e8edf5] mt-1">{settlement.period}</div><div className="text-xs text-emerald-400 mt-0.5">{settlement.status}</div></div>
              <div className="text-right"><div className="text-xs text-[#64748b]">Net pay</div><div className="font-mono text-lg font-bold text-[#e8edf5]">${settlement.net.toFixed(2)}</div></div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#1e2d47] text-center">
              <div><div className="text-[10px] text-[#475569]">GROSS</div><div className="text-xs font-mono text-[#94a3b8]">${settlement.gross.toFixed(2)}</div></div>
              <div><div className="text-[10px] text-[#475569]">DEDUCTIONS</div><div className="text-xs font-mono text-red-400">−${settlement.deductions.toFixed(2)}</div></div>
              <div><div className="text-[10px] text-[#475569]">LOADS</div><div className="text-xs font-mono text-[#94a3b8]">{settlement.loads}</div></div>
            </div>
            <button onClick={() => setSelectedDocument(settlement)} className="w-full mt-3 py-2.5 rounded-lg border border-blue-500/30 text-blue-400 text-xs font-semibold">View breakdown + PDF</button>
          </div>
        ))}
        {view === 'reports' && (
          <div className="grid grid-cols-2 gap-3">
            {reports.map(report => (
              <button key={report.title} onClick={() => setSelectedDocument(report)} className="rounded-xl border border-[#1e2d47] p-4 text-left" style={{ background: '#111827' }}>
                <div className="text-[10px] font-semibold text-[#64748b] uppercase">{report.title.replace(' earnings report', '')}</div>
                <div className="font-mono text-xl font-bold text-[#e8edf5] mt-2">${report.net.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                <div className="text-xs text-[#475569] mt-1">{report.loads} loads · net pay</div>
                <div className="text-xs text-blue-400 mt-3">View report →</div>
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedDocument && (
        <div className="absolute inset-0 z-30 flex flex-col" style={{ background: '#0d1117' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d47]">
            <div><div className="text-sm font-bold text-[#e8edf5]">Pay statement PDF</div><div className="text-xs text-[#64748b]">{selectedDocument.title}.pdf</div></div>
            <button onClick={() => setSelectedDocument(null)} className="text-[#64748b]" aria-label="Close pay PDF"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-[#070c18]">
            <div className="bg-white text-slate-900 p-6 min-h-full">
              <div className="flex justify-between border-b border-slate-200 pb-5"><div><div className="text-xl font-bold">iWay Dispatch</div><div className="text-xs text-slate-500">Driver pay statement</div></div><div className="text-right"><div className="text-xs font-bold">{selectedDocument.title}</div><div className="text-xs text-slate-500">{selectedDocument.period}</div><div className="text-xs text-emerald-700">{selectedDocument.status}</div></div></div>
              <div className="grid grid-cols-3 py-5 border-b border-slate-200 text-center">
                <div><div className="text-[10px] text-slate-500">GROSS</div><div className="font-mono font-bold">${selectedDocument.gross.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-slate-500">DEDUCTIONS</div><div className="font-mono font-bold text-red-700">−${selectedDocument.deductions.toFixed(2)}</div></div>
                <div><div className="text-[10px] text-slate-500">NET PAY</div><div className="font-mono font-bold text-emerald-700">${selectedDocument.net.toFixed(2)}</div></div>
              </div>
              <div className="py-5"><div className="text-xs font-bold text-slate-500 mb-3">BREAKDOWN · {selectedDocument.loads} LOADS</div><div className="border border-slate-200 rounded">
                {selectedDocument.rows.map((row, index) => <div key={`${row.label}-${index}`} className={`flex justify-between gap-4 px-3 py-3 ${index ? 'border-t border-slate-200' : ''}`}><div><div className="text-xs font-semibold">{row.label}</div><div className="text-[10px] text-slate-500">{row.detail}</div></div><div className={`font-mono text-xs font-semibold ${row.amount < 0 ? 'text-red-700' : ''}`}>{row.amount < 0 ? '−' : ''}${Math.abs(row.amount).toFixed(2)}</div></div>)}
              </div></div>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-[#1e2d47]"><button onClick={() => window.print()} className="w-full py-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-semibold">Print or save PDF</button></div>
        </div>
      )}
    </div>
  )
}

/* ── Chat Tab ── */
function ChatTab({ dispatcher, loadId }: { dispatcher: DispatcherRecord; loadId: string }) {
  const [msg, setMsg] = useState('')
  const MESSAGES = [
    { from: dispatcher.name, text: `Good morning — ${loadId} is ready for pickup. Message or call me if anything changes.`, time: '07:15', mine: false },
    { from: 'me', text: "Got it, heading there now.", time: '07:32', mine: true },
    { from: dispatcher.name, text: 'Great. Use the stop reference in the load details and confirm arrival in the app.', time: '07:33', mine: false },
  ]
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 pt-3 pb-3 border-b border-[#1e2d47] shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div><div className="text-base font-bold text-[#e8edf5]">Chat · {loadId}</div><div className="text-xs text-[#64748b] mt-0.5">{dispatcher.name} · Assigned dispatcher</div></div>
          <button onClick={() => { window.location.href = `tel:${dispatcher.phone.replace(/\D/g, '')}` }} className="w-9 h-9 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center" aria-label={`Call ${dispatcher.name}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M5 4h4l2 5-3 2a14 14 0 006 6l2-3 5 2v4a2 2 0 01-2 2C9.6 22 2 14.4 2 5a2 2 0 012-2h1z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {MESSAGES.map((m, i) => (
          <div key={i} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.mine ? 'rounded-br-sm' : 'rounded-bl-sm'}`} style={{ background: m.mine ? '#f59e0b' : '#1e2d47' }}>
              <div className="text-sm" style={{ color: m.mine ? '#0d1117' : '#e8edf5' }}>{m.text}</div>
              <div className="text-xs mt-0.5" style={{ color: m.mine ? '#0d111780' : '#475569' }}>{m.time}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-[#1e2d47] flex items-center gap-2 shrink-0">
        <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message dispatcher…" className="flex-1 bg-[#1e2d47] rounded-full px-4 py-2.5 text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none" />
        <button className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: '#f59e0b' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#0d1117" strokeWidth="2.5" className="w-4 h-4">
            <path d="M12 19V5m-7 7l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ── Profile Tab ── */
function ProfileTab({ user, onLogout, onBack }: { user: ReturnType<typeof useAuth>['user']; onLogout: () => void; onBack: () => void }) {
  const depositStorageKey = `iway_direct_deposit_${user?.id || 'driver'}`
  const [showDirectDeposit, setShowDirectDeposit] = useState(false)
  const [activeProfilePage, setActiveProfilePage] = useState<'notifications' | 'password' | 'help' | null>(null)
  const [editingDeposit, setEditingDeposit] = useState(false)
  const [depositSaved, setDepositSaved] = useState(false)
  const [depositError, setDepositError] = useState('')
  const [deposit, setDeposit] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(depositStorageKey) || 'null') || {
        accountHolder: user?.name || 'Driver',
        bankName: 'Chase Bank',
        accountType: 'Checking',
        routingNumber: '111000025',
        accountNumber: '4821093842',
        allocation: '100',
      }
    } catch {
      return { accountHolder: user?.name || 'Driver', bankName: 'Chase Bank', accountType: 'Checking', routingNumber: '111000025', accountNumber: '4821093842', allocation: '100' }
    }
  })

  function saveDirectDeposit() {
    if (!deposit.accountHolder.trim() || !deposit.bankName.trim()) {
      setDepositError('Account holder and bank name are required')
      return
    }
    if (!/^\d{9}$/.test(deposit.routingNumber)) {
      setDepositError('Routing number must contain 9 digits')
      return
    }
    if (!/^\d{4,17}$/.test(deposit.accountNumber)) {
      setDepositError('Enter a valid account number')
      return
    }
    localStorage.setItem(depositStorageKey, JSON.stringify(deposit))
    setDepositError('')
    setDepositSaved(true)
    setTimeout(() => {
      setDepositSaved(false)
      setEditingDeposit(false)
    }, 900)
  }

  if (showDirectDeposit) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-5 pt-4 pb-3 border-b border-[#1e2d47] shrink-0">
          <button onClick={() => { setShowDirectDeposit(false); setEditingDeposit(false) }} className="flex items-center gap-1.5 text-xs text-[#64748b] mb-3">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" /></svg>
            Profile
          </button>
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-lg font-bold text-[#e8edf5]">Direct deposit</div><div className="text-xs text-[#64748b] mt-0.5">Manage where your approved settlements are deposited</div></div>
            {!editingDeposit && <button onClick={() => setEditingDeposit(true)} className="text-xs px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 font-semibold">Edit</button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-6">
          {depositSaved && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-400">Direct deposit information updated successfully.</div>}
          <div className="rounded-xl border border-emerald-500/25 px-4 py-3 flex items-center gap-3" style={{ background: '#10b98110' }}>
            <span className="w-9 h-9 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M5 13l4 4L19 7" strokeLinecap="round" /></svg>
            </span>
            <div><div className="text-sm font-semibold text-emerald-300">Account verified</div><div className="text-xs text-[#64748b] mt-0.5">Settlement payments are enabled</div></div>
          </div>

          {editingDeposit ? (
            <div className="rounded-xl border border-[#1e2d47] p-4 space-y-4" style={{ background: '#111827' }}>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">Changes may require bank verification before the next settlement is released.</div>
              <label className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">Account holder name</span><input value={deposit.accountHolder} onChange={event => setDeposit((current: typeof deposit) => ({ ...current, accountHolder: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none focus:border-amber-500/40" /></label>
              <label className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">Bank name</span><input value={deposit.bankName} onChange={event => setDeposit((current: typeof deposit) => ({ ...current, bankName: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none focus:border-amber-500/40" /></label>
              <label className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">Account type</span><select value={deposit.accountType} onChange={event => setDeposit((current: typeof deposit) => ({ ...current, accountType: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none"><option>Checking</option><option>Savings</option></select></label>
              <label className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">Routing number</span><input inputMode="numeric" maxLength={9} value={deposit.routingNumber} onChange={event => setDeposit((current: typeof deposit) => ({ ...current, routingNumber: event.target.value.replace(/\D/g, '') }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm font-mono text-[#e8edf5] focus:outline-none focus:border-amber-500/40" /></label>
              <label className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">Account number</span><input inputMode="numeric" value={deposit.accountNumber} onChange={event => setDeposit((current: typeof deposit) => ({ ...current, accountNumber: event.target.value.replace(/\D/g, '') }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm font-mono text-[#e8edf5] focus:outline-none focus:border-amber-500/40" /></label>
              <label className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">Deposit allocation</span><div className="flex items-center rounded-xl border border-[#1e2d47] bg-[#0d1424]"><input type="number" min="1" max="100" value={deposit.allocation} onChange={event => setDeposit((current: typeof deposit) => ({ ...current, allocation: event.target.value }))} className="w-full px-3 py-3 bg-transparent text-sm font-mono text-[#e8edf5] focus:outline-none" /><span className="pr-3 text-[#64748b]">%</span></div></label>
              {depositError && <div className="text-xs text-red-400">{depositError}</div>}
              <div className="flex gap-3"><button onClick={() => setEditingDeposit(false)} className="flex-1 py-3 rounded-xl border border-[#1e2d47] text-sm text-[#64748b]">Cancel</button><button onClick={saveDirectDeposit} className="flex-1 py-3 rounded-xl bg-amber-500 text-[#0d1117] text-sm font-semibold">Save changes</button></div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
              <div className="text-sm font-bold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Bank account</div>
              {[
                ['Account holder', deposit.accountHolder],
                ['Bank', deposit.bankName],
                ['Account type', deposit.accountType],
                ['Routing number', `•••••${deposit.routingNumber.slice(-4)}`],
                ['Account number', `••••••${deposit.accountNumber.slice(-4)}`],
                ['Deposit allocation', `${deposit.allocation}% of net settlement`],
              ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 py-3 border-b border-[#1e2d47] last:border-0"><span className="text-xs text-[#64748b]">{label}</span><span className={`text-xs text-[#e8edf5] text-right ${label.includes('number') ? 'font-mono' : ''}`}>{value}</span></div>)}
            </div>
          )}
          <div className="rounded-xl border border-[#1e2d47] px-4 py-3 text-xs text-[#64748b]" style={{ background: '#111827' }}>For security, account numbers are masked after saving. Contact carrier accounting if a settlement was sent to an old account.</div>
        </div>
      </div>
    )
  }

  if (activeProfilePage) {
    return <ProfileUtilityPage page={activeProfilePage} user={user} onBack={() => setActiveProfilePage(null)} />
  }

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/30 border-2 border-emerald-500/50 flex items-center justify-center text-lg font-bold text-emerald-300">
            {user?.name?.split(' ').map((n: string) => n[0]).join('') || 'JD'}
          </div>
          <div>
            <div className="font-bold text-[#e8edf5]">{user?.name || 'Jordan Driver'}</div>
            <div className="text-xs text-[#64748b] mt-0.5">{user?.role || 'Carrier Driver'}</div>
            <div className="text-xs text-emerald-400 mt-0.5">Dispatch eligible ✓</div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1e2d47] divide-y divide-[#1e2d47]" style={{ background: '#111827' }}>
          {[
            ['Carrier', 'ABC Transport Co.'],
            ['Truck', 'T-104 · 2021 Kenworth T680'],
            ['CDL', 'TX · CDL-A · Exp Oct 2030'],
            ['Driver ID', 'DRV-001'],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-4 py-3">
              <span className="text-xs text-[#64748b]">{k}</span>
              <span className="text-xs text-[#94a3b8]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 space-y-2.5 pb-8">
        {['Notification settings', 'Direct deposit', 'Change password', 'Help & support'].map((item) => (
          <button
            key={item}
            onClick={() => {
              if (item === 'Direct deposit') setShowDirectDeposit(true)
              if (item === 'Notification settings') setActiveProfilePage('notifications')
              if (item === 'Change password') setActiveProfilePage('password')
              if (item === 'Help & support') setActiveProfilePage('help')
            }}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-[#1e2d47] text-sm text-[#94a3b8] text-left hover:bg-[#111827]"
            style={{ background: '#111827' }}
          >
            {item}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-[#475569]"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        ))}
        <button onClick={onLogout} className="w-full py-4 rounded-xl border border-red-500/30 text-sm font-semibold text-red-400 mt-2">Sign out</button>
        <button onClick={onBack} className="w-full py-3 text-xs text-[#475569]">← Back to iWay home</button>
      </div>
    </div>
  )
}

function ProfileUtilityPage({ page, user, onBack }: {
  page: 'notifications' | 'password' | 'help'
  user: ReturnType<typeof useAuth>['user']
  onBack: () => void
}) {
  const notificationKey = `iway_notifications_${user?.id || 'driver'}`
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(notificationKey) || 'null') || {
        loadAssignments: true, stopReminders: true, dispatcherMessages: true, payUpdates: true,
        documentExpiry: true, push: true, sms: true, email: false,
      }
    } catch {
      return { loadAssignments: true, stopReminders: true, dispatcherMessages: true, payUpdates: true, documentExpiry: true, push: true, sms: true, email: false }
    }
  })
  const [saved, setSaved] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [supportForm, setSupportForm] = useState({ category: 'Load or dispatch question', message: '' })
  const [supportSent, setSupportSent] = useState(false)
  const titles = { notifications: 'Notification settings', password: 'Change password', help: 'Help & support' }

  function saveNotifications() {
    localStorage.setItem(notificationKey, JSON.stringify(notifications))
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  function updatePassword() {
    if (!passwords.current) {
      setPasswordError('Enter your current password')
      return
    }
    if (passwords.next.length < 8 || !/[A-Z]/.test(passwords.next) || !/\d/.test(passwords.next)) {
      setPasswordError('New password must be at least 8 characters with one uppercase letter and one number')
      return
    }
    if (passwords.next !== passwords.confirm) {
      setPasswordError('New passwords do not match')
      return
    }
    setPasswordError('')
    setSaved(true)
    setPasswords({ current: '', next: '', confirm: '' })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[#1e2d47] shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[#64748b] mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5"><path d="M10 19l-7-7m0 0l7-7m-7 7h18" strokeLinecap="round" /></svg>
          Profile
        </button>
        <div className="text-lg font-bold text-[#e8edf5]">{titles[page]}</div>
        <div className="text-xs text-[#64748b] mt-0.5">
          {page === 'notifications' ? 'Choose how and when iWay contacts you' : page === 'password' ? 'Keep your Driver App account secure' : 'Get help from dispatch, accounting or iWay support'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-6">
        {saved && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-400">{page === 'password' ? 'Password updated successfully.' : 'Settings saved successfully.'}</div>}

        {page === 'notifications' && (
          <>
            <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
              <div className="text-sm font-bold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Notification topics</div>
              {[
                ['loadAssignments', 'Load assignments', 'New, changed or cancelled loads'],
                ['stopReminders', 'Pickup + delivery reminders', 'Appointments, geofence and detention alerts'],
                ['dispatcherMessages', 'Dispatcher messages', 'New chat messages and urgent notices'],
                ['payUpdates', 'Pay + settlement updates', 'Settlement approval and direct-deposit status'],
                ['documentExpiry', 'Document expiration', 'CDL, medical card and compliance reminders'],
              ].map(([key, label, detail]) => (
                <button key={key} onClick={() => setNotifications(current => ({ ...current, [key]: !current[key] }))} className="w-full flex items-center justify-between gap-4 py-3 border-b border-[#1e2d47] last:border-0 text-left">
                  <span><span className="block text-sm text-[#e8edf5]">{label}</span><span className="block text-xs text-[#64748b] mt-0.5">{detail}</span></span>
                  <span className={`w-10 h-6 rounded-full p-1 shrink-0 ${notifications[key] ? 'bg-emerald-500' : 'bg-[#1e2d47]'}`}><span className={`block w-4 h-4 rounded-full bg-white transition-transform ${notifications[key] ? 'translate-x-4' : ''}`} /></span>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
              <div className="text-sm font-bold text-[#e8edf5] pb-3 border-b border-[#1e2d47]">Delivery channels</div>
              {[['push', 'Push notifications', 'Recommended'], ['sms', 'Text messages', user?.phone || 'Mobile number on file'], ['email', 'Email', user?.email || 'Email on file']].map(([key, label, detail]) => (
                <button key={key} onClick={() => setNotifications(current => ({ ...current, [key]: !current[key] }))} className="w-full flex items-center justify-between gap-4 py-3 border-b border-[#1e2d47] last:border-0 text-left">
                  <span><span className="block text-sm text-[#e8edf5]">{label}</span><span className="block text-xs text-[#64748b] mt-0.5">{detail}</span></span>
                  <span className={`w-10 h-6 rounded-full p-1 shrink-0 ${notifications[key] ? 'bg-emerald-500' : 'bg-[#1e2d47]'}`}><span className={`block w-4 h-4 rounded-full bg-white transition-transform ${notifications[key] ? 'translate-x-4' : ''}`} /></span>
                </button>
              ))}
            </div>
            <button onClick={saveNotifications} className="w-full py-3.5 rounded-xl bg-amber-500 text-[#0d1117] text-sm font-semibold">Save notification settings</button>
          </>
        )}

        {page === 'password' && (
          <div className="rounded-xl border border-[#1e2d47] p-4 space-y-4" style={{ background: '#111827' }}>
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2.5 text-xs text-blue-300">Use at least 8 characters with one uppercase letter and one number.</div>
            {[
              ['current', 'Current password'],
              ['next', 'New password'],
              ['confirm', 'Confirm new password'],
            ].map(([key, label]) => (
              <label key={key} className="block"><span className="block text-xs text-[#94a3b8] mb-1.5">{label}</span><input type={showPasswords ? 'text' : 'password'} value={passwords[key as keyof typeof passwords]} onChange={event => setPasswords(current => ({ ...current, [key]: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none focus:border-amber-500/40" /></label>
            ))}
            <button onClick={() => setShowPasswords(!showPasswords)} className="text-xs text-blue-400">{showPasswords ? 'Hide passwords' : 'Show passwords'}</button>
            {passwordError && <div className="text-xs text-red-400">{passwordError}</div>}
            <button onClick={updatePassword} className="w-full py-3.5 rounded-xl bg-amber-500 text-[#0d1117] text-sm font-semibold">Update password</button>
          </div>
        )}

        {page === 'help' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[['Call dispatch', '(214) 555-0100', 'Available 24/7'], ['Carrier accounting', '(214) 555-0133', 'Mon–Fri · 8am–5pm']].map(([label, phone, hours]) => (
                <a key={label} href={`tel:${phone.replace(/\D/g, '')}`} className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
                  <span className="block text-sm font-semibold text-[#e8edf5]">{label}</span><span className="block text-xs text-blue-400 mt-2">{phone}</span><span className="block text-[10px] text-[#475569] mt-1">{hours}</span>
                </a>
              ))}
            </div>
            <div className="rounded-xl border border-[#1e2d47] p-4" style={{ background: '#111827' }}>
              <div className="text-sm font-bold text-[#e8edf5] mb-3">Frequently asked questions</div>
              {['How do I update a BOL or POD?', 'Why is my settlement amount different?', 'How do I report a truck defect?', 'What if geofence check-in does not work?'].map(question => (
                <button key={question} className="w-full flex items-center justify-between gap-3 py-3 border-b border-[#1e2d47] last:border-0 text-xs text-[#94a3b8] text-left">{question}<span className="text-[#475569]">›</span></button>
              ))}
            </div>
            <div className="rounded-xl border border-[#1e2d47] p-4 space-y-3" style={{ background: '#111827' }}>
              <div><div className="text-sm font-bold text-[#e8edf5]">Send a support request</div><div className="text-xs text-[#64748b] mt-0.5">Your carrier team and iWay support will receive it.</div></div>
              {supportSent ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-4 text-center"><div className="text-sm font-semibold text-emerald-400">Request submitted</div><div className="text-xs text-[#64748b] mt-1">Case DRV-{Date.now().toString().slice(-5)} was created.</div></div>
              ) : (
                <>
                  <select value={supportForm.category} onChange={event => setSupportForm(current => ({ ...current, category: event.target.value }))} className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] focus:outline-none"><option>Load or dispatch question</option><option>Pay or settlement issue</option><option>Driver document issue</option><option>Truck or maintenance issue</option><option>App technical issue</option></select>
                  <textarea value={supportForm.message} onChange={event => setSupportForm(current => ({ ...current, message: event.target.value }))} rows={4} placeholder="Describe what you need help with" className="w-full px-3 py-3 rounded-xl border border-[#1e2d47] bg-[#0d1424] text-sm text-[#e8edf5] placeholder-[#475569] focus:outline-none resize-none" />
                  <button disabled={!supportForm.message.trim()} onClick={() => setSupportSent(true)} className="w-full py-3.5 rounded-xl bg-amber-500 text-[#0d1117] text-sm font-semibold disabled:opacity-40">Submit support request</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Tab bar icons ── */
function TruckIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#475569'} strokeWidth="1.5" className="w-5 h-5">
      <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path d="M13 6h4l3 5v4h-3m-4 0H3V6a1 1 0 011-1h9v12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function VehicleIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#475569'} strokeWidth="1.5" className="w-5 h-5">
      <path d="M4 15V8a2 2 0 012-2h8a2 2 0 012 2v7M16 10h2.5l2.5 3v2h-2M6 18a2 2 0 100-4 2 2 0 000 4zm11 0a2 2 0 100-4 2 2 0 000 4zM8 16h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function DocIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#475569'} strokeWidth="1.5" className="w-5 h-5">
      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function PayIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#475569'} strokeWidth="1.5" className="w-5 h-5">
      <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#475569'} strokeWidth="1.5" className="w-5 h-5">
      <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={active ? '#f59e0b' : '#475569'} strokeWidth="1.5" className="w-5 h-5">
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
