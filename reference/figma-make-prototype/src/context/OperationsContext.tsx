import { createContext, ReactNode, useContext, useEffect, useState } from 'react'

export type WorkflowLoadStatus = 'New request' | 'Assigned' | 'Accepted' | 'In transit' | 'Completed'

export interface WorkflowStop {
  type: 'PICKUP' | 'DROP-OFF'
  facility: string
  address: string
  city: string
  state: string
  date: string
  windowFrom: string
  windowTo: string
  ref: string
}

export interface WorkflowLoad {
  id: string
  broker: string
  brokerEmail: string
  dispatcher: string
  commodity: string
  miles: number
  weight: string
  rate: number
  equipment: string
  paymentTerms: string
  stops: WorkflowStop[]
  status: WorkflowLoadStatus
  driver: string
  truck: string
  completedStopIndexes: number[]
  completedAt?: string
  bolDocument?: {
    number: string
    driverSignature: string
    shipperSignature: string
    receiverSignature: string
    pickupSignedAt?: string
    deliverySignedAt?: string
  }
}

export interface BrokerNotification {
  id: string
  loadId: string
  broker: string
  email: string
  event: 'Pickup completed' | 'Delivery completed' | 'BOL uploaded' | 'POD uploaded'
  stop: string
  attachment?: string
  sentAt: string
  status: 'Delivered'
}

export interface FinancialSettings {
  driverPercent: number
  truckPercent: number
  driverWeeklyDeduction: number
  truckWeeklyDeduction: number
}

export interface DriverDocument {
  id: string
  driverId: string
  driverName: string
  driverPhone: string
  name: string
  documentNumber: string
  expirationDate: string
  fileName: string
  fileType: string
  uploadedAt: string
  status: 'Pending review' | 'Approved' | 'Needs changes'
}

export interface VehicleServiceRecord {
  id: string
  vehicleUnit: string
  date: string
  category: string
  odometer: string
  vendor: string
  amount: string
  notes: string
  receipt: boolean
  submittedBy: string
  source: 'Driver App' | 'Carrier Admin'
  createdAt: string
}

export interface FleetVehicle {
  unit: string
  vin: string
  type: string
  plate: string
  owner: string
  driver: string
  status: string
  load: string
  rpm: string
  miles: string
  driverShare?: string
  ownerShare?: string
  adminFee?: string
  deductions?: string
  currentLocation?: string
  revenueMonth?: string
  deductionItems?: { id: string; label: string; amount: string }[]
  annualDotExpiry?: string
  registrationExpiry?: string
  physicalDamageExpiry?: string
  form2290Expiry?: string
  nyHutPermit?: string
  nonTruckingExpiry?: string
  nextServiceMiles?: string
  odometer?: string
  serviceIntervalMiles?: string
  geoTrackedMiles?: number
  trailer?: string
}

function mileageNumber(value?: string) {
  return Number((value || '0').replace(/[^\d.]/g, '')) || 0
}

export function getVehicleServiceProjection(vehicle: FleetVehicle, loads: WorkflowLoad[]) {
  const serviceInterval = mileageNumber(vehicle.serviceIntervalMiles || '10000')
  const recordedMilesSinceService = mileageNumber(vehicle.miles)
  const loadDistanceMiles = loads
    .filter(load => load.truck === vehicle.unit && (load.status === 'In transit' || load.status === 'Completed'))
    .reduce((sum, load) => {
      const completionRatio = load.status === 'Completed'
        ? 1
        : load.completedStopIndexes.length / Math.max(load.stops.length, 1)
      return sum + load.miles * completionRatio
    }, 0)
  const geoTrackedMiles = vehicle.status === 'In use' && vehicle.driver !== '—' ? vehicle.geoTrackedMiles || 0 : 0
  const milesSinceService = Math.max(recordedMilesSinceService, loadDistanceMiles + geoTrackedMiles)
  const milesRemaining = Math.max(0, serviceInterval - milesSinceService)
  const dueSoonThreshold = Math.max(500, serviceInterval * 0.1)
  return {
    serviceInterval,
    recordedMilesSinceService,
    loadDistanceMiles,
    geoTrackedMiles,
    milesSinceService,
    milesRemaining,
    dueSoon: milesRemaining <= dueSoonThreshold,
    overdue: milesSinceService >= serviceInterval,
  }
}

