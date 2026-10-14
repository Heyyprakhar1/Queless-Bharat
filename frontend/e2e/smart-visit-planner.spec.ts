import { expect, test } from '@playwright/test'

const freshVisitPlanFixture = {
  service_id: '2baaba1f-447b-41c8-b5b8-5a4485868447',
  service_name: 'Driving Licence Renewal',
  location_name: 'Pune Regional Transport Office (MH-12 RTO)',
  city: 'Pune',
  arrival_window: {
    is_recommended: true,
    confidence: 'HIGH',
    window_start_minutes: 10,
    window_end_minutes: 25,
    suggested_arrival_text: 'Within 10–25 minutes',
    data_freshness_seconds: 1800, // Exact 1800s freshness boundary
    last_updated: '2026-10-13T10:00:00Z',
    reason: null,
    assumptions: [
      'Assumes active counter count (2 open desks) remains consistent.',
      'Based on recent empirical service throughput (~3.53 minutes per citizen).',
      'Assumes steady queue clearance without unforeseen high-priority emergency cases.',
      'Subject to facility operating hours and scheduled staff lunch/tea breaks.',
    ],
    disclaimer:
      'This arrival window is a statistical projection based on recent counter throughput, NOT an appointment or guarantee of service. Arrival within this window does not guarantee shorter waiting times.',
  },
  document_checklist: {
    service_id: '2baaba1f-447b-41c8-b5b8-5a4485868447',
    service_name: 'Driving Licence Renewal',
    verification_status: 'VERIFIED',
    has_verified_checklist: true,
    source_title: 'Ministry of Road Transport and Highways (MoRTH) / Sarathi Parivahan',
    source_url: 'https://sarathi.parivahan.gov.in/',
    verification_date: '2026-10-12',
    disclaimer: 'Completing this checklist does not guarantee approval or service.',
    items: [
      {
        id: 'dl_original',
        name: 'Original Driving Licence',
        description:
          'Physical licence card to be inspected and surrendered for new smart card issuance (CMVR 1989 Rule 18(1)(a)).',
        requirement_type: 'ORIGINAL_ONLY',
        is_mandatory: true,
        is_conditional: false,
        condition_description: null,
        notes: 'If lost or stolen, an official police report (NC) and Form LLD are required.',
      },
      {
        id: 'medical_form_1a',
        name: 'Medical Certificate (Form 1-A)',
        description:
          'Official medical fitness certificate signed and sealed by a registered medical practitioner (CMVR 1989 Rules 5(1), (3), 18(d)).',
        requirement_type: 'ORIGINAL_ONLY',
        is_mandatory: false,
        is_conditional: true,
        condition_description:
          'Mandatory for transport/commercial vehicle licence holders and all applicants aged 40 years or older per CMVR 1989 Rule 5(1).',
        notes: "Must carry registered practitioner's state medical council registration number.",
      },
      {
        id: 'proof_identity_address',
        name: 'Proof of Age & Address',
        description:
          'Valid government-issued photo identity and address document (Aadhaar, Voter ID, or Passport per CMVR Rule 4 & 18(1)(b)).',
        requirement_type: 'BOTH_ORIGINAL_AND_PHOTOCOPY',
        is_mandatory: true,
        is_conditional: false,
        condition_description: null,
        notes: 'Present physical original for in-person visual inspection plus a signed self-attested copy.',
      },
      {
        id: 'sarathi_form_9',
        name: 'Sarathi Online Application Acknowledgement (Form 9)',
        description:
          'Printed confirmation slip or application reference receipt from the Sarathi Parivahan portal (CMVR Rule 18(1)).',
        requirement_type: 'PHOTOCOPY_ONLY',
        is_mandatory: true,
        is_conditional: false,
        condition_description: null,
        notes: 'Must clearly display your Application Number and verified fee payment status.',
      },
    ],
  },
  is_simulated: true,
}

const staleVisitPlanFixture = {
  ...freshVisitPlanFixture,
  arrival_window: {
    is_recommended: false,
    confidence: null,
    window_start_minutes: null,
    window_end_minutes: null,
    suggested_arrival_text: null,
    data_freshness_seconds: 1801, // Exact 1801s stale boundary (>1800s)
    last_updated: '2026-10-13T10:00:00Z',
    reason: 'Queue telemetry is stale (>30 minutes old). Arrival window suppressed to prevent citizen misguidance.',
    assumptions: [],
    disclaimer:
      'This arrival window is a statistical projection based on recent counter throughput, NOT an appointment or guarantee of service. Arrival within this window does not guarantee shorter waiting times.',
  },
}

