import type React from 'react'
import { useLanguage } from '../i18n'
import type { Location, QueueStatusResponse, Service } from '../types/queue'
import { ChakraWatermark } from './ui'

interface IndiaDemoExplorerProps {
  cities: string[]
  selectedCity: string
  onSelectCity: (city: string) => void
  facilities: Location[]
  selectedFacilityId: string
  onSelectFacility: (facilityId: string) => void
  facilityServices: Service[]
  selectedDemoServiceId: string
  onSelectDemoService: (serviceId: string) => void
  demoQueueStatus: QueueStatusResponse | null
  demoQueueLoading: boolean
  demoQueueError: string | null
  onTestServiceInTokenDesk: (serviceId: string) => void
  onCheckQueue?: () => void
}

const ALL_20_CITIES = [
  'Pune',
  'Mumbai',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Delhi',
  'Hyderabad',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Patna',
  'Gurugram',
  'Noida',
  'Surat',
  'Nagpur',
  'Indore',
  'Kochi',
  'Coimbatore',
  'Chandigarh',
  'Vadodara',
]

const CATEGORY_STYLES: Record<string, { color: string; badgeBg: string }> = {
  hospital: {
    color: 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200',
  },
  government_office: {
    color: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200',
  },
  rto: {
    color: 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200',
  },
  municipal_service_centre: {
    color: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200',
  },
  university: {
    color: 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800',
    badgeBg: 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200',
  },
  college: {
    color: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200',
  },
  diagnostic_centre: {
    color: 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800',
    badgeBg: 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200',
  },
  bank: {
    color: 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200 border-cyan-200 dark:border-cyan-800',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200',
  },
  restaurant: {
    color: 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200',
  },
  cafeteria: {
    color: 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    badgeBg: 'bg-yellow-100 dark:bg-yellow-900/60 text-yellow-800 dark:text-yellow-200',
  },
  hotel: {
    color: 'bg-violet-50 dark:bg-violet-950/50 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-800',
    badgeBg: 'bg-violet-100 dark:bg-violet-900/60 text-violet-800 dark:text-violet-200',
  },
  public_service_centre: {
    color: 'bg-lime-50 dark:bg-lime-950/50 text-lime-900 dark:text-lime-200 border-lime-200 dark:border-lime-800',
    badgeBg: 'bg-lime-100 dark:bg-lime-900/60 text-lime-900 dark:text-lime-200',
  },
}