interface NewLoadInput {
  id: string
  broker: string
  brokerEmail: string
  dispatcher: string
  commodity: string
  miles: number
  weight: string
  rate: number
  paymentTerms: string
  stops: WorkflowStop[]
}

interface OperationsContextValue {
  loads: WorkflowLoad[]
  notifications: BrokerNotification[]
  vehicles: FleetVehicle[]
  driverDocuments: DriverDocument[]
  serviceRecords: VehicleServiceRecord[]
  financialSettings: FinancialSettings
  createLoad: (load: NewLoadInput) => void
  assignLoad: (id: string, driver: string, truck: string) => void
  setLoadStatus: (id: string, status: WorkflowLoadStatus) => void
  completeStop: (id: string, stopIndex: number) => void
  sendDocumentNotification: (id: string, stopIndex: number, document: 'BOL' | 'POD') => void
  updateBolDocument: (id: string, document: NonNullable<WorkflowLoad['bolDocument']>) => void
  updateFinancialSettings: (settings: FinancialSettings) => void
  addVehicle: (vehicle: FleetVehicle) => void
  updateVehicle: (unit: string, vehicle: FleetVehicle) => void
  addDriverDocument: (document: DriverDocument) => void
  addServiceRecord: (record: VehicleServiceRecord) => void
}

const STORAGE_KEY = 'iway_operations'
const OperationsContext = createContext<OperationsContextValue | null>(null)

const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  driverPercent: 28,
  truckPercent: 72,
  driverWeeklyDeduction: 150,
  truckWeeklyDeduction: 225,
}

const DEFAULT_VEHICLES: FleetVehicle[] = [
  { unit: 'T-104', vin: '3AKJHHDR5MSLX1562', type: 'Tractor · sleeper', plate: 'TX · R4K-2291', owner: 'Crossway Trucking LLC', driver: 'J. Carter', status: 'In use', load: 'LD-10482', rpm: '$2.61', miles: '8,940', currentLocation: 'I-40 · Forrest City, AR', revenueMonth: '14380', annualDotExpiry: 'Valid · Mar 2027', registrationExpiry: 'Valid · Jan 2027', physicalDamageExpiry: '21 days', form2290Expiry: 'Valid · Aug 2027', nyHutPermit: 'Missing', nonTruckingExpiry: 'Valid · Dec 2026', nextServiceMiles: '1060', serviceIntervalMiles: '10000', geoTrackedMiles: 0, odometer: '211,480 mi', trailer: "TR-221 · 53' dry van" },
  { unit: 'T-108', vin: '1FUJGHDV7ML8901', type: 'Tractor · day cab', plate: 'TX · M8P-5512', owner: 'Current Way Logistics', driver: 'A. Bekele', status: 'In use', load: 'LD-10477', rpm: '$2.34', miles: '12,200', currentLocation: 'Tulsa, OK', annualDotExpiry: 'Valid · Feb 2027', registrationExpiry: 'Valid · Jan 2027', nextServiceMiles: '780', serviceIntervalMiles: '13000', geoTrackedMiles: 0, odometer: '284,112 mi' },
  { unit: 'T-112', vin: '3HSDJAPR2NN2234', type: 'Tractor · sleeper', plate: 'TX · C3R-9901', owner: 'Delta Haul LLC', driver: 'R. Diaz', status: 'In use', load: 'LD-10479', rpm: '$2.15', miles: '5,100', currentLocation: 'Atlanta, GA', annualDotExpiry: 'Valid · May 2027', registrationExpiry: 'Valid · Jan 2027', nextServiceMiles: '4900', serviceIntervalMiles: '10000', geoTrackedMiles: 0, odometer: '198,330 mi' },
  { unit: 'T-101', vin: '4V4NC9EH8NN5043', type: 'Tractor · sleeper', plate: 'TX · A9L-3312', owner: 'Mike Okafor', driver: 'M. Okafor', status: 'In use', load: 'LD-10471', rpm: '$2.88', miles: '3,450', currentLocation: 'Denver, CO', annualDotExpiry: 'Valid · Apr 2027', registrationExpiry: 'Valid · Feb 2027', nextServiceMiles: '6550', serviceIntervalMiles: '10000', geoTrackedMiles: 0, odometer: '186,240 mi' },
  { unit: 'T-115', vin: '1XKYD49X3PJ7721', type: 'Tractor · day cab', plate: 'TX · W2T-6677', owner: 'Current Way Logistics', driver: 'S. Nwosu', status: 'Available', load: '—', rpm: '—', miles: '18,320', currentLocation: 'Carrier yard · Dallas, TX', annualDotExpiry: 'Valid · Jul 2027', registrationExpiry: 'Valid · Jan 2027', nextServiceMiles: '1680', serviceIntervalMiles: '20000', geoTrackedMiles: 0, odometer: '242,900 mi' },
  { unit: 'TR-221', vin: '—', type: "Trailer · 53' dry van", plate: 'TX · TR-221', owner: 'Current Way Logistics', driver: '—', status: 'In use', load: 'LD-10482', rpm: '—', miles: '—', currentLocation: 'I-40 · Forrest City, AR', annualDotExpiry: 'Valid · Mar 2027', registrationExpiry: 'Valid · Jan 2027' },
]

