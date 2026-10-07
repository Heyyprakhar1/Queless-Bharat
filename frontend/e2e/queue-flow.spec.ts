import { expect, test } from '@playwright/test'

const BACKEND_URL = 'http://localhost:8001'

let locationId: string

test.beforeAll(async ({ request }) => {
  // Ensure base location exists
  const locResp = await request.post(`${BACKEND_URL}/api/v1/locations`, {
    data: {
      name: 'AIIMS Central Hospital',
      category: 'hospital',
      address: 'Saket Nagar',
      city: 'Bhopal',
      state: 'Madhya Pradesh',
      timezone: 'Asia/Kolkata',
    },
  })
  const loc = await locResp.json()
  locationId = loc.id
})

// Helper to create an isolated service and active counter for clean test runs
async function setupIsolatedService(request: any, name: string) {
  const svcResp = await request.post(`${BACKEND_URL}/api/v1/services`, {
    data: {
      location_id: locationId,
      name: `${name} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'Test service track',
    },
  })
  const svc = await svcResp.json()

  const cntResp = await request.post(`${BACKEND_URL}/api/v1/counters`, {
    data: {
      service_id: svc.id,
      name: 'Counter 1',
      status: 'active',
    },
  })
  const cnt = await cntResp.json()

  return { serviceId: svc.id, serviceName: svc.name, counterId: cnt.id }
}

test.describe('QueueLess Bharat — Real Browser E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test for clean slate
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('Test 1: Citizen joins queue and verifies API-backed queue status (Phases 3, 4, 10)', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'OPD Registration')

    // 1. Open frontend in real browser
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Predictable Waiting for Public Services')
    await expect(page.locator('text=System Online')).toBeVisible()

    // 2. Select the isolated service
    const serviceSelect = page.locator('#facility-service')
    await expect(serviceSelect).toBeVisible()
    await page.selectOption('#facility-service', { value: serviceId })
    await page.fill('#citizen-name', 'Citizen Amit Sharma')

    // 3. Intercept API request to verify genuine contract
    const checkInPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/queue/check-in') && resp.status() === 201
    )

    // 4. Click Join Queue / Issue Token
    await page.click('button:has-text("Join Queue / Issue Token")')

    const checkInResp = await checkInPromise
    const checkInData = await checkInResp.json()
    const sessionId = checkInData.id
    expect(sessionId).toBeTruthy()
    expect(checkInData.status).toBe('WAITING')

    // 5. Verify the UI renders the token card and status
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
    await expect(page.locator(`text=${sessionId}`)).toBeVisible()
    await expect(page.locator('text=#1')).toBeVisible() // 1-based position
    await expect(page.locator("text=You're next in line!")).toBeVisible()

    // 6. Cross-verify API <-> UI consistency against database via backend request
    const dbStatusResp = await request.get(`${BACKEND_URL}/api/v1/queue/${sessionId}/status`)
    expect(dbStatusResp.status()).toBe(200)
    const dbStatus = await dbStatusResp.json()
    expect(dbStatus.session.id).toBe(sessionId)
    expect(dbStatus.session.status).toBe('WAITING')
    expect(dbStatus.position).toBe(1)
    expect(dbStatus.people_ahead).toBe(0)
  })

  test('Test 2: Verifies periodic HTTP short polling without page refresh (Phase 5)', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'Laboratory Intake')
    await page.goto('/')
    await page.selectOption('#facility-service', { value: serviceId })
    await page.fill('#citizen-name', 'Citizen Polling Watcher')

    // Monitor status polling requests
    const pollRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/queue/') && req.url().includes('/status')) {
        pollRequests.push(req.url())
      }
    })

    await page.click('button:has-text("Join Queue / Issue Token")')
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    // Wait 12 seconds to observe at least 2 automatic polling cycles (5s interval)
    await page.waitForTimeout(11000)

    // Confirm multiple polling queries arrived
    expect(pollRequests.length).toBeGreaterThanOrEqual(2)
    // Confirm UI remains alive and responsive
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
  })

  test('Test 3: Complete lifecycle transition WAITING -> IN_SERVICE -> COMPLETED (Phase 6)', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'Radiology Token')
    await page.goto('/')
    await page.selectOption('#facility-service', { value: serviceId })
    await page.fill('#citizen-name', 'Citizen Lifecycle Participant')

    const checkInPromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/v1/queue/check-in')
    )
    await page.click('button:has-text("Join Queue / Issue Token")')
    const checkInData = await (await checkInPromise).json()
    const sessionId = checkInData.id

    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
    await expect(page.locator('text=#1')).toBeVisible()

    // Step A: Operator calls into service
    const startPromise = page.waitForResponse(
      (resp) => resp.url().includes('/start') && resp.status() === 200
    )
    await page.click('button:has-text("Call into Service (Start)")')
    await startPromise

    // Verify UI reflects IN_SERVICE state
    await expect(page.getByText('NOW AT COUNTER (IN SERVICE)', { exact: true })).toBeVisible()
    // Position is no longer represented as an active line number
    await expect(page.locator('text=currently being served')).toBeVisible()

    // Verify DB state
    const inServiceDb = await (
      await request.get(`${BACKEND_URL}/api/v1/queue/${sessionId}/status`)
    ).json()
    expect(inServiceDb.session.status).toBe('IN_SERVICE')
    expect(inServiceDb.position).toBeNull()

    // Step B: Operator completes service
    const completePromise = page.waitForResponse(
      (resp) => resp.url().includes('/complete') && resp.status() === 200
    )
    await page.click('button:has-text("Finish Service (Complete)")')
    await completePromise

    // Verify UI reflects COMPLETED terminal state
    await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible()
    await expect(page.locator('text=lifecycle completed')).toBeVisible()
    await expect(page.locator('button:has-text("Take New Token")')).toBeVisible()

    // Verify DB state
    const completedDb = await (
      await request.get(`${BACKEND_URL}/api/v1/queue/${sessionId}/status`)
    ).json()
    expect(completedDb.session.status).toBe('COMPLETED')
    expect(completedDb.position).toBeNull()
  })

  test('Test 4: Citizen cancellation flow WAITING -> CANCELLED (Phase 7)', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'Emergency Desk')
    await page.goto('/')
    await page.selectOption('#facility-service', { value: serviceId })
    await page.fill('#citizen-name', 'Citizen Leaving Early')

    const checkInPromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/v1/queue/check-in')
    )
    await page.click('button:has-text("Join Queue / Issue Token")')
    const checkInData = await (await checkInPromise).json()
    const sessionId = checkInData.id

    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    // Citizen cancels ticket
    const cancelPromise = page.waitForResponse(
      (resp) => resp.url().includes('/cancel') && resp.status() === 200
    )
    await page.click('button:has-text("Leave Queue / Cancel")')
    await cancelPromise

    // Verify UI reflects CANCELLED terminal state
    await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible()
    await expect(page.locator('text=lifecycle completed')).toBeVisible()

    // Verify operator actions are disabled for cancelled ticket
    const startButton = page.locator('button:has-text("Call into Service (Start)")')
    await expect(startButton).toBeDisabled()

    // Verify DB state
    const cancelledDb = await (
      await request.get(`${BACKEND_URL}/api/v1/queue/${sessionId}/status`)
    ).json()
    expect(cancelledDb.session.status).toBe('CANCELLED')
    expect(cancelledDb.position).toBeNull()
  })

  test('Test 5: Persistence and page refresh restoration (Phase 8)', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'Billing Counter')
    await page.goto('/')
    await page.selectOption('#facility-service', { value: serviceId })
    await page.fill('#citizen-name', 'Citizen Refresh Test')

    const checkInPromise = page.waitForResponse((resp) =>
      resp.url().includes('/api/v1/queue/check-in')
    )
    await page.click('button:has-text("Join Queue / Issue Token")')
    const checkInData = await (await checkInPromise).json()
    const sessionId = checkInData.id

    await expect(page.locator(`text=${sessionId}`)).toBeVisible()
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    // Refresh the browser page
    await page.reload()

    // Verify ticket and live status restore immediately from localStorage
    await expect(page.locator(`text=${sessionId}`)).toBeVisible()
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
    await expect(page.locator('text=Citizen Refresh Test')).toBeVisible()
  })

  test('Test 6: Browser-visible error handling and non-crash resilience (Phase 9)', async ({
    page,
  }) => {
    await page.goto('/')

    // Trigger an error by requesting a non-existent ticket in localStorage
    await page.evaluate(() => {
      localStorage.setItem('queless_active_session_id', '00000000-0000-0000-0000-000000000000')
    })
    await page.reload()

    // The UI should display the error gracefully without a white-screen crash
    await expect(page.locator('text=Error:')).toBeVisible()
    await expect(
      page.locator("text=QueueSession with identifier '00000000-0000-0000-0000-000000000000' was not found")
    ).toBeVisible()

    // Header and navigation still functional
    await expect(page.locator('h1')).toContainText('Predictable Waiting for Public Services')
  })
})
