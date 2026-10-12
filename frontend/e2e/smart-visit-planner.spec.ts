import { expect, test } from '@playwright/test'

test.describe('Smart Visit Planner E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#smart-visit-planner-section')).toBeVisible()
  })

  test('Scenario 1: Smart Visit Planner renders arrival window and verified checklist for Pune DL Renewal', async ({
    page,
  }) => {
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

    // 5. Verify Feature A: Deterministic Arrival Window
    await expect(
      plannerSection.getByRole('heading', { name: 'Deterministic Arrival Window' })
    ).toBeVisible()
    await expect(plannerSection.getByText('Suggested Arrival Window')).toBeVisible()
    await expect(plannerSection.getByText(/Within \d+–\d+ minutes/)).toBeVisible()
    await expect(plannerSection.getByText(/Model Confidence: HIGH/)).toBeVisible()
    await expect(plannerSection.getByText('Operational Assumptions')).toBeVisible()
    await expect(plannerSection.getByText('Honest Advisory & Disclaimer')).toBeVisible()
    await expect(
      plannerSection.getByText(/NOT an appointment or guarantee of service/i)
    ).toBeVisible()

    // 6. Verify Feature B: Document Readiness Checklist
    await expect(plannerSection.getByText(/Document Readiness Checklist/)).toBeVisible()
    await expect(plannerSection.getByText('Official Verified Source')).toBeVisible()
    await expect(plannerSection.getByText(/Sarathi Parivahan/i).first()).toBeVisible()
    await expect(plannerSection.getByText('Last Verified: 2026-10-01')).toBeVisible()
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

  test('Scenario 2: Unverified service displays truthful unverified notice without fabricated requirements', async ({
    page,
  }) => {
    const citySelect = page.locator('#city-select')
    await citySelect.selectOption('Pune')

    // Select Pune Sassoon General Hospital
    const facilitySelect = page.locator('#facility-select')
    const sassoonOption = facilitySelect.locator('option:has-text("Sassoon")').first()
    await expect(sassoonOption).toBeAttached()
    const sassoonVal = await sassoonOption.getAttribute('value')
    expect(sassoonVal).toBeTruthy()
    await facilitySelect.selectOption(sassoonVal!)

    // Select OPD Registration & Token Counter
    const serviceSelect = page.locator('#service-select')
    const opdOption = serviceSelect.locator('option:has-text("OPD")').first()
    await expect(opdOption).toBeAttached()
    const opdVal = await opdOption.getAttribute('value')
    expect(opdVal).toBeTruthy()
    await serviceSelect.selectOption(opdVal!)

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
    await expect(plannerSection.getByText('सटीक आगमन समय-सीमा (Arrival Window)')).toBeVisible()

    // Switch to Marathi
    await langSelect.selectOption('mr')
    await expect(plannerSection.getByRole('heading', { name: /स्मार्ट व्हिजिट प्लॅनर/ })).toBeVisible()
    await expect(plannerSection.getByRole('heading', { name: /दस्तऐवज तयारी चेकलिस्ट/ })).toBeVisible()
  })
})