test.describe('Smart Visit Planner E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#smart-visit-planner-section')).toBeVisible()
  })

  test('Scenario 1: Smart Visit Planner renders arrival window and verified checklist for Pune DL Renewal with fresh telemetry (1800s boundary)', async ({
    page,
  }) => {
    // Intercept visit plan API to guarantee known fresh telemetry at 1800s boundary
    await page.route('**/api/v1/services/*/visit-plan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(freshVisitPlanFixture),
      })
    })

    // 1. Select Pune city
    const citySelect = page.locator('#city-select')
    await expect(citySelect).toBeVisible()
    await citySelect.selectOption('Pune')

    // 2. Select Pune RTO facility
    const facilitySelect = page.locator('#facility-select')
    await expect(facilitySelect).toBeVisible()
    const rtoOption = facilitySelect.locator('option:has-text("RTO")').first()
    await expect(rtoOption).toBeAttached()
    const rtoVal = await rtoOption.getAttribute('value')
    expect(rtoVal).toBeTruthy()
    await facilitySelect.selectOption(rtoVal!)

    // 3. Select Driving Licence Renewal service
    const serviceSelect = page.locator('#service-select')
    await expect(serviceSelect).toBeVisible()
    const dlOption = serviceSelect.locator('option:has-text("Driving Licence Renewal")').first()
    await expect(dlOption).toBeAttached()
    const dlVal = await dlOption.getAttribute('value')
    expect(dlVal).toBeTruthy()
    await serviceSelect.selectOption(dlVal!)

    // Click Check Queue
    await page.locator('#btn-check-queue').click()

    // 4. Verify Smart Visit Planner loaded the service plan
    const plannerSection = page.locator('#smart-visit-planner-section')
    await expect(plannerSection).toBeVisible()
    await expect(plannerSection.getByRole('heading', { name: /Driving Licence Renewal/ })).toBeVisible()

    // 5. Verify Feature A: Deterministic Arrival Window strictly asserted without conditions
    await expect(
      plannerSection.getByRole('heading', { name: 'Deterministic Arrival Window' })
    ).toBeVisible()
    await expect(plannerSection.getByText('Suggested Arrival Window')).toBeVisible()
    await expect(plannerSection.getByText(/Within 10–25 minutes/)).toBeVisible()
    await expect(plannerSection.getByText(/Model Confidence: HIGH/)).toBeVisible()
    await expect(plannerSection.getByText('Operational Assumptions')).toBeVisible()
    await expect(plannerSection.getByText('Honest Advisory & Disclaimer')).toBeVisible()
    await expect(plannerSection.getByText(/Telemetry freshness: 1800s ago/i)).toBeVisible()

    // 6. Verify Feature B: Document Readiness Checklist
    await expect(plannerSection.getByText(/Document Readiness Checklist/)).toBeVisible()
    await expect(plannerSection.getByText('Official Verified Source')).toBeVisible()
    await expect(plannerSection.getByText(/Sarathi Parivahan/i).first()).toBeVisible()
    await expect(plannerSection.getByText('Last Verified: 2026-10-12')).toBeVisible()
    await expect(
      plannerSection.getByText('Completing this checklist does not guarantee approval or service.')
    ).toBeVisible()

    // 7. Verify all 4 verified documents
    await expect(plannerSection.getByText('Original Driving Licence')).toBeVisible()
    await expect(plannerSection.getByText('Medical Certificate (Form 1-A)')).toBeVisible()
    await expect(plannerSection.getByText('Proof of Age & Address')).toBeVisible()
    await expect(
      plannerSection.getByText('Sarathi Online Application Acknowledgement (Form 9)')
    ).toBeVisible()

    // Verify requirement badges
    await expect(plannerSection.getByText('Original Document Only').first()).toBeVisible()
    await expect(
      plannerSection.getByText('Both Original & Self-Attested Copy')
    ).toBeVisible()
    await expect(plannerSection.getByText('Photocopy / Printout Only')).toBeVisible()

    // 8. Test interactive checkbox completion
    const firstCheckbox = page.locator('#doc-check-dl_original')
    await expect(firstCheckbox).not.toBeChecked()
    await firstCheckbox.check()
    await expect(firstCheckbox).toBeChecked()

    // Check progress indicator
    await expect(plannerSection.getByText('1 of 4 documents ready')).toBeVisible()

    // Check remaining checkboxes
    await page.locator('#doc-check-medical_form_1a').check()
    await page.locator('#doc-check-proof_identity_address').check()
    await page.locator('#doc-check-sarathi_form_9').check()

    // Verify all-ready badge
    await expect(plannerSection.getByText('All required documents checked and ready!')).toBeVisible()
  })

  test('Scenario 1B: Stale telemetry at 1801 seconds safely suppresses arrival window recommendation', async ({
    page,
  }) => {
    // Intercept visit plan API to guarantee known stale telemetry at 1801s boundary
    await page.route('**/api/v1/services/*/visit-plan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(staleVisitPlanFixture),
      })
    })

    // 1. Select Pune city
    const citySelect = page.locator('#city-select')
    await expect(citySelect).toBeVisible()
    await citySelect.selectOption('Pune')

    // 2. Select Pune RTO facility
    const facilitySelect = page.locator('#facility-select')
    await expect(facilitySelect).toBeVisible()
    const rtoOption = facilitySelect.locator('option:has-text("RTO")').first()
    await expect(rtoOption).toBeAttached()
    const rtoVal = await rtoOption.getAttribute('value')
    expect(rtoVal).toBeTruthy()
    await facilitySelect.selectOption(rtoVal!)

    // 3. Select Driving Licence Renewal service
    const serviceSelect = page.locator('#service-select')
    await expect(serviceSelect).toBeVisible()
    const dlOption = serviceSelect.locator('option:has-text("Driving Licence Renewal")').first()
    await expect(dlOption).toBeAttached()
    const dlVal = await dlOption.getAttribute('value')
    expect(dlVal).toBeTruthy()
    await serviceSelect.selectOption(dlVal!)

    // Click Check Queue
    await page.locator('#btn-check-queue').click()

    // 4. Verify Smart Visit Planner loaded the service plan
    const plannerSection = page.locator('#smart-visit-planner-section')
    await expect(plannerSection).toBeVisible()
    await expect(plannerSection.getByRole('heading', { name: /Driving Licence Renewal/ })).toBeVisible()

    // 5. Verify Feature A: Arrival window recommendation is strictly suppressed
    await expect(plannerSection.getByText('Suggested Arrival Window')).not.toBeVisible()
    await expect(plannerSection.getByText(/Queue telemetry is stale/i)).toBeVisible()
    await expect(
      plannerSection.getByText(/QueuelessBharat strictly reports unavailable states/i)
    ).toBeVisible()

    // 6. Verify Feature B: Document Readiness Checklist remains fully visible and interactive
    await expect(plannerSection.getByText(/Document Readiness Checklist/)).toBeVisible()
    await expect(plannerSection.getByText('Original Driving Licence')).toBeVisible()
    const dlCheckbox = page.locator('#doc-check-dl_original')
    await expect(dlCheckbox).toBeVisible()
    await dlCheckbox.check()
    await expect(dlCheckbox).toBeChecked()
    await expect(plannerSection.getByText('1 of 4 documents ready')).toBeVisible()
  })

  test('Scenario 2: Unverified service displays truthful unverified notice without fabricated requirements', async ({
    page,
  }) => {
    const citySelect = page.locator('#city-select')
    await citySelect.selectOption('Pune')

    // Select Pune Fergusson College Campus Office
    const facilitySelect = page.locator('#facility-select')
    const collegeOption = facilitySelect.locator('option:has-text("Fergusson")').first()
    await expect(collegeOption).toBeAttached()
    const collegeVal = await collegeOption.getAttribute('value')
    expect(collegeVal).toBeTruthy()
    await facilitySelect.selectOption(collegeVal!)

    // Select Admissions & Merit List Verification
    const serviceSelect = page.locator('#service-select')
    const admOption = serviceSelect.locator('option:has-text("Admissions")').first()
    await expect(admOption).toBeAttached()
    const admVal = await admOption.getAttribute('value')
    expect(admVal).toBeTruthy()
    await serviceSelect.selectOption(admVal!)

    await page.locator('#btn-check-queue').click()

    const plannerSection = page.locator('#smart-visit-planner-section')
    await expect(plannerSection).toBeVisible()

    // Unverified checklist notice must be present
    await expect(
      plannerSection.getByText('Official verified checklist is not yet available for this service.')
    ).toBeVisible()
    // No fabricated documents
    await expect(plannerSection.locator('#doc-check-dl_original')).not.toBeVisible()
  })

  test('Scenario 3: "Plan Visit & Check Documents" CTA scrolls smoothly to planner', async ({
    page,
  }) => {
    const citySelect = page.locator('#city-select')
    await citySelect.selectOption('Pune')

    const facilitySelect = page.locator('#facility-select')
    const rtoOption = facilitySelect.locator('option:has-text("RTO")').first()
    await expect(rtoOption).toBeAttached()
    const rtoVal = await rtoOption.getAttribute('value')
    expect(rtoVal).toBeTruthy()
    await facilitySelect.selectOption(rtoVal!)

    await page.locator('#btn-check-queue').click()

    const planVisitBtn = page.locator('#btn-plan-visit')
    await expect(planVisitBtn).toBeVisible()
    await planVisitBtn.click()

    const plannerSection = page.locator('#smart-visit-planner-section')
    await expect(plannerSection).toBeInViewport()
  })

  test('Scenario 4: Language switching translates Smart Visit Planner cleanly to Hindi and Marathi', async ({
    page,
  }) => {
    const citySelect = page.locator('#city-select')
    await citySelect.selectOption('Pune')

    const facilitySelect = page.locator('#facility-select')
    const rtoOption = facilitySelect.locator('option:has-text("RTO")').first()
    await expect(rtoOption).toBeAttached()
    const rtoVal = await rtoOption.getAttribute('value')
    expect(rtoVal).toBeTruthy()
    await facilitySelect.selectOption(rtoVal!)

    await page.locator('#btn-check-queue').click()

    // Switch to Hindi
    const langSelect = page.locator('#language-select')
    await langSelect.selectOption('hi')

    const plannerSection = page.locator('#smart-visit-planner-section')
    await expect(plannerSection.getByRole('heading', { name: /स्मार्ट विज़िट प्लानर/ })).toBeVisible()
    await expect(plannerSection.getByRole('heading', { name: /दस्तावेज़ तत्परता चेकलिस्ट/ })).toBeVisible()
    await expect(
      plannerSection.getByRole('heading', { name: /सटीक आगमन समय-सीमा/ })
    ).toBeVisible()

    // Switch to Marathi
    await langSelect.selectOption('mr')
    await expect(plannerSection.getByRole('heading', { name: /स्मार्ट व्हिजिट प्लॅनर/ })).toBeVisible()
    await expect(plannerSection.getByRole('heading', { name: /दस्तऐवज तयारी चेकलिस्ट/ })).toBeVisible()
  })

  test('Scenario 5: Smart Visit Planner header is positioned cleanly at the top without empty vertical gap', async ({
    page,
  }) => {
    const plannerCard = page.locator('#smart-visit-planner-section')
    await expect(plannerCard).toBeVisible()

    // Measure the vertical distance between card top and header title atomically
    const { cardTop, headerTop, watermarkExists } = await plannerCard.evaluate((card) => {
      const cardRect = card.getBoundingClientRect()
      const header = card.querySelector('h3')
      const headerRect = header ? header.getBoundingClientRect() : { top: 0 }
      const svg = card.querySelector('svg[aria-hidden="true"]')
      return {
        cardTop: cardRect.top,
        headerTop: headerRect.top,
        watermarkExists: !!svg,
      }
    })

    // Bounding box difference should be minimal (card padding p-6 is 24px + badges ~26px = 50px)
    // Previously, the unpositioned in-flow watermark caused a 460px+ empty vertical space!
    const topGap = headerTop - cardTop
    expect(topGap).toBeGreaterThan(0)
    expect(topGap).toBeLessThan(100)
    expect(watermarkExists).toBe(true)
  })
})
