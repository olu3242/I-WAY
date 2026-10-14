export interface DispatcherRecord {
  id: string
  name: string
  initials: string
  email: string
  phone: string
  status: 'Active' | 'Onboarding' | 'Inactive'
  region: string
  ssnLast4: string
  idStatus: string
  bankStatus: string
  grossLoadPercentage: number
  weekToDate: number
  lastSettlement: number
  monthToDate: number
  yearToDate: number
  activeLoads: number
  completedLoads: number
  onTimePercent: number
}

export const INITIAL_DISPATCHERS: DispatcherRecord[] = [
  { id: 'DSP-001', name: 'Tunji Adeyemi', initials: 'TA', email: 'tunji@currentway.example', phone: '(214) 555-0100', status: 'Active', region: 'Texas + South Central', ssnLast4: '4821', idStatus: 'Verified', bankStatus: 'Verified · ending 1044', grossLoadPercentage: 5, weekToDate: 1480, lastSettlement: 1325, monthToDate: 5920, yearToDate: 48640, activeLoads: 12, completedLoads: 184, onTimePercent: 96 },
  { id: 'DSP-002', name: 'Martin Owens', initials: 'MO', email: 'martin@currentway.example', phone: '(469) 555-0188', status: 'Active', region: 'Southeast', ssnLast4: '7730', idStatus: 'Verified', bankStatus: 'Verified · ending 8892', grossLoadPercentage: 5, weekToDate: 1260, lastSettlement: 1180, monthToDate: 5210, yearToDate: 43780, activeLoads: 9, completedLoads: 162, onTimePercent: 94 },
  { id: 'DSP-003', name: 'Sarah Nwosu', initials: 'SN', email: 'sarah@currentway.example', phone: '(972) 555-0162', status: 'Active', region: 'Midwest', ssnLast4: '2209', idStatus: 'Verified', bankStatus: 'Verified · ending 5510', grossLoadPercentage: 6, weekToDate: 1095, lastSettlement: 1040, monthToDate: 4660, yearToDate: 39120, activeLoads: 8, completedLoads: 149, onTimePercent: 97 },
  { id: 'DSP-004', name: 'Elena Cruz', initials: 'EC', email: 'elena@currentway.example', phone: '(832) 555-0119', status: 'Onboarding', region: 'West', ssnLast4: 'Pending', idStatus: 'Uploaded · review pending', bankStatus: 'Pending', grossLoadPercentage: 5, weekToDate: 0, lastSettlement: 0, monthToDate: 0, yearToDate: 0, activeLoads: 0, completedLoads: 0, onTimePercent: 0 },
]
