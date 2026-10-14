import React, { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '../i18n'
import type { User, UserRole } from '../types/auth'
import type { Location } from '../types/queue'
import { listUsers, activateUser, createPrivilegedUser } from '../api/auth'

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
  const { t } = useLanguage()

  // Staff management state
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userError, setUserError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [filterPendingOnly, setFilterPendingOnly] = useState(false)

  // Direct provisioning form state
  const [showProvisionForm, setShowProvisionForm] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('OPERATOR')
  const [isProvisioning, setIsProvisioning] = useState(false)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUserError(null)
    try {
      const data = await listUsers()
      setUsers(data)
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to fetch users')
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const handleActivate = async (userId: string) => {
    setActivatingId(userId)
    setUserError(null)
    try {
      await activateUser(userId)
      setSuccessMessage(t('admin.activationSuccess'))
      setTimeout(() => setSuccessMessage(null), 4000)
      await loadUsers()
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to activate user')
    } finally {
      setActivatingId(null)
    }
  }

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProvisioning(true)
    setUserError(null)
    try {
      await createPrivilegedUser({
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
      })
      setSuccessMessage(t('admin.provisionSuccess'))
      setTimeout(() => setSuccessMessage(null), 4000)
      setNewEmail('')
      setNewPassword('')
      setNewFullName('')
      setNewRole('OPERATOR')
      setShowProvisionForm(false)
      await loadUsers()
    } catch (err: unknown) {
      setUserError(err instanceof Error ? err.message : 'Failed to provision user')
    } finally {
      setIsProvisioning(false)
    }
  }

  const pendingCount = users.filter((u) => !u.is_active).length
  const displayedUsers = filterPendingOnly ? users.filter((u) => !u.is_active) : users

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-8 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {t('admin.heading')}
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              {t('admin.badge')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t('admin.subheading')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {t('admin.loggedInAs')} <strong>{currentUser.full_name || currentUser.email}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              onRefreshData()
              loadUsers()
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            {t('admin.refreshTelemetry')}
          </button>
        </div>
      </div>

      {/* High-level system KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.marketsCovered')}
          </span>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {cities.length}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('admin.tier1Tier2')}</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.facilitiesActive')}
          </span>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
            {facilities.length > 0 ? facilities.length : '—'}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {t('admin.inSelectedCity', { city: selectedCity })}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.deterministicEngine')}
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {t('admin.active')}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('admin.empiricalWeighted')}</span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('admin.securityRbac')}
          </span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {t('admin.strict')}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t('admin.bolaEnforced')}</span>
        </div>
      </div>

      {/* Staff Provisioning & Account Approvals */}
      <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 p-5 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {t('admin.staffManagementHeading')}
              </h3>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500 text-white animate-pulse">
                  {pendingCount}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('admin.staffManagementSubheading')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterPendingOnly(!filterPendingOnly)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                filterPendingOnly
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {filterPendingOnly ? 'Showing Pending Only' : `Show Pending (${pendingCount})`}
            </button>
            <button
              type="button"
              onClick={() => setShowProvisionForm(!showProvisionForm)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer"
            >
              {showProvisionForm ? 'Cancel' : t('admin.provisionStaffBtn')}
            </button>
          </div>
        </div>

        {/* Success / Error Banners */}
        {successMessage && (
          <div className="p-3 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
            {successMessage}
          </div>
        )}
        {userError && (
          <div className="p-3 text-xs rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
            {userError}
          </div>
        )}

        {/* Provision New Staff Form */}
        {showProvisionForm && (
          <form
            onSubmit={handleProvision}
            className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-white dark:bg-slate-900 space-y-4"
          >
            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              {t('admin.provisionStaffBtn')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t('auth.fullNameLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Officer Sharma"
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t('auth.staffEmailLabel')}
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="officer@morth.gov.in"
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t('auth.passwordMinChars')}
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t('admin.provisionRoleLabel')}
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="CITIZEN">CITIZEN</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowProvisionForm(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProvisioning}
                className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition cursor-pointer"
              >
                {isProvisioning ? 'Creating...' : 'Provision Staff Account'}
              </button>
            </div>
          </form>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">{t('admin.colStaffUser')}</th>
                <th className="px-4 py-2.5">{t('admin.colStaffEmail')}</th>
                <th className="px-4 py-2.5">{t('admin.colStaffRole')}</th>
                <th className="px-4 py-2.5">{t('admin.colStaffStatus')}</th>
                <th className="px-4 py-2.5">{t('admin.colStaffAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadingUsers ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Loading accounts...
                  </td>
                </tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    {t('admin.noStaffUsers')}
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                      {u.full_name || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                            : u.role === 'OPERATOR'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          {t('admin.statusActive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          {t('admin.statusPending')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {!u.is_active ? (
                        <button
                          type="button"
                          onClick={() => handleActivate(u.id)}
                          disabled={activatingId === u.id}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition cursor-pointer"
                        >
                          {activatingId === u.id ? t('admin.approvingStaff') : t('admin.approveStaffBtn')}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Facilities Table in Current City */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {t('admin.configuredFacilities', { city: selectedCity })}
          </h3>
          <select
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            disabled={cities.length === 0}
            className="text-xs border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cities.length === 0 ? (
              <option value="" disabled>
                No registered cities
              </option>
            ) : (
              cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-2.5">{t('admin.colFacility')}</th>
                <th className="px-4 py-2.5">{t('admin.colCategory')}</th>
                <th className="px-4 py-2.5">{t('admin.colAddress')}</th>
                <th className="px-4 py-2.5">{t('admin.colStatus')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {facilities.map((fac) => (
                <tr key={fac.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">{fac.name}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-700 dark:text-slate-300">
                    {t(`categories.${fac.category}`) !== `categories.${fac.category}`
                      ? t(`categories.${fac.category}`)
                      : fac.category.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{fac.address}</td>
                  <td className="px-4 py-2.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
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