const DEFAULT_DRIVER_DOCUMENTS: DriverDocument[] = [
  { id: 'DOC-DRV-001-CDL', driverId: 'drv-001', driverName: 'John Smith', driverPhone: '+1 (214) 555-0142', name: 'CDL · Class A', documentNumber: 'CDL-TX-4892101', expirationDate: '2030-10-18', fileName: 'john-smith-cdl.pdf', fileType: 'PDF', uploadedAt: 'Sep 12, 2026, 10:24 AM', status: 'Approved' },
  { id: 'DOC-DRV-001-MED', driverId: 'drv-001', driverName: 'John Smith', driverPhone: '+1 (214) 555-0142', name: 'DOT medical card', documentNumber: 'MED-884210', expirationDate: '2026-10-18', fileName: 'john-smith-medical-card.pdf', fileType: 'PDF', uploadedAt: 'Sep 12, 2026, 10:27 AM', status: 'Approved' },
  { id: 'DOC-DRV-001-ID', driverId: 'drv-001', driverName: 'John Smith', driverPhone: '+1 (214) 555-0142', name: 'Government ID', documentNumber: 'TX-ID-440821', expirationDate: '2031-08-20', fileName: 'john-smith-government-id.jpg', fileType: 'Image', uploadedAt: 'Sep 12, 2026, 10:31 AM', status: 'Approved' },
  { id: 'DOC-DRV-001-APP', driverId: 'drv-001', driverName: 'John Smith', driverPhone: '+1 (214) 555-0142', name: 'Driver application', documentNumber: 'APP-D-001', expirationDate: '', fileName: 'john-smith-driver-application.pdf', fileType: 'PDF', uploadedAt: 'Sep 12, 2026, 10:35 AM', status: 'Approved' },
  { id: 'DOC-DRV-001-W4', driverId: 'drv-001', driverName: 'John Smith', driverPhone: '+1 (214) 555-0142', name: 'W-4', documentNumber: 'W4-2026-D-001', expirationDate: '', fileName: 'john-smith-w4-2026.pdf', fileType: 'PDF', uploadedAt: 'Sep 12, 2026, 10:38 AM', status: 'Approved' },
  { id: 'DOC-DRV-001-MVR', driverId: 'drv-001', driverName: 'John Smith', driverPhone: '+1 (214) 555-0142', name: 'Motor vehicle record', documentNumber: 'MVR-TX-2026-1842', expirationDate: '2027-09-12', fileName: 'john-smith-motor-vehicle-record.pdf', fileType: 'PDF', uploadedAt: 'Sep 12, 2026, 10:41 AM', status: 'Approved' },
]

