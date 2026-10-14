import React, { useEffect, useState } from 'react'
import { fetchVisitPlan } from '../api/planner'
import { useLanguage } from '../i18n'
import type { VisitPlanResponse } from '../types/planner'
import { Alert, Badge, Button, Card, CardContent, CardHeader, CardTitle, ChakraWatermark } from './ui'

interface SmartVisitPlannerProps {
  serviceId?: string | null
  serviceName?: string | null
  facilityName?: string | null
  cityName?: string | null
}

export const SmartVisitPlanner: React.FC<SmartVisitPlannerProps> = ({
  serviceId,
  serviceName,
  facilityName,
  cityName,
}) => {
  const { t } = useLanguage()
  const [plan, setPlan] = useState<VisitPlanResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Local client-side checkbox state (privacy-conscious, no server persistence)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    if (!serviceId) return {}
    try {
      const saved = localStorage.getItem(`queless_checklist_${serviceId}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  // Load plan when serviceId changes
  useEffect(() => {
    if (!serviceId) {
      setPlan(null)
      setError(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    // Load saved checklist state for this service
    try {
      const saved = localStorage.getItem(`queless_checklist_${serviceId}`)
      setCheckedItems(saved ? JSON.parse(saved) : {})
    } catch {
      setCheckedItems({})
    }

    fetchVisitPlan(serviceId)
      .then((data) => {
        if (isMounted) {
          setPlan(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load visit plan')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [serviceId])

  const toggleItem = (itemId: string) => {
    setCheckedItems((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] }
      if (serviceId) {
        try {
          localStorage.setItem(`queless_checklist_${serviceId}`, JSON.stringify(next))
        } catch {
          // ignore localStorage error
        }
      }
      return next
    })
  }

  const checklistItems = plan?.document_checklist?.items || []
  const completedCount = checklistItems.filter((item) => !!checkedItems[item.id]).length
  const totalCount = checklistItems.length

  const renderRequirementBadge = (type: string) => {
    switch (type) {
      case 'ORIGINAL_ONLY':
        return (
          <Badge variant="warning" size="sm">
            {t('planner.originalOnly')}
          </Badge>
        )
      case 'PHOTOCOPY_ONLY':
        return (
          <Badge variant="neutral" size="sm">
            {t('planner.photocopyOnly')}
          </Badge>
        )
      case 'BOTH_ORIGINAL_AND_PHOTOCOPY':
        return (
          <Badge variant="primary" size="sm">
            {t('planner.bothOriginalAndPhotocopy')}
          </Badge>
        )
      default:
        return (
          <Badge variant="neutral" size="sm">
            {type}
          </Badge>
        )
    }
  }

  return (
    <Card
      id="smart-visit-planner-section"
      className="relative overflow-hidden border-blue-200/60 dark:border-blue-900/40 bg-linear-to-b from-blue-50/20 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850"
    >
      <div className="absolute -right-8 -top-8 pointer-events-none select-none z-0">
        <ChakraWatermark className="w-56 h-56 sm:w-72 sm:h-72 text-blue-950/[0.03] dark:text-blue-300/[0.02]" />
      </div>

      <CardHeader className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="primary" size="sm">
                {t('planner.badge')}
              </Badge>
              {plan?.is_simulated && (
                <Badge variant="neutral" size="sm">
                  {t('hero.simulatedBadge')}
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl sm:text-2xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{t('planner.title')}</span>
              {serviceName && (
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  — {serviceName}
                </span>
              )}
            </CardTitle>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {t('planner.subtitle')}
            </p>
          </div>

          {(facilityName || cityName) && (
            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              <div className="font-semibold text-slate-700 dark:text-slate-200">
                {facilityName}
              </div>
              <div>{cityName}</div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5 relative z-10">
        {/* State 1: No Service Selected */}
        {!serviceId && (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-850/60 rounded-xl border border-dashed border-slate-300 dark:border-slate-750">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
              {t('planner.selectServicePrompt')}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              “Make waiting more predictable, not pretend queues don't exist.”
            </p>
          </div>
        )}

        {/* State 2: Loading */}
        {loading && (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-850/40 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('common.loading')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Evaluating deterministic queue bounds and verified document catalog...
            </p>
          </div>
        )}

        {/* State 3: Error */}
        {error && !loading && (
          <Alert variant="error" title={t('common.error')}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span>{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (serviceId) {
                    setLoading(true)
                    setError(null)
                    fetchVisitPlan(serviceId)
                      .then((d) => {
                        setPlan(d)
                        setLoading(false)
                      })
                      .catch((e) => {
                        setError(e.message)
                        setLoading(false)
                      })
                  }
                }}
              >
                {t('common.refresh')}
              </Button>
            </div>
          </Alert>
        )}

        {/* State 4: Plan Loaded */}
        {plan && !loading && (
          <div className="space-y-6">
            {/* ------------------------------------------------------------- */}
            {/* Feature A: Arrival Window                                     */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                    {t('planner.arrivalWindowHeading')}
                  </h4>
                </div>
                {plan.arrival_window.confidence && (
                  <Badge
                    variant={
                      plan.arrival_window.confidence === 'HIGH'
                        ? 'success'
                        : plan.arrival_window.confidence === 'MEDIUM'
                          ? 'primary'
                          : 'warning'
                    }
                    size="sm"
                  >
                    {t('planner.confidenceLabel')}: {plan.arrival_window.confidence}
                  </Badge>
                )}
              </div>

              {plan.arrival_window.is_recommended ? (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60">
                    <div>
                      <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                        {t('planner.suggestedArrival')}
                      </div>
                      <div className="text-2xl font-black text-blue-950 dark:text-blue-100 mt-1">
                        {plan.arrival_window.suggested_arrival_text}
                      </div>
                      <div className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1">
                        Bounded target window derived from recent counter throughput
                      </div>
                    </div>
                    {plan.arrival_window.data_freshness_seconds !== null &&
                      plan.arrival_window.data_freshness_seconds !== undefined && (
                        <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400">
                          {t('planner.telemetryFreshness', {
                            seconds: plan.arrival_window.data_freshness_seconds,
                          })}
                        </div>
                      )}
                  </div>

                  {/* Assumptions */}
                  {plan.arrival_window.assumptions.length > 0 && (
                    <details className="group rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 p-3.5 text-xs">
                      <summary className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider cursor-pointer select-none flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span>{t('planner.assumptionsHeading')}</span>
                          <span className="text-[11px] font-normal text-slate-400 lowercase">
                            ({plan.arrival_window.assumptions.length} conditions)
                          </span>
                        </span>
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-open:hidden">
                          View details &darr;
                        </span>
                        <span className="text-[11px] font-semibold text-slate-400 hidden group-open:inline">
                          Hide details &uarr;
                        </span>
                      </summary>
                      <div className="pt-2.5 mt-2 border-t border-slate-200/60 dark:border-slate-800/60 space-y-1">
                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                          {plan.arrival_window.assumptions.map((asm, idx) => (
                            <li key={idx}>{asm}</li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  )}

                  {/* Honest Disclaimer */}
                  <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    <span className="font-bold">{t('planner.disclaimerHeading')}: </span>
                    {plan.arrival_window.disclaimer}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Alert variant="warning" title={t('planner.arrivalWindowHeading')}>
                    <div className="space-y-1">
                      <p className="font-medium">
                        {plan.arrival_window.reason || t('planner.staleDataNotice')}
                      </p>
                      <p className="text-xs opacity-90">
                        QueuelessBharat strictly reports unavailable states rather than fabricating
                        false arrival precision without validated live telemetry.
                      </p>
                    </div>
                  </Alert>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Feature B: Document Readiness Checklist                      */}
            {/* ------------------------------------------------------------- */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                    <span>{t('planner.checklistHeading')}</span>
                    {(() => {
                      const verifStatus =
                        plan.document_checklist.verification_status ||
                        (plan.document_checklist.has_verified_checklist ? 'VERIFIED' : 'UNVERIFIED')
                      if (verifStatus === 'VERIFIED') {
                        return (
                          <Badge variant="success" size="sm">
                            ✓ {t('planner.verifiedStatus')}
                          </Badge>
                        )
                      }
                      if (verifStatus === 'PARTIALLY_VERIFIED') {
                        return (
                          <Badge variant="warning" size="sm">
                            ⚡ {t('planner.partiallyVerifiedStatus')}
                          </Badge>
                        )
                      }
                      return (
                        <Badge variant="neutral" size="sm">
                          {t('planner.unverifiedStatus')}
                        </Badge>
                      )
                    })()}
                    {totalCount > 0 && (
                      <Badge variant={completedCount === totalCount ? 'success' : 'neutral'} size="sm">
                        {t('planner.checklistProgress', {
                          ready: completedCount,
                          total: totalCount,
                        })}
                      </Badge>
                    )}
                  </h4>
                  {plan.document_checklist.has_verified_checklist && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        {t('planner.verifiedSourceLabel')}:{' '}
                        <strong className="text-slate-700 dark:text-slate-300">
                          {plan.document_checklist.source_title}
                        </strong>
                      </span>
                      {plan.document_checklist.verification_date && (
                        <span>
                          •{' '}
                          {t('planner.verificationDateLabel', {
                            date: plan.document_checklist.verification_date,
                          })}
                        </span>
                      )}
                      {plan.document_checklist.source_url && (
                        <span>
                          •{' '}
                          <a
                            href={plan.document_checklist.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                          >
                            {t('planner.viewOfficialPortal')} &rarr;
                          </a>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {completedCount === totalCount && totalCount > 0 && (
                  <Badge variant="success" size="md">
                    ✓ {t('planner.allReady')}
                  </Badge>
                )}
              </div>

              {plan.document_checklist.has_verified_checklist ? (
                <div className="space-y-3">
                  {/* Mandatory Legal / Operational Notice */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 italic">
                    <strong>Notice: </strong>
                    {plan.document_checklist.disclaimer}
                  </div>

                  {plan.document_checklist.verification_status === 'PARTIALLY_VERIFIED' && (
                    <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-900 dark:text-amber-200">
                      ⚡ <strong>Advisory:</strong> {t('planner.partiallyVerifiedNotice')}
                    </div>
                  )}

                  {/* Checklist Items */}
                  <div className="space-y-2.5">
                    {checklistItems.map((item) => {
                      const isChecked = !!checkedItems[item.id]
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                            isChecked
                              ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`doc-check-${item.id}`}
                            checked={isChecked}
                            onChange={() => toggleItem(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                            aria-label={`Mark ${item.name} as ready`}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <label
                                htmlFor={`doc-check-${item.id}`}
                                className={`text-xs sm:text-sm font-bold cursor-pointer ${
                                  isChecked
                                    ? 'line-through text-slate-500 dark:text-slate-400'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {item.name}
                              </label>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {renderRequirementBadge(item.requirement_type)}
                                <Badge
                                  variant={item.is_mandatory ? 'danger' : 'neutral'}
                                  size="sm"
                                >
                                  {item.is_mandatory
                                    ? t('planner.mandatoryBadge')
                                    : t('planner.optionalBadge')}
                                </Badge>
                                {item.is_conditional && (
                                  <Badge variant="warning" size="sm">
                                    {t('planner.conditionalBadge')}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                              {item.description}
                            </p>
                            {item.condition_description && (
                              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/60">
                                ⚠️ {item.condition_description}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                ℹ️ {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Alert variant="neutral" title="Official Checklist Status">
                    <p className="text-xs leading-relaxed">
                      {t('planner.unverifiedChecklistNotice')}
                    </p>
                  </Alert>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
