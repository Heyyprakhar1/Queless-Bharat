import { expect, test } from '@playwright/test'

const BACKEND_URL = 'http://localhost:8001'

let adminToken: string
let locationId: string

test.beforeAll(async ({ request }) => {
  const loginResp = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
    data: {
      email: 'admin@queless.gov.in',
      password: 'AdminPass123!',
    },
  })
  expect(loginResp.status()).toBe(200)
  const loginData = await loginResp.json()
  adminToken = loginData.access_token

  // Ensure base location exists
  const locResp = await request.post(`${BACKEND_URL}/api/v1/locations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'Pune District Collectorate',
      category: 'government_office',
      address: 'Station Road',
      city: 'Pune',
      state: 'Maharashtra',
      timezone: 'Asia/Kolkata',
    },
  })
  const loc = await locResp.json()
  locationId = loc.id

  // Ensure any active in-service sessions for Admissions service are completed for deterministic starting state
  const svcsResp = await request.get(`${BACKEND_URL}/api/v1/services`)
  const svcs = await svcsResp.json()
  const admSvc = svcs.find((s: any) => s.name === 'Admissions & Merit List Verification')
  if (admSvc) {
    for (let i = 0; i < 5; i++) {
      const deskResp = await request.get(`${BACKEND_URL}/api/v1/queue/services/${admSvc.id}/desk`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (!deskResp.ok()) break
      const desk = await deskResp.json()
      if (!desk.active_session) break
      await request.post(`${BACKEND_URL}/api/v1/queue/${desk.active_session.id}/complete`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    }
  }
})

async function setupIsolatedServiceWithOperator(request: any, name: string) {
  const svcResp = await request.post(`${BACKEND_URL}/api/v1/services`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      location_id: locationId,
      name: `000-${name} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'Operator desk visibility isolated test track',
    },
  })
  const svc = await svcResp.json()

  await request.post(`${BACKEND_URL}/api/v1/counters`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      service_id: svc.id,
      name: 'Counter 1',
      status: 'active',
    },
  })

  const opEmail = `op.desk.${svc.id.slice(0, 8)}@queless.gov.in`
  const opPass = 'OperatorPass123!'
  await request.post(`${BACKEND_URL}/api/v1/auth/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: opEmail,
      password: opPass,
      full_name: 'Desk Operator Isolated',
      role: 'OPERATOR',
      assigned_service_id: svc.id,
    },
  })

  return { serviceId: svc.id, serviceName: svc.name, opEmail, opPass }
}

test.describe('Operator Desk Visibility & Token Lifecycle Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('Bug Trace 1: Citizen token for Pune Admissions is visible in Operator Desk waiting queue with RBAC controls', async ({
    page,
    request,
  }) => {
    // 1. Citizen logs in and navigates to Pune Admissions service
    await page.goto('/')
    await page.click('#btn-open-citizen-access')
    await page.click('#tab-login')
    await page.fill('#input-login-email', 'citizen@queless.gov.in')
    await page.fill('#input-login-password', 'CitizenPass123!')
    await page.click('#btn-submit-login')
    await expect(page.locator('#auth-user-badge')).toContainText('Citizen Amit Sharma')
    await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')

    // Find Admissions & Merit List Verification service in Fergusson College, Pune
    const servicesResp = await request.get(`${BACKEND_URL}/api/v1/services`)
    expect(servicesResp.status()).toBe(200)
    const services = await servicesResp.json()
    const admissionsService = services.find(
      (s: any) => s.name === 'Admissions & Merit List Verification'
    )
    expect(admissionsService).toBeTruthy()
    const serviceId = admissionsService.id

    // Select the Admissions service in the UI
    await page.selectOption('#facility-service', { value: serviceId })

    // Citizen joins the queue
    const checkInPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/queue/check-in') && resp.status() === 201
    )
    await page.click('#btn-join-queue')
    const checkInResp = await checkInPromise
    const checkInData = await checkInResp.json()
    const citizenSessionId = checkInData.id
    expect(citizenSessionId).toBeTruthy()
    expect(checkInData.status).toBe('WAITING')
    expect(checkInData.service_id).toBe(serviceId)

    // Verify citizen card displays token and WAITING status
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
    await expect(page.locator(`text=${citizenSessionId}`)).toBeVisible()

    // 2. Role-Based Controls: Staff controls are not exposed to ordinary Citizen accounts
    await expect(page.locator('#operator-role-indicator')).not.toBeVisible()
    await expect(page.locator('#btn-operator-start')).not.toBeVisible()
    await expect(page.locator('#btn-operator-complete')).not.toBeVisible()

    // Direct API attempt by citizen returns 403 Forbidden (backend RBAC intact)
    const citizenToken = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    const forbiddenResp = await request.post(`${BACKEND_URL}/api/v1/queue/${citizenSessionId}/start`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    })
    expect(forbiddenResp.status()).toBe(403)
    const forbiddenData = await forbiddenResp.json()
    expect(forbiddenData.detail).toContain('lacks permission for this action')

    // 3. Backend Verification: Token persisted with correct service and location
    const dbStatusResp = await request.get(`${BACKEND_URL}/api/v1/queue/${citizenSessionId}/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    expect(dbStatusResp.status()).toBe(200)
    const dbStatus = await dbStatusResp.json()
    expect(dbStatus.session.id).toBe(citizenSessionId)
    expect(dbStatus.session.service_id).toBe(serviceId)
    expect(dbStatus.session.status).toBe('WAITING')

    // 4. Operator logs in and opens Operator Desk
    await page.click('#btn-logout')
    await expect(page.locator('#btn-open-citizen-access')).toBeVisible()
    await expect(page.locator('#btn-open-auth')).toHaveCount(0)

    await page.click('#btn-open-citizen-access')
    await page.click('#tab-login')
    await page.fill('#input-login-email', 'operator@queless.gov.in')
    await page.fill('#input-login-password', 'OperatorPass123!')
    await page.click('#btn-submit-login')

    await expect(page.locator('#auth-user-badge')).toContainText('Desk Operator Rajesh')
    await expect(page.locator('#auth-role-badge')).toHaveText('OPERATOR')

    // Operator Desk displays assigned service
    await expect(page.getByRole('strong')).toContainText('Admissions & Merit List Verification')

    // Verify waiting tokens are visible in Operator Desk list (includes the newly issued citizen token)
    const waitingQueueList = page.locator('#operator-waiting-queue-list')
    await expect(waitingQueueList).toBeVisible()
    await expect(waitingQueueList).toContainText(citizenSessionId.slice(0, 8))
    await expect(waitingQueueList).toContainText('Citizen Amit Sharma')

    // Verify Start control is ENABLED for the assigned operator
    const startButton = page.locator('#btn-operator-start')
    await expect(startButton).toBeEnabled()

    // 5. Operator advances queue: calls participant into service
    const startPromise = page.waitForResponse(
      (resp) => resp.url().includes('/start') && resp.status() === 200
    )
    await startButton.click()
    await startPromise

    // Operator Desk now shows participant seated at desk
    await expect(page.locator('text=COUNTER ACTIVE: IN SERVICE')).toBeVisible()
    await expect(page.locator('text=Serving now')).toBeVisible()

    // Operator finishes service
    const completeButton = page.locator('#btn-operator-complete')
    await expect(completeButton).toBeEnabled()
    const completePromise = page.waitForResponse(
      (resp) => resp.url().includes('/complete') && resp.status() === 200
    )
    await completeButton.click()
    await completePromise
  })

  test('Bug Trace 2: Isolated service end-to-end token flow from issuance to complete with operator visibility', async ({
    page,
    request,
  }) => {
    const { serviceId, opEmail, opPass } = await setupIsolatedServiceWithOperator(
      request,
      'Admissions Verification Verification Track'
    )

    // 1. Citizen joins isolated queue
    await page.goto('/')
    await page.click('#btn-open-citizen-access')
    await page.click('#tab-login')
    await page.fill('#input-login-email', 'citizen@queless.gov.in')
    await page.fill('#input-login-password', 'CitizenPass123!')
    await page.click('#btn-submit-login')

    await page.selectOption('#facility-service', { value: serviceId })

    const checkInPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/queue/check-in') && resp.status() === 201
    )
    await page.click('#btn-join-queue')
    const checkInData = await (await checkInPromise).json()
    const citizenSessionId = checkInData.id

    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    // 2. Operator logs in and views isolated service queue
    await page.click('#btn-logout')
    await expect(page.locator('#btn-open-citizen-access')).toBeVisible()
    await expect(page.locator('#btn-open-auth')).toHaveCount(0)
    await page.click('#btn-open-citizen-access')
    await page.click('#tab-login')
    await page.fill('#input-login-email', opEmail)
    await page.fill('#input-login-password', opPass)
    await page.click('#btn-submit-login')

    await expect(page.locator('#auth-role-badge')).toHaveText('OPERATOR')

    // Operator Desk displays empty active desk and 1 waiting session
    await expect(page.getByText('No active participant currently seated at this desk')).toBeVisible()
    const waitingQueueList = page.locator('#operator-waiting-queue-list')
    await expect(waitingQueueList).toBeVisible()
    await expect(waitingQueueList).toContainText(citizenSessionId.slice(0, 8))
    await expect(waitingQueueList).toContainText('Citizen Amit Sharma')

    // 3. Operator starts service for this citizen
    const startPromise = page.waitForResponse(
      (resp) => resp.url().includes('/start') && resp.status() === 200
    )
    await page.click('#btn-operator-start')
    await startPromise

    // Active session is now displayed at desk with citizenSessionId
    await expect(page.locator('text=COUNTER ACTIVE: IN SERVICE')).toBeVisible()
    await expect(page.locator(`text=${citizenSessionId}`).first()).toBeVisible()

    // Verify DB reflects IN_SERVICE
    const inServiceDb = await (
      await request.get(`${BACKEND_URL}/api/v1/queue/${citizenSessionId}/status`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).json()
    expect(inServiceDb.session.status).toBe('IN_SERVICE')

    // 4. Operator completes service
    const completePromise = page.waitForResponse(
      (resp) => resp.url().includes('/complete') && resp.status() === 200
    )
    await page.click('#btn-operator-complete')
    await completePromise

    // Desk returns to idle
    await expect(page.getByText('No active participant currently seated at this desk')).toBeVisible()

    // Verify DB reflects COMPLETED
    const completedDb = await (
      await request.get(`${BACKEND_URL}/api/v1/queue/${citizenSessionId}/status`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
    ).json()
    expect(completedDb.session.status).toBe('COMPLETED')
  })
})