export const IndiaDemoExplorer: React.FC<IndiaDemoExplorerProps> = ({
  cities,
  selectedCity,
  onSelectCity,
  facilities,
  selectedFacilityId,
  onSelectFacility,
  facilityServices,
  selectedDemoServiceId,
  onSelectDemoService,
  demoQueueStatus,
  demoQueueLoading,
  demoQueueError,
  onTestServiceInTokenDesk,
  onCheckQueue,
}) => {
  const { t } = useLanguage()
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId)
  const selectedDemoService = facilityServices.find((s) => s.id === selectedDemoServiceId)
  const otherFacilityServices = facilityServices.filter((s) => s.id !== selectedDemoServiceId)

  // Use cities prop if populated, else fallback to full list of 20
  const activeCityList =
    cities.length > 0 ? Array.from(new Set([...cities, ...ALL_20_CITIES])) : ALL_20_CITIES

  const categoryLabel = selectedFacility?.category
    ? t(`categories.${selectedFacility.category}`) || selectedFacility.category.replace(/_/g, ' ')
    : ''

  const categoryStyle = selectedFacility?.category
    ? CATEGORY_STYLES[selectedFacility.category] || {
        color: 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700',
        badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
      }
    : null

  // Grounded OpenStreetMap navigation URL based on verified facility coordinates
  const osmUrl =
    selectedFacility?.latitude && selectedFacility?.longitude
      ? `https://www.openstreetmap.org/?mlat=${selectedFacility.latitude}&mlon=${selectedFacility.longitude}#map=16/${selectedFacility.latitude}/${selectedFacility.longitude}`
      : null

  return (
    <section aria-labelledby="service-discovery-heading" className="space-y-6">
      {/* SECTION HEADER: Civic Discovery Shell */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs p-5 sm:p-6 space-y-5 transition-colors duration-150 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 pointer-events-none select-none z-0">
          <ChakraWatermark className="w-56 h-56 text-blue-950/[0.025] dark:text-blue-300/[0.018]" />
        </div>
        <div className="relative z-10 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {t('discovery.badge')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-600 font-medium hidden sm:inline">&bull;</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                {t('discovery.motto')}
              </span>
            </div>
            <h2
              id="service-discovery-heading"
              className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
            >
              {t('discovery.heading')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {t('discovery.description')}
            </p>
          </div>

          {/* Simulated Data Badge */}
          <div className="flex items-center space-x-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-3.5 py-1.5 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-semibold shrink-0">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>{t('hero.simulatedBadge')}</span>
          </div>
        </div>

        {/* CITY QUICK SELECTOR BAR: 20 Urban Markets */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <svg className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{t('discovery.selectMarket')}</span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {t('discovery.activeCity')} <strong className="text-slate-900 dark:text-slate-100">{selectedCity}</strong>
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50/70 dark:bg-slate-850/50 rounded-xl border border-slate-200/80 dark:border-slate-800">
            {activeCityList.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => onSelectCity(city)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center space-x-1 select-none ${
                  selectedCity === city
                    ? 'bg-blue-700 text-white shadow-xs font-semibold'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <span>{city}</span>
                {city === 'Pune' && (
                  <span
                    className={`text-[9px] px-1 rounded font-bold uppercase ${
                      selectedCity === 'Pune'
                        ? 'bg-blue-900 text-amber-300'
                        : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                    }`}
                  >
                    {t('common.showcase')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* HORIZONTAL SELECTOR ROW ON DESKTOP: City -> Facility -> Service -> Check Queue */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
          {/* Step 1: City Dropdown */}
          <div className="md:col-span-3 space-y-1">
            <label htmlFor="city-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {t('discovery.step1City')}
            </label>
            <select
              id="city-select"
              value={selectedCity}
              onChange={(e) => onSelectCity(e.target.value)}
              className="w-full text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
            >
              {activeCityList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Facility Dropdown */}
          <div className="md:col-span-4 space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="facility-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('discovery.step2Facility')}
              </label>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                {t('discovery.availableCount', { count: facilities.length })}
              </span>
            </div>
            <select
              id="facility-select"
              value={selectedFacilityId}
              onChange={(e) => onSelectFacility(e.target.value)}
              disabled={facilities.length === 0}
              className="w-full text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs disabled:bg-slate-100 dark:disabled:bg-slate-850 disabled:text-slate-400 dark:disabled:text-slate-600"
            >
              {facilities.length === 0 ? (
                <option value="">{t('discovery.noFacilities')}</option>
              ) : (
                facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Step 3: Service Dropdown */}
          <div className="md:col-span-3 space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="service-select" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                {t('discovery.step3Service')}
              </label>
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                {t('discovery.countersCount', { count: facilityServices.length })}
              </span>
            </div>
            <select
              id="service-select"
              value={selectedDemoServiceId}
              onChange={(e) => onSelectDemoService(e.target.value)}
              disabled={facilityServices.length === 0}
              className="w-full text-xs sm:text-sm border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs disabled:bg-slate-100 dark:disabled:bg-slate-850 disabled:text-slate-400 dark:disabled:text-slate-600"
            >
              {facilityServices.length === 0 ? (
                <option value="">{t('discovery.noServices')}</option>
              ) : (
                facilityServices.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Step 4: Prominent "Check Queue" Action */}
          <div className="md:col-span-2">
            <button
              id="btn-check-queue"
              type="button"
              onClick={() => {
                if (onCheckQueue) {
                  onCheckQueue()
                } else {
                  const projectionEl = document.getElementById('demo-wait-projection')
                  projectionEl?.scrollIntoView({ behavior: 'smooth' })
                }
              }}
              disabled={facilityServices.length === 0}
              className="w-full py-2 px-3 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-2xs cursor-pointer flex items-center justify-center space-x-1.5 select-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>Check Queue</span>
            </button>
          </div>
        </div>

        {/* SPATIAL LOCATION & FACILITY CONTEXT CARD */}
        {selectedFacility && (
          <div
            id="facility-spatial-card"
            className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 p-4 sm:p-5 space-y-3"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {selectedFacility.name}
                  </h3>
                  {categoryStyle && (
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border ${categoryStyle.color}`}
                    >
                      {categoryLabel}
                    </span>
                  )}
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded">
                    {selectedFacility.city}, {selectedFacility.state}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Open &bull; Operational</span>
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <svg
                    className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>{selectedFacility.address}</span>
                </div>
              </div>

              {/* Coordinates Badge & Navigation Link */}
              <div className="flex items-center space-x-2 shrink-0">
                {selectedFacility.latitude && selectedFacility.longitude && (
                  <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg">
                    {selectedFacility.latitude.toFixed(4)}&deg; N, {selectedFacility.longitude.toFixed(4)}&deg; E
                  </span>
                )}
                {osmUrl && (
                  <a
                    href={osmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-lg transition"
                    title="Open physical coordinates in OpenStreetMap"
                  >
                    <span>{t('discovery.viewMap')}</span>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Other Services Available at This Same Facility */}
            {otherFacilityServices.length > 0 && (
              <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t('discovery.otherDesks', { count: otherFacilityServices.length })}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {otherFacilityServices.map((otherSvc) => (
                    <button
                      key={otherSvc.id}
                      type="button"
                      onClick={() => onSelectDemoService(otherSvc.id)}
                      className="text-xs bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-slate-700 dark:text-slate-200 hover:text-blue-900 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 px-2.5 py-1 rounded-lg transition text-left cursor-pointer flex items-center space-x-1.5"
                    >
                      <span className="font-medium">{otherSvc.name}</span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">&rarr;</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ERROR / NOTICE ALERT */}
      {demoQueueError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs sm:text-sm flex items-start space-x-2"
        >
          <svg className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <strong className="font-bold">{t('discovery.catalogNotice')}</strong> {demoQueueError}
          </div>
        </div>
      )}

      {/* QUEUE INTELLIGENCE CARD: Deterministic Estimation Focal Point */}
      {demoQueueLoading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 text-center space-y-3">
          <div className="inline-block animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full" />
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {t('queue.queryingEngine')}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {t('queue.calculatingBounds')}
          </p>
        </div>
      ) : demoQueueStatus && selectedDemoService ? (
        <div
          id="demo-wait-projection"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-100 dark:border-slate-800 shadow-xs p-5 sm:p-6 space-y-5 transition-colors duration-150"
        >
          {/* Card Header: Service identity & Telemetry status */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded">
                  {t('queue.telemetryBadge')}
                </span>
                {demoQueueStatus.estimated_wait.is_available ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{t('queue.estimateAvailable')}</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>{t('queue.estimateUnavailable')}</span>
                  </span>
                )}
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 pt-1">
                {selectedDemoService.name}
              </h3>
              {selectedDemoService.description && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {selectedDemoService.description}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                {t('queue.simulationScenario')}
              </span>
            </div>
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Metric 1: People Ahead */}
            <div className="bg-slate-50/70 dark:bg-slate-850/70 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t('queue.peopleAheadLabel')}
              </span>
              <div className="my-1.5">
                <div
                  id="demo-people-ahead"
                  className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight"
                >
                  {demoQueueStatus.people_ahead}
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('queue.waitingParticipants')}</span>
            </div>

            {/* Metric 2: Active Counters */}
            <div className="bg-slate-50/70 dark:bg-slate-850/70 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t('queue.activeCountersLabel')}
              </span>
              <div className="my-1.5">
                <div
                  id="demo-active-counters"
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${
                    demoQueueStatus.active_counters > 0
                      ? 'text-blue-700 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {demoQueueStatus.active_counters}
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{t('queue.servingDesksActive')}</span>
            </div>

            {/* Metric 3: Deterministic Wait Projection */}
            <div className="bg-slate-50/70 dark:bg-slate-850/70 p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t('queue.deterministicProjection')}
              </span>

              <div className="my-1.5">
                {demoQueueStatus.estimated_wait.is_available ? (
                  <div>
                    <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                      {demoQueueStatus.estimated_wait.lower_minutes}&ndash;
                      {demoQueueStatus.estimated_wait.upper_minutes}{' '}
                      <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">{t('queue.minutes')}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                      <span>{t('queue.expected', { mins: demoQueueStatus.estimated_wait.expected_minutes ?? 0 })}</span>
                      {demoQueueStatus.estimated_wait.confidence && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                            demoQueueStatus.estimated_wait.confidence === 'HIGH'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                              : demoQueueStatus.estimated_wait.confidence === 'MEDIUM'
                                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          }`}
                        >
                          {t('queue.confidence', {
                            level:
                              demoQueueStatus.estimated_wait.confidence === 'HIGH'
                                ? t('queue.confidenceHigh')
                                : demoQueueStatus.estimated_wait.confidence === 'MEDIUM'
                                  ? t('queue.confidenceMedium')
                                  : t('queue.confidenceLow'),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div id="demo-unavailable-msg" className="space-y-1 py-1">
                    <div className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{t('queue.estimateUnavailable')}</span>
                    </div>
                    <p className="text-xs text-amber-950 dark:text-amber-100 font-medium">
                      {demoQueueStatus.estimated_wait.reason}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-0.5">
                      {t('queue.policyNote')}
                    </p>
                  </div>
                )}
              </div>

              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                {demoQueueStatus.estimated_wait.is_available
                  ? t('queue.mathRangeSubtitle')
                  : t('queue.zeroFabricationSubtitle')}
              </span>
            </div>
          </div>

          {/* Mathematical Signals & Explanation */}
          {demoQueueStatus.estimated_wait.is_available && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <svg className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>
                  {t('queue.sampleBaseline', { count: demoQueueStatus.estimated_wait.sample_size })}
                </span>
              </div>
              {typeof demoQueueStatus.estimated_wait.supporting_signals?.service_rate_per_hour ===
                'number' && (
                <div className="text-slate-600 dark:text-slate-400 pl-5">
                  {t('queue.counterThroughput', {
                    rate: (
                      demoQueueStatus.estimated_wait.supporting_signals.service_rate_per_hour as number
                    ).toFixed(1),
                  })}
                </div>
              )}
              {typeof demoQueueStatus.estimated_wait.supporting_signals?.simulation_notice ===
                'string' && (
                <div className="text-[11px] text-amber-900 dark:text-amber-200 font-medium pl-5">
                  {t('queue.notice')}{' '}
                  {String(demoQueueStatus.estimated_wait.supporting_signals.simulation_notice)}
                </div>
              )}
            </div>
          )}

          {/* Primary Action Button: Proceed to Token Desk */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('queue.readyToTakeSpot')}
            </span>
            <button
              id="btn-test-in-token-desk"
              type="button"
              onClick={() => onTestServiceInTokenDesk(selectedDemoService.id)}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center space-x-1.5 select-none"
            >
              <span>{t('queue.issueTokenForService')}</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('discovery.emptyPrompt')}
        </div>
      )}

      {/* CIVIC EXPLAINER SECTION: A Simpler Way to Access Public Services */}
      <div
        id="citizen-explainer-section"
        className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-b from-slate-50/70 to-white dark:from-slate-850/60 dark:to-slate-900 p-5 sm:p-6 space-y-4"
      >
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h3 className="font-serif text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('explainer.title')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('explainer.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {/* Step 1 */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 space-y-1.5 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-100 dark:border-blue-900">
              1
            </div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
              {t('explainer.step1Title')}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {t('explainer.step1Desc')}
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 space-y-1.5 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-100 dark:border-blue-900">
              2
            </div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
              {t('explainer.step2Title')}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {t('explainer.step2Desc')}
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 space-y-1.5 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-100 dark:border-blue-900">
              3
            </div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
              {t('explainer.step3Title')}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {t('explainer.step3Desc')}
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 space-y-1.5 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs border border-blue-100 dark:border-blue-900">
              4
            </div>
            <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
              {t('explainer.step4Title')}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              {t('explainer.step4Desc')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default IndiaDemoExplorer
