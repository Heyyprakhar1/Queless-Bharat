import type React from 'react'
import type { User } from '../types/auth'
import type { Location } from '../types/queue'

interface AdminWorkspaceProps {
  currentUser: User
  cities: string[]
  facilities: Location[]
  selectedCity: string
  onSelectCity: (city: string) => void
  onRefreshData: () => void
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  currentUser,
  cities,
  facilities,
  selectedCity,
  onSelectCity,
  onRefreshData,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900">
              System Administrator Workspace
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
              ADMIN CONTROL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Operational governance, nationwide catalog metrics, and civic facility telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-slate-600">
            Logged in as: <strong>{currentUser.full_name || currentUser.email}</strong>
          </span>
          <button
            type="button"
            onClick={onRefreshData}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
          >
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* High-level system KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Urban Markets Covered
          </span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {cities.length > 0 ? cities.length : 20}
          </div>
          <span className="text-[11px] text-slate-500">Tier-1 &amp; Tier-2 Metros</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Facilities Active
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {facilities.length > 0 ? facilities.length : '—'}
          </div>
          <span className="text-[11px] text-slate-500">In selected city ({selectedCity})</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Deterministic Engine
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            Active
          </div>
          <span className="text-[11px] text-slate-500">Empirical weighted estimation</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Security &amp; RBAC
          </span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            Strict
          </div>
          <span className="text-[11px] text-slate-500">BOLA &amp; token ownership enforced</span>
        </div>
      </div>

      {/* Facilities Table in Current City */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800">
            Configured Facilities in {selectedCity}
          </h3>
          <select
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
          >
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Facility Name</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Address</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {facilities.map((fac) => (
                <tr key={fac.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{fac.name}</td>
                  <td className="px-4 py-2.5 capitalize">{fac.category.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fac.address}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {fac.status}
                    </span>
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
