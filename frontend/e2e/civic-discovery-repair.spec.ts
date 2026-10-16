import { expect, test } from '@playwright/test'

test.describe('QueuelessBharat — Civic Discovery & Smart Visit Planner Repair E2E Suite', () => {
  const mockPuneLocations = [
    {
      id: 'loc-pune-rto-001',
      name: 'MH-12 Pune Regional Transport Office',
      city: 'Pune',
      state: 'Maharashtra',
      address: 'Near Sangam Bridge, Pune, Maharashtra 411001',
      latitude: 18.5293,
      longitude: 73.8565,
      is_active: true,
    },
    {
      id: 'loc-pune-pmc-002',
      name: 'Pune Municipal Corporation (PMC)',
      city: 'Pune',
      state: 'Maharashtra',
      address: 'Shivajinagar, Pune 411005',
      latitude: 18.5308,
      longitude: 73.8475,
      is_active: true,
    },
  ]

  const mockRtoServices = [
    {
      id: 'svc-pune-dl-001',
      location_id: 'loc-pune-rto-001',
      name: 'Driving Licence Renewal',
      description: 'Renewal of existing permanent driving licence',
      avg_service_time_seconds: 600,
      daily_capacity: 120,
      is_active: true,
    },
    {
      id: 'svc-pune-ll-002',
      location_id: 'loc-pune-rto-001',
      name: 'Learner Licence Application',
      description: 'Fresh application for learner licence test',
      avg_service_time_seconds: 450,
      daily_capacity: 150,
      is_active: true,
    },
  ]

  const mockPatnaLocations = [
    {
      id: 'loc-patna-pmc-001',
      name: 'Patna Municipal Corporation (PMC) HQ',
      city: 'Patna',
      state: 'Bihar',
      address: 'Maurya Lok Complex, Patna, Bihar 800001',
      latitude: 25.6127,
      longitude: 85.1376,
      is_active: true,
    },
  ]

  const mockPatnaServices = [
    {
      id: 'svc-patna-bd-001',
      location_id: 'loc-patna-pmc-001',
      name: 'Birth and Death Certificate Issuance',
      description: 'Issuance and verification of civic vital records',
      avg_service_time_seconds: 480,
      daily_capacity: 100,
      is_active: true,
    },
  ]

  const mockQueueStatusDl = {
    service: mockRtoServices[0],
    people_ahead: 5,
    active_counters: 2,
    queue_state: {
      waiting_count: 5,
      in_service_count: 2,
      active_counters: 2,
    },
    estimated_wait: {
      is_available: true,
      lower_minutes: 20,
      upper_minutes: 30,
      expected_minutes: 25,
      confidence: 'HIGH' as const,
      sample_size: 14,
      freshness_seconds: 120,
      model_version: 'DETERMINISTIC_M_M_C_BASELINE',
      supporting_signals: {
        service_rate_per_hour: 6.0,
      },
    },
    is_simulated: true,
  }

  const mockVisitPlanDl = {
    service_id: 'svc-pune-dl-001',
    service_name: 'Driving Licence Renewal',
    location_name: 'MH-12 Pune Regional Transport Office',
    city: 'Pune',
    is_simulated: true,
    arrival_window: {
      is_recommended: true,
      confidence: 'HIGH' as const,
      window_start_minutes: 10,
      window_end_minutes: 20,
      suggested_arrival_text: 'Within 10–20 minutes',
      data_freshness_seconds: 120,
      last_updated: '2026-10-13T07:00:00Z',
      assumptions: [
        'Active counters remain constant at 2',
        'Average service transaction time remains ~10 min',
      ],
      disclaimer: 'This is a deterministic arrival estimate, not a guaranteed appointment.',
    },
    document_checklist: {
      service_id: 'svc-pune-dl-001',
      service_name: 'Driving Licence Renewal',
      has_verified_checklist: true,
      verification_status: 'VERIFIED' as const,
      source_title: 'Sarathi Parivahan Citizen Portal (MoRTH)',
      source_url: 'https://sarathi.parivahan.gov.in/',
      verification_date: '2026-10-12',
      disclaimer: 'Completing this checklist does not guarantee approval or service.',
      items: [
        {
          id: 'dl_original',
          name: 'Original Driving Licence',
          description: 'Current driving licence due for renewal',
          requirement_type: 'ORIGINAL_ONLY' as const,
          is_mandatory: true,
        },
        {
          id: 'medical_form_1a',
          name: 'Medical Certificate (Form 1-A)',
          description: 'Required if applicant is above 40 years of age',
          requirement_type: 'ORIGINAL_ONLY' as const,
          is_mandatory: true,
        },
      ],
    },
  }

  const mockVisitPlanPatnaBd = {
    service_id: 'svc-patna-bd-001',
    service_name: 'Birth and Death Certificate Issuance',
    location_name: 'Patna Municipal Corporation (PMC) HQ',
    city: 'Patna',
    is_simulated: true,
    arrival_window: {
      is_recommended: true,
      confidence: 'MEDIUM' as const,
      window_start_minutes: 15,
      window_end_minutes: 30,
      suggested_arrival_text: 'Within 15–30 minutes',
      data_freshness_seconds: 60,
      last_updated: '2026-10-13T07:00:00Z',
      assumptions: ['1 active counter'],
      disclaimer: 'Arrival guidance only.',
    },
    document_checklist: {
      service_id: 'svc-patna-bd-001',
      service_name: 'Birth and Death Certificate Issuance',
      has_verified_checklist: true,
      verification_status: 'PARTIALLY_VERIFIED' as const,
      source_title: 'Patna Municipal Corporation Citizen Services',
      source_url: null,
      verification_date: '2026-10-13',
      disclaimer: 'Requirements subject to municipal administrative verification.',
      items: [
        {
          id: 'patna_app_form',
          name: 'Prescribed Application Form',
          description: 'Duly filled application form for vital records',
          requirement_type: 'ORIGINAL_ONLY' as const,
          is_mandatory: true,
        },
      ],
    },
  }

  test('Requirement 1 & 6: Redundant 20-city button collection is removed; single dropdown handles city selection', async ({
    page,
  }) => {
    await page.goto('/')

    // Single city dropdown exists
    const citySelect = page.locator('#city-select')
    await expect(citySelect).toBeVisible()

    // The old bulky button grid must NOT exist
    await expect(page.locator('button:has-text("Pune"), button:has-text("Bengaluru")')).toHaveCount(0)
    // No grid of 20 city buttons in explorer
    await expect(page.locator('.grid-cols-4 button, .grid-cols-5 button')).toHaveCount(0)
  })

  test('Requirement 5: Anonymous citizen can discover public offices, services, and check queue without login', async ({
    page,
  }) => {
    // Intercept backend endpoints with mock data
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['Pune', 'Patna']) })
    })

    await page.route(/\/api\/v1\/locations(\?.*)?$/, async (route) => {
      const url = new URL(route.request().url())
      const city = url.searchParams.get('city')
      if (city === 'Pune') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPuneLocations) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })

    await page.route(/\/api\/v1\/services(\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockRtoServices) })
    })

    await page.route('**/api/v1/services/*/queue-status', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockQueueStatusDl) })
    })

    await page.route('**/api/v1/services/*/visit-plan', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockVisitPlanDl) })
    })

    await page.goto('/')

    // Verify user is anonymous (no login token) - Citizen Access button is visible and separate Staff Portal button is absent
    await expect(page.locator('#btn-open-citizen-access')).toBeVisible()
    await expect(page.locator('#btn-open-auth')).toHaveCount(0)

    // Select Pune
    const citySelect = page.locator('#city-select')
    await citySelect.selectOption('Pune')

    // Facility dropdown automatically populates and selects first facility
    const facilitySelect = page.locator('#facility-select')
    await expect(facilitySelect).toBeVisible()
    await expect(facilitySelect).toHaveValue('loc-pune-rto-001')

    // Service dropdown automatically populates and selects first service
    const serviceSelect = page.locator('#service-select')
    await expect(serviceSelect).toBeVisible()
    await expect(serviceSelect).toHaveValue('svc-pune-dl-001')

    // Check Queue button is enabled
    const checkQueueBtn = page.locator('#btn-check-queue')
    await expect(checkQueueBtn).toBeVisible()
    await expect(checkQueueBtn).toBeEnabled()

    // Click Check Queue
    await checkQueueBtn.click()

    // Wait projection appears
    const waitCard = page.locator('#demo-wait-projection')
    await expect(waitCard).toBeVisible()
    await expect(waitCard).toContainText('25')
    await expect(page.locator('#demo-people-ahead')).toContainText('5')

    // Smart Visit Planner renders verified checklist without any login
    const planner = page.locator('#smart-visit-planner-section')
    await expect(planner).toBeVisible()
    await expect(planner.getByText('Original Driving Licence')).toBeVisible()
    await expect(planner.getByText(/Sarathi Parivahan Citizen Portal/)).toBeVisible()
  })

  test('Requirement 1 & 4: Unseeded / empty city displays honest empty-state notice and clears children cleanly', async ({
    page,
  }) => {
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['Pune', 'Bhopal']) })
    })

    await page.route(/\/api\/v1\/locations(\?.*)?$/, async (route) => {
      const url = new URL(route.request().url())
      const city = url.searchParams.get('city')
      if (city === 'Pune') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPuneLocations) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })

    await page.route(/\/api\/v1\/services(\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockRtoServices) })
    })

    await page.goto('/')

    // 1. Select Pune first
    await page.locator('#city-select').selectOption('Pune')
    await expect(page.locator('#facility-select')).toBeEnabled()

    // 2. Switch to Bhopal (unseeded city)
    await page.locator('#city-select').selectOption('Bhopal')

    // 3. Truthful empty notice is displayed
    const emptyNotice = page.locator('#empty-facilities-notice')
    await expect(emptyNotice).toBeVisible()
    await expect(emptyNotice).toContainText('No registered public facilities in Bhopal')

    // 4. Facility select is disabled with placeholder
    const facilitySelect = page.locator('#facility-select')
    await expect(facilitySelect).toBeDisabled()
    await expect(facilitySelect.locator('option')).toHaveText('No facilities loaded')

    // 5. Service select is disabled with placeholder
    const serviceSelect = page.locator('#service-select')
    await expect(serviceSelect).toBeDisabled()
    await expect(serviceSelect.locator('option')).toHaveText('No services available')

    // 6. Check Queue button is disabled
    await expect(page.locator('#btn-check-queue')).toBeDisabled()
  })

  test('Patna checklist displays Patna Municipal Corporation authority without fake URL and PARTIALLY_VERIFIED badge', async ({
    page,
  }) => {
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['Patna']) })
    })

    await page.route(/\/api\/v1\/locations(\?.*)?$/, async (route) => {
      const url = new URL(route.request().url())
      const city = url.searchParams.get('city')
      if (city === 'Patna') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPatnaLocations) })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      }
    })

    await page.route(/\/api\/v1\/services(\?.*)?$/, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockPatnaServices) })
    })

    await page.route('**/api/v1/services/*/visit-plan', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockVisitPlanPatnaBd) })
    })

    await page.goto('/')

    await page.locator('#city-select').selectOption('Patna')

    const planner = page.locator('#smart-visit-planner-section')
    await expect(planner).toBeVisible()
    await expect(planner.getByText('Patna Municipal Corporation Citizen Services')).toBeVisible()
    await expect(planner.getByText('Partially Verified')).toBeVisible()
    await expect(planner.getByText('Prescribed Application Form')).toBeVisible()
    // Must NOT have a link to pmc.gov.in (which is Pune's portal)
    await expect(planner.locator('a[href="https://pmc.gov.in/"]')).toHaveCount(0)
  })
})
