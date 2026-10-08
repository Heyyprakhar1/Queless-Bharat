import { expect, test } from '@playwright/test'

const BACKEND_URL = 'http://localhost:8001'

test.describe('QueueLess Bharat — M6.1 India Demo Coverage E2E Suite', () => {
  test.beforeAll(async ({ request }) => {
    // Authenticate as Admin to verify backend connectivity
    const loginResp = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: {
        email: 'admin@queless.gov.in',
        password: 'AdminPass123!',
      },
    })
    expect(loginResp.status()).toBe(200)
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('Test 1: Simulation disclaimer banner and DEMO DATA badges are prominently visible', async ({
    page,
  }) => {
    // Verify hero disclaimer
    const noticeBanner = page.locator('#simulation-notice-banner')
    await expect(noticeBanner).toBeVisible()
    await expect(noticeBanner).toContainText('DEMO / SIMULATED DATA')
    await expect(noticeBanner).toContainText('Not live facility telemetry')

    // Verify explorer card simulation badge
    await expect(page.getByText('DEMO / SIMULATED DATA').first()).toBeVisible()
  })

  test('Test 2: Pune showcase city -> RTO -> Driving Licence Renewal deterministic estimate flow', async ({
    page,
  }) => {
    // 1. Verify Pune is preselected or selectable
    const citySelect = page.locator('#city-select')
    await expect(citySelect).toBeVisible()
    await citySelect.selectOption('Pune')

    // 2. Select Pune RTO
    const facilitySelect = page.locator('#facility-select')
    await expect(facilitySelect).toBeVisible()
    // Select option containing RTO
    const rtoOption = await facilitySelect.locator('option:has-text("MH-12 RTO")').first().getAttribute('value')
    expect(rtoOption).toBeTruthy()
    await facilitySelect.selectOption(rtoOption!)

    // 3. Select Driving Licence Renewal
    const serviceSelect = page.locator('#service-select')
    await expect(serviceSelect).toBeVisible()
    const dlOption = await serviceSelect.locator('option:has-text("Driving Licence Renewal")').first().getAttribute('value')
    expect(dlOption).toBeTruthy()
    await serviceSelect.selectOption(dlOption!)

    // 4. Verify deterministic queue status and wait estimate render
    await expect(page.locator('#demo-people-ahead')).toContainText('8')
    await expect(page.locator('#demo-active-counters')).toContainText('2')

    const projectionCard = page.locator('#demo-wait-projection')
    await expect(projectionCard).toBeVisible()
    await expect(projectionCard).toContainText('Deterministic Wait Projection')
    await expect(projectionCard).toContainText('minutes')
    await expect(projectionCard).toContainText('expected')
    await expect(projectionCard).toContainText('Sample Baseline: 12 completed throughput sessions')
  })

  test('Test 3: Insufficient-data scenario renders truthful unavailable status without fake numbers', async ({
    page,
  }) => {
    await page.locator('#city-select').selectOption('Pune')

    const facilitySelect = page.locator('#facility-select')
    const sassoonOption = await facilitySelect.locator('option:has-text("Sassoon")').first().getAttribute('value')
    expect(sassoonOption).toBeTruthy()
    await facilitySelect.selectOption(sassoonOption!)

    const serviceSelect = page.locator('#service-select')
    const radioOption = await serviceSelect.locator('option:has-text("Radiology")').first().getAttribute('value')
    expect(radioOption).toBeTruthy()
    await serviceSelect.selectOption(radioOption!)

    // Verify unavailable state
    const unavailableMsg = page.locator('#demo-unavailable-msg')
    await expect(unavailableMsg).toBeVisible()
    await expect(unavailableMsg).toContainText('Estimate Unavailable')
    await expect(unavailableMsg).toContainText('Insufficient sample data: no completed service sessions recorded')
    await expect(unavailableMsg).toContainText('never fabricates false wait estimates')
  })

  test('Test 4: Closed / zero active counters scenario renders unavailable status', async ({
    page,
  }) => {
    await page.locator('#city-select').selectOption('Pune')

    const facilitySelect = page.locator('#facility-select')
    const pmcOption = await facilitySelect.locator('option:has-text("PMC")').first().getAttribute('value')
    expect(pmcOption).toBeTruthy()
    await facilitySelect.selectOption(pmcOption!)

    const serviceSelect = page.locator('#service-select')
    const bdOption = await serviceSelect.locator('option:has-text("Birth & Death")').first().getAttribute('value')
    expect(bdOption).toBeTruthy()
    await serviceSelect.selectOption(bdOption!)

    await expect(page.locator('#demo-active-counters')).toContainText('0')
    const unavailableMsg = page.locator('#demo-unavailable-msg')
    await expect(unavailableMsg).toBeVisible()
    await expect(unavailableMsg).toContainText('No active counters available to serve waiting queue')
  })

  test('Test 5: Metro cities switching (Mumbai, Bengaluru, Delhi) updates facilities and services', async ({
    page,
  }) => {
    // Select Mumbai
    await page.locator('#city-select').selectOption('Mumbai')
    await expect(page.locator('#facility-select')).toContainText('Mumbai Central RTO')

    // Select Bengaluru
    await page.locator('#city-select').selectOption('Bengaluru')
    await expect(page.locator('#facility-select')).toContainText('Bengaluru Central RTO')

    // Select Delhi
    await page.locator('#city-select').selectOption('Delhi')
    await expect(page.locator('#facility-select')).toContainText('AIIMS New Delhi')
  })

  test('Test 6: Expanded 20 urban markets and diverse categories are selectable', async ({
    page,
  }) => {
    // Select Hyderabad
    await page.locator('#city-select').selectOption('Hyderabad')
    await expect(page.locator('#facility-select')).toContainText('Osmania General Hospital')

    // Select Ahmedabad
    await page.locator('#city-select').selectOption('Ahmedabad')
    await expect(page.locator('#facility-select')).toContainText('Gujarat University')

    // Select Chandigarh
    await page.locator('#city-select').selectOption('Chandigarh')
    await expect(page.locator('#facility-select')).toContainText('PGIMER')

    // Select Kochi
    await page.locator('#city-select').selectOption('Kochi')
    await expect(page.locator('#facility-select')).toContainText('Grand Cochin Heritage Hotel')
  })
})