const DEFAULT_SERVICE_RECORDS: VehicleServiceRecord[] = [
  { id: 'SVC-T104-0618', vehicleUnit: 'T-104', date: 'Jun 18, 2026', category: 'Oil + filter service', odometer: '210,420 mi', vendor: 'Rush Truck Center', amount: '684.20', notes: 'Full preventive-maintenance service completed. Oil and filters replaced.', receipt: true, submittedBy: 'Carrier maintenance', source: 'Carrier Admin', createdAt: 'Jun 18, 2026, 4:18 PM' },
  { id: 'SVC-T101-0618', vehicleUnit: 'T-101', date: 'Jun 18, 2026', category: 'Oil + filter service', odometer: '180,420 mi', vendor: 'Rush Truck Center', amount: '684.20', notes: 'Full preventive-maintenance service completed.', receipt: true, submittedBy: 'Carrier maintenance', source: 'Carrier Admin', createdAt: 'Jun 18, 2026, 4:18 PM' },
]

export function OperationsProvider({ children }: { children: ReactNode }) {
  const [loads, setLoads] = useState<WorkflowLoad[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored).loads || [] : []
    } catch {
      return []
    }
  })
  const [financialSettings, setFinancialSettings] = useState<FinancialSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored).financialSettings || DEFAULT_FINANCIAL_SETTINGS : DEFAULT_FINANCIAL_SETTINGS
    } catch {
      return DEFAULT_FINANCIAL_SETTINGS
    }
  })
  const [notifications, setNotifications] = useState<BrokerNotification[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored).notifications || [] : []
    } catch {
      return []
    }
  })
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored).vehicles || DEFAULT_VEHICLES : DEFAULT_VEHICLES
    } catch {
      return DEFAULT_VEHICLES
    }
  })
  const [driverDocuments, setDriverDocuments] = useState<DriverDocument[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return DEFAULT_DRIVER_DOCUMENTS
      const savedDocuments: DriverDocument[] = JSON.parse(stored).driverDocuments || []
      return [
        ...savedDocuments,
        ...DEFAULT_DRIVER_DOCUMENTS.filter(defaultDocument => !savedDocuments.some(document => document.id === defaultDocument.id)),
      ]
    } catch {
      return DEFAULT_DRIVER_DOCUMENTS
    }
  })
  const [serviceRecords, setServiceRecords] = useState<VehicleServiceRecord[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return DEFAULT_SERVICE_RECORDS
      const savedRecords: VehicleServiceRecord[] = JSON.parse(stored).serviceRecords || []
      return [
        ...savedRecords,
        ...DEFAULT_SERVICE_RECORDS.filter(defaultRecord => !savedRecords.some(record => record.id === defaultRecord.id)),
      ]
    } catch {
      return DEFAULT_SERVICE_RECORDS
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ loads, financialSettings, notifications, vehicles, driverDocuments, serviceRecords }))
  }, [loads, financialSettings, notifications, vehicles, driverDocuments, serviceRecords])

  function createLoad(input: NewLoadInput) {
    setLoads(current => [{
      ...input,
      equipment: "53' dry van",
      status: 'New request',
      driver: '—',
      truck: '—',
      completedStopIndexes: [],
      bolDocument: {
        number: '',
        driverSignature: '',
        shipperSignature: '',
        receiverSignature: '',
      },
    }, ...current.filter(load => load.id !== input.id)])
  }

  function assignLoad(id: string, driver: string, truck: string) {
    setLoads(current => current.map(load => load.id === id ? { ...load, driver, truck, status: 'Assigned' } : load))
    setVehicles(current => current.map(vehicle => vehicle.unit === truck ? { ...vehicle, driver, load: id, status: 'In use' } : vehicle))
  }

  function setLoadStatus(id: string, status: WorkflowLoadStatus) {
    setLoads(current => current.map(load => load.id === id ? {
      ...load,
      status,
      completedAt: status === 'Completed' ? new Date().toISOString() : load.completedAt,
    } : load))
  }

  function completeStop(id: string, stopIndex: number) {
    const activeLoad = loads.find(load => load.id === id)
    const completedStop = activeLoad?.stops[stopIndex]
    if (activeLoad && completedStop) {
      const event = completedStop.type === 'PICKUP' ? 'Pickup completed' : 'Delivery completed'
      const notificationId = `${id}-${stopIndex}-${event}`
      setNotifications(current => current.some(notification => notification.id === notificationId) ? current : [{
        id: notificationId,
        loadId: id,
        broker: activeLoad.broker,
        email: activeLoad.brokerEmail,
        event,
        stop: completedStop.facility || `${completedStop.city}, ${completedStop.state}`,
        sentAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
        status: 'Delivered',
      }, ...current])
    }
    if (activeLoad?.truck && activeLoad.truck !== '—' && !activeLoad.completedStopIndexes.includes(stopIndex)) {
      const distanceReading = activeLoad.miles / Math.max(activeLoad.stops.length, 1)
      setVehicles(current => current.map(vehicle =>
        vehicle.unit === activeLoad.truck && vehicle.status === 'In use' && vehicle.driver !== '—'
          ? { ...vehicle, geoTrackedMiles: (vehicle.geoTrackedMiles || 0) + distanceReading }
          : vehicle,
      ))
    }
    setLoads(current => current.map(load => {
      if (load.id !== id) return load
      const completedStopIndexes = Array.from(new Set([...load.completedStopIndexes, stopIndex]))
      const isComplete = completedStopIndexes.length >= load.stops.length
      return {
        ...load,
        completedStopIndexes,
        status: isComplete ? 'Completed' : 'In transit',
        completedAt: isComplete ? new Date().toISOString() : load.completedAt,
      }
    }))
  }

  function sendDocumentNotification(id: string, stopIndex: number, document: 'BOL' | 'POD') {
    const activeLoad = loads.find(load => load.id === id)
    const stop = activeLoad?.stops[stopIndex]
    if (!activeLoad || !stop) return
    const event = document === 'BOL' ? 'BOL uploaded' : 'POD uploaded'
    const notificationId = `${id}-${stopIndex}-${event}`
    setNotifications(current => current.some(notification => notification.id === notificationId) ? current : [{
      id: notificationId,
      loadId: id,
      broker: activeLoad.broker,
      email: activeLoad.brokerEmail,
      event,
      stop: stop.facility || `${stop.city}, ${stop.state}`,
      attachment: `${id}-${document.toLowerCase()}-stop-${stopIndex + 1}.pdf`,
      sentAt: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
      status: 'Delivered',
    }, ...current])
  }

  return (
    <OperationsContext.Provider value={{
      loads,
      notifications,
      vehicles,
      driverDocuments,
      serviceRecords,
      financialSettings,
      createLoad,
      assignLoad,
      setLoadStatus,
      completeStop,
      sendDocumentNotification,
      updateBolDocument: (id, document) => setLoads(current => current.map(load => load.id === id ? { ...load, bolDocument: document } : load)),
      updateFinancialSettings: setFinancialSettings,
      addVehicle: (vehicle) => setVehicles(current => [vehicle, ...current.filter(item => item.unit !== vehicle.unit)]),
      updateVehicle: (unit, vehicle) => setVehicles(current => current.map(item => item.unit === unit ? vehicle : item)),
      addDriverDocument: (document) => setDriverDocuments(current => [document, ...current.filter(item => item.id !== document.id)]),
      addServiceRecord: (record) => setServiceRecords(current => [record, ...current.filter(item => item.id !== record.id)]),
    }}>
      {children}
    </OperationsContext.Provider>
  )
}

export function useOperations() {
  const context = useContext(OperationsContext)
  if (!context) throw new Error('useOperations must be used within OperationsProvider')
  return context
}
