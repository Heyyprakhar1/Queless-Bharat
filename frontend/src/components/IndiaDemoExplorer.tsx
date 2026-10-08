import type React from 'react'
import type { Location, QueueStatusResponse, Service } from '../types/queue'

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
}

const DISPLAY_CITIES = [
  'Pune',
  'Mumbai',
  'Bengaluru',
  'Chennai',
  'Kolkata',
  'Delhi',
  'Lucknow',
  'Patna',
]

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
}) => {
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId)
  const selectedDemoService = facilityServices.find((s) => s.id === selectedDemoServiceId)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900">
              India Civic Queue Explorer
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              City &rarr; Facility &rarr; Service Flow
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Select an Indian city, public institution, and counter service to inspect deterministic wait projections.
          </p>
        </div>

        {/* Simulated Data Badge */}
        <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-amber-900 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>DEMO / SIMULATED DATA</span>
        </div>
      </div>

      {/* City Quick Pills Bar */}
      <div>
        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
          Select City (8 Major Metros)
        </label>
        <div className="flex flex-wrap gap-2">
          {DISPLAY_CITIES.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => onSelectCity(city)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                selectedCity === city
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{city}</span>
              {city === 'Pune' && (
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                    selectedCity === 'Pune'
                      ? 'bg-indigo-800 text-amber-300'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Showcase
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cascading Selectors: City, Facility, Service */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div>
          <label htmlFor="city-select" className="block text-xs font-bold text-slate-700 mb-1">
            1. City
          </label>
          <select
            id="city-select"
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c} {c === 'Pune' ? '(Showcase City)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="facility-select" className="block text-xs font-bold text-slate-700 mb-1">
            2. Facility / Institution
          </label>
          <select
            id="facility-select"
            value={selectedFacilityId}
            onChange={(e) => onSelectFacility(e.target.value)}
            disabled={facilities.length === 0}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {facilities.length === 0 ? (
              <option value="">No facilities found</option>
            ) : (
              facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name} [{fac.category.toUpperCase()}]
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label htmlFor="service-select" className="block text-xs font-bold text-slate-700 mb-1">
            3. Civic Service Window
          </label>
          <select
            id="service-select"
            value={selectedDemoServiceId}
            onChange={(e) => onSelectDemoService(e.target.value)}
            disabled={facilityServices.length === 0}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {facilityServices.length === 0 ? (
              <option value="">No services registered</option>
            ) : (
              facilityServices.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Facility Location Details Banner */}
      {selectedFacility && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-800">{selectedFacility.name}</span>
            <span className="mx-2 text-slate-300">|</span>
            <span>{selectedFacility.address}</span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-500">
            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 uppercase font-sans font-bold">
              {selectedFacility.category}
            </span>
            {selectedFacility.latitude && selectedFacility.longitude && (
              <span>
                GPS: {selectedFacility.latitude.toFixed(4)}°N, {selectedFacility.longitude.toFixed(4)}°E
              </span>
            )}
          </div>
        </div>
      )}

      {/* Queue Status & Wait Projection Display */}
      {demoQueueLoading ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Loading deterministic wait estimate...
        </div>
      ) : demoQueueStatus ? (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                People Ahead in Line
              </span>
              <div id="demo-people-ahead" className="text-2xl font-black text-indigo-600">
                {demoQueueStatus.people_ahead}
              </div>
              <span className="text-[11px] text-slate-500">waiting tokens</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Active Counters
              </span>
              <div id="demo-active-counters" className="text-2xl font-black text-emerald-600">
                {demoQueueStatus.active_counters}
              </div>
              <span className="text-[11px] text-slate-500">open service windows</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Currently in Service
              </span>
              <div id="demo-in-service" className="text-2xl font-black text-amber-600">
                {demoQueueStatus.queue_state.in_service_count}
              </div>
              <span className="text-[11px] text-slate-500">participants being served</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Data Mode
              </span>
              <div className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-1 rounded inline-block mt-1">
                SIMULATED
              </div>
              <span className="text-[10px] text-slate-400 block mt-1">Mathematical benchmark</span>
            </div>
          </div>

          {/* Deterministic Wait Projection Card */}
          <div
            id="demo-wait-projection"
            className="border border-slate-200 rounded-2xl p-6 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-slate-900">
                  Deterministic Wait Projection (ADR-0003)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {demoQueueStatus.estimated_wait.model_version}
                </span>
              </div>

              {demoQueueStatus.estimated_wait.confidence && (
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">Confidence Rating:</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      demoQueueStatus.estimated_wait.confidence === 'HIGH'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : demoQueueStatus.estimated_wait.confidence === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {demoQueueStatus.estimated_wait.confidence}
                  </span>
                </div>
              )}
            </div>

            {demoQueueStatus.estimated_wait.is_available ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <div className="text-3xl sm:text-4xl font-black text-slate-900">
                    {demoQueueStatus.estimated_wait.lower_minutes}&ndash;
                    {demoQueueStatus.estimated_wait.upper_minutes}{' '}
                    <span className="text-base sm:text-lg font-normal text-slate-600">minutes</span>
                  </div>
                  {demoQueueStatus.estimated_wait.expected_minutes !== null && (
                    <div className="text-sm font-semibold text-slate-600">
                      (expected ~{demoQueueStatus.estimated_wait.expected_minutes} mins)
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
                  <span>
                    <strong>Sample Baseline:</strong> {demoQueueStatus.estimated_wait.sample_size} completed throughput sessions
                  </span>
                  {demoQueueStatus.estimated_wait.freshness_seconds !== null &&
                    demoQueueStatus.estimated_wait.freshness_seconds !== undefined && (
                      <span>
                        <strong>Signal Freshness:</strong>{' '}
                        {demoQueueStatus.estimated_wait.freshness_seconds < 60
                          ? 'Just now (< 1m)'
                          : `${Math.round(demoQueueStatus.estimated_wait.freshness_seconds / 60)}m ago`}
                      </span>
                    )}
                  {demoQueueStatus.estimated_wait.supporting_signals?.service_rate_per_hour !== undefined && (
                    <span>
                      <strong>Service Rate:</strong> ~{String(demoQueueStatus.estimated_wait.supporting_signals.service_rate_per_hour)}/hr
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div id="demo-unavailable-msg" className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
                <div className="font-bold flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Estimate Unavailable</span>
                </div>
                <p className="text-xs text-amber-800">
                  {demoQueueStatus.estimated_wait.reason ||
                    'Insufficient empirical sample data to derive a confident wait projection.'}
                </p>
                <p className="text-[11px] text-amber-700">
                  QueueLess Bharat strictly adheres to ADR-0003: it never fabricates false wait estimates or reports false 0-minute wait times when operational data is insufficient.
                </p>
              </div>
            )}
          </div>

          {/* Action to test this service in the Citizen Token Desk */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Ready to test queue session lifecycle for this service?
            </span>
            <button
              type="button"
              onClick={() => onTestServiceInTokenDesk(selectedDemoServiceId)}
              className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition cursor-pointer border border-indigo-200"
            >
              Issue Token for &ldquo;{selectedDemoService?.name}&rdquo; &darr;
            </button>
          </div>
        </div>
      ) : demoQueueError ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <strong>Error loading queue scenario:</strong> {demoQueueError}
        </div>
      ) : null}
    </div>
  )
}
