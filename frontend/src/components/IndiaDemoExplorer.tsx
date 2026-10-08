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

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  hospital: { label: 'Hospital', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  government_office: { label: 'Govt Office', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  rto: { label: 'RTO Transport', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  municipal_service_centre: { label: 'Municipal Centre', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  university: { label: 'University', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  college: { label: 'College', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  diagnostic_centre: { label: 'Diagnostics', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  bank: { label: 'Bank Branch', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  restaurant: { label: 'Bistro & Dining', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  cafeteria: { label: 'Food Court', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  hotel: { label: 'Hotel & Hospitality', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  public_service_centre: { label: 'Jan Seva Kendra', color: 'bg-lime-100 text-lime-800 border-lime-200' },
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
}) => {
  const selectedFacility = facilities.find((f) => f.id === selectedFacilityId)
  const selectedDemoService = facilityServices.find((s) => s.id === selectedDemoServiceId)

  // Use cities prop if populated, else fallback to full list of 20
  const activeCityList = cities.length > 0 ? Array.from(new Set([...cities, ...ALL_20_CITIES])) : ALL_20_CITIES

  const categoryMeta = selectedFacility?.category
    ? CATEGORY_LABELS[selectedFacility.category] || {
        label: selectedFacility.category.replace(/_/g, ' '),
        color: 'bg-slate-100 text-slate-800 border-slate-200',
      }
    : null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900">
              India Civic Queue Explorer
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
              20 Urban Markets &bull; 12 Categories
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
          Select City (20 Urban Markets Across India)
        </label>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-100">
          {activeCityList.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => onSelectCity(city)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                selectedCity === city
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200'
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

      {/* Cascading Filter Controls: City -> Facility -> Service */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Step 1: City Dropdown */}
        <div>
          <label htmlFor="city-select" className="block text-xs font-bold text-slate-700 mb-1">
            Step 1: City
          </label>
          <select
            id="city-select"
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {activeCityList.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Facility Dropdown */}
        <div>
          <label htmlFor="facility-select" className="block text-xs font-bold text-slate-700 mb-1">
            Step 2: Facility / Institution ({facilities.length})
          </label>
          <select
            id="facility-select"
            value={selectedFacilityId}
            onChange={(e) => onSelectFacility(e.target.value)}
            disabled={facilities.length === 0}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          >
            {facilities.length === 0 ? (
              <option value="">No facilities loaded</option>
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
        <div>
          <label htmlFor="service-select" className="block text-xs font-bold text-slate-700 mb-1">
            Step 3: Public Counter Service ({facilityServices.length})
          </label>
          <select
            id="service-select"
            value={selectedDemoServiceId}
            onChange={(e) => onSelectDemoService(e.target.value)}
            disabled={facilityServices.length === 0}
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
          >
            {facilityServices.length === 0 ? (
              <option value="">No services available</option>
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

      {/* Selected Facility Metadata Strip */}
      {selectedFacility && (
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-800">{selectedFacility.name}</span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-600">{selectedFacility.address}</span>
          </div>
          <div className="flex items-center space-x-2">
            {categoryMeta && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${categoryMeta.color}`}>
                {categoryMeta.label}
              </span>
            )}
            <span className="text-slate-500 font-mono text-[11px]">
              {selectedFacility.latitude?.toFixed(4)}, {selectedFacility.longitude?.toFixed(4)}
            </span>
          </div>
        </div>
      )}

      {/* Error / Loading / Projection Card */}
      {demoQueueError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <strong>Catalog Notice:</strong> {demoQueueError}
        </div>
      )}

      {demoQueueLoading ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Loading deterministic queue state...
        </div>
      ) : demoQueueStatus && selectedDemoService ? (
        <div
          id="demo-wait-projection"
          className="border border-indigo-100 rounded-2xl p-6 bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 space-y-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-700">
                Service Telemetry &amp; Deterministic Estimate
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                {selectedDemoService.name}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedDemoService.description}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                Simulation Scenario
              </span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                People Ahead in Queue
              </span>
              <div id="demo-people-ahead" className="text-3xl font-black text-slate-900 mt-1">
                {demoQueueStatus.people_ahead}
              </div>
              <span className="text-xs text-slate-500">waiting participants</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Active Counters Open
              </span>
              <div id="demo-active-counters" className="text-3xl font-black text-indigo-600 mt-1">
                {demoQueueStatus.active_counters}
              </div>
              <span className="text-xs text-slate-500">serving desks active</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase">
                Deterministic Wait Projection
              </span>
              <div className="mt-1">
                {demoQueueStatus.estimated_wait.is_available ? (
                  <>
                    <div className="text-2xl font-black text-slate-900">
                      {demoQueueStatus.estimated_wait.lower_minutes}&ndash;
                      {demoQueueStatus.estimated_wait.upper_minutes}{' '}
                      <span className="text-sm font-normal text-slate-600">minutes</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      expected: ~{demoQueueStatus.estimated_wait.expected_minutes} mins (Confidence: {demoQueueStatus.estimated_wait.confidence})
                    </span>
                  </>
                ) : (
                  <div id="demo-unavailable-msg" className="space-y-1">
                    <div className="text-sm font-bold text-amber-800">
                      Estimate Unavailable
                    </div>
                    <p className="text-xs text-amber-900">
                      {demoQueueStatus.estimated_wait.reason}
                    </p>
                    <p className="text-[10px] text-slate-500 italic">
                      QueueLess Bharat never fabricates false wait estimates without validated empirical service samples.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mathematical Signals & Explanation */}
          {demoQueueStatus.estimated_wait.is_available && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800">
                Sample Baseline: {demoQueueStatus.estimated_wait.sample_size} completed throughput sessions
              </div>
              {typeof demoQueueStatus.estimated_wait.supporting_signals?.service_rate_per_hour === 'number' && (
                <div>
                  Counter throughput: ~
                  {(
                    demoQueueStatus.estimated_wait.supporting_signals.service_rate_per_hour as number
                  ).toFixed(1)}{' '}
                  citizens/hour per active desk
                </div>
              )}
              {typeof demoQueueStatus.estimated_wait.supporting_signals?.simulation_notice === 'string' && (
                <div className="text-[11px] text-amber-800 font-medium">
                  Notice:{' '}
                  {String(demoQueueStatus.estimated_wait.supporting_signals.simulation_notice)}
                </div>
              )}
            </div>
          )}

          {/* Action: Test in Citizen Token Desk */}
          <div className="pt-2 flex justify-end">
            <button
              id="btn-test-in-token-desk"
              type="button"
              onClick={() => onTestServiceInTokenDesk(selectedDemoService.id)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition shadow-xs cursor-pointer"
            >
              Issue Digital Token for this Service &rarr;
            </button>
          </div>
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-slate-500">
          Select a facility and service to view deterministic queue estimates.
        </div>
      )}
    </div>
  )
}
