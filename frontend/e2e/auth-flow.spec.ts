import { expect, test } from '@playwright/test'

const BACKEND_URL = 'http://localhost:8001'

let adminToken: string
let locationId: string

test.beforeAll(async ({ request }) => {
  // 1. Authenticate as Admin
  const loginResp = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
    data: {
      email: 'admin@queless.gov.in',
      password: 'AdminPass123!',
    },
  })
  expect(loginResp.status()).toBe(200)
  const loginData = await loginResp.json()
  adminToken = loginData.access_token
  expect(adminToken).toBeTruthy()

  // 2. Ensure base location exists
  const locResp = await request.post(`${BACKEND_URL}/api/v1/locations`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      name: 'AIIMS Central Hospital Bhopal',
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
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      location_id: locationId,
      name: `000-${name} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: 'M4 Auth & RBAC service track',
    },
  })
  const svc = await svcResp.json()

  const cntResp = await request.post(`${BACKEND_URL}/api/v1/counters`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      service_id: svc.id,
      name: 'Counter 1',
      status: 'active',
    },
  })
  const cnt = await cntResp.json()

  // Register dedicated operator assigned to this service for testing authorized counter actions
  const opEmail = `op.${svc.id.slice(0, 8)}@queless.gov.in`
  const opPass = 'OperatorPass123!'
  await request.post(`${BACKEND_URL}/api/v1/auth/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: opEmail,
      password: opPass,
      full_name: 'Desk Operator Rajesh',
      role: 'OPERATOR',
      assigned_service_id: svc.id,
    },
  })

  return { serviceId: svc.id, serviceName: svc.name, counterId: cnt.id, opEmail, opPass }
}

// Helper to login as citizen via staff password login for test speed
async function loginAsCitizenHelper(
  page: any,
  name = 'Citizen Amit Sharma',
  email = 'citizen@queless.gov.in'
) {
  await page.click('#btn-open-auth')
  await page.fill('#input-login-email', email)
  await page.fill('#input-login-password', 'CitizenPass123!')
  await page.click('#btn-submit-login')
  await expect(page.locator('#auth-user-badge')).toContainText(name)
  await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')
}

test.describe('QueuelessBharat — Milestone 4 & 6.2 Auth & RBAC Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('Scenario 1: Successful login displays identity and role in browser UI', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('#btn-open-auth')).toBeVisible()

    // Open staff login modal
    await page.click('#btn-open-auth')
    await page.fill('#input-login-email', 'citizen@queless.gov.in')
    await page.fill('#input-login-password', 'CitizenPass123!')
    await page.click('#btn-submit-login')

    // Verify UI reflects citizen identity and role
    await expect(page.locator('#auth-user-badge')).toContainText('Citizen Amit Sharma')
    await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')
    await expect(page.locator('#btn-logout')).toBeVisible()

    // Verify localStorage has access token
    const token = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    expect(token).toBeTruthy()
  })

  test('Scenario 1b: Google Citizen Sign-in provides verified token and retires legacy bypass', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    await expect(page.locator('#btn-open-citizen-access')).toBeVisible()

    // 1. Verify signed-out Token Desk state
    await expect(page.locator('#token-desk-signed-out')).toBeVisible()
    await expect(page.getByText('Verified Citizen Access Required')).toBeVisible()
    await expect(page.locator('#btn-desk-signin')).toBeVisible()

    // 2. Open citizen access modal
    await page.click('#btn-open-citizen-access')
    await expect(page.getByText('Verified Citizen Entry')).toBeVisible()
    await expect(page.locator('#btn-google-signin-fallback')).toBeVisible()

    // 3. Mock Google OAuth endpoint and trigger simulated Google sign-in
    await page.route('**/api/v1/auth/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-google-citizen-access-token',
          token_type: 'bearer',
          user: {
            id: '11111111-1111-1111-1111-111111111111',
            email: 'google.citizen@example.com',
            full_name: 'Google Citizen Verified',
            role: 'CITIZEN',
            is_active: true,
            assigned_service_id: null,
            created_at: new Date().toISOString(),
          },
        }),
      })
    })

    await page.evaluate(async () => {
      if (window.__queless_simulate_google_auth) {
        await window.__queless_simulate_google_auth('mock-google-id-token')
      }
    })

    // 4. Verify citizen identity and role in UI
    await expect(page.locator('#auth-user-badge')).toContainText('Google Citizen Verified')
    await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')
    await expect(page.locator('#desk-verified-identity')).toContainText('Google Citizen Verified')

    const token = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    expect(token).toBe('mock-google-citizen-access-token')

    // 5. Verify legacy citizen-access endpoint is permanently retired (HTTP 410)
    const retiredResp = await request.post(`${BACKEND_URL}/api/v1/auth/citizen-access`, {
      data: { full_name: 'Bypass Attempt', email: 'bypass@example.com' },
    })
    expect(retiredResp.status()).toBe(410)
  })

  test('Scenario 2: Invalid login credentials display browser-visible error', async ({
    page,
  }) => {
    await page.goto('/')
    await page.click('#btn-open-auth')

    await page.fill('#input-login-email', 'citizen@queless.gov.in')
    await page.fill('#input-login-password', 'WrongPassword123!')
    await page.click('#btn-submit-login')

    // Error banner should appear
    await expect(page.locator('#auth-error-msg')).toBeVisible()
    await expect(page.locator('#auth-error-msg')).toContainText('Invalid email or password')

    // User should remain unauthenticated
    await expect(page.locator('#auth-user-badge')).not.toBeVisible()
    const token = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    expect(token).toBeNull()
  })

  test('Scenario 3: Authenticated citizen joins queue with authenticated check-in', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'Citizen OPD Consultation')

    await page.goto('/')
    await loginAsCitizenHelper(page)

    // Select service and join queue
    await page.selectOption('#facility-service', { value: serviceId })

    const checkInPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/queue/check-in') && resp.status() === 201
    )
    await page.click('#btn-join-queue')

    const checkInResp = await checkInPromise
    const checkInData = await checkInResp.json()
    expect(checkInData.status).toBe('WAITING')

    // Verify ticket UI rendered
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
    await expect(page.locator(`text=${checkInData.id}`)).toBeVisible()
    await expect(page.locator('text=#1')).toBeVisible()
  })

  test('Scenario 4: Citizen is rejected with 403 Forbidden when calling operator actions', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'Citizen RBAC Guard')

    await page.goto('/')
    await loginAsCitizenHelper(page)

    await page.selectOption('#facility-service', { value: serviceId })
    await page.click('#btn-join-queue')
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    // Verify staff-only counter controls are not exposed to ordinary citizen accounts
    await expect(page.locator('#operator-role-indicator')).not.toBeVisible()
    await expect(page.locator('#btn-operator-start')).not.toBeVisible()
    await expect(page.locator('#btn-operator-complete')).not.toBeVisible()

    // Verify direct API call by Citizen is rejected with 403 Forbidden by backend RBAC
    const token = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    const sessionId = await page.evaluate(() => localStorage.getItem('queless_active_session_id'))
    const rbacResp = await request.post(`${BACKEND_URL}/api/v1/queue/${sessionId}/start`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(rbacResp.status()).toBe(403)
    const errBody = await rbacResp.json()
    expect(errBody.detail).toContain('lacks permission for this action')

    // Ticket status remains WAITING
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()
  })

  test('Scenario 5: Authenticated operator can call participant into service and complete', async ({
    page,
    request,
  }) => {
    const { serviceId, opEmail, opPass } = await setupIsolatedService(
      request,
      'Operator Workflow Desk'
    )

    // Step 1: Citizen creates a ticket
    await page.goto('/')
    await loginAsCitizenHelper(page)

    await page.selectOption('#facility-service', { value: serviceId })
    await page.click('#btn-join-queue')
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    const sessionId = await page.evaluate(() =>
      localStorage.getItem('queless_active_session_id')
    )
    expect(sessionId).toBeTruthy()

    // Step 2: Switch to Operator assigned to this service
    await page.click('#btn-logout')
    await expect(page.locator('#btn-open-auth')).toBeVisible()

    await page.click('#btn-open-auth')
    await page.fill('#input-login-email', opEmail)
    await page.fill('#input-login-password', opPass)
    await page.click('#btn-submit-login')

    await expect(page.locator('#auth-user-badge')).toContainText('Desk Operator Rajesh')
    await expect(page.locator('#auth-role-badge')).toHaveText('OPERATOR')

    // If in operator workspace, switch to citizen portal to operate on active ticket or use operator desk
    if (await page.locator('#tab-view-citizen').isVisible()) {
      await page.click('#tab-view-citizen')
    }

    await expect(page.locator('#operator-role-indicator')).toContainText('Authorized (OPERATOR)')

    // Step 3: Operator starts service (200 OK)
    const startPromise = page.waitForResponse(
      (resp) => resp.url().includes('/start') && resp.status() === 200
    )
    await page.click('#btn-operator-start')
    await startPromise

    await expect(page.getByText('NOW AT COUNTER (IN SERVICE)', { exact: true })).toBeVisible()

    // Step 4: Operator marks service completed (200 OK)
    const completePromise = page.waitForResponse(
      (resp) => resp.url().includes('/complete') && resp.status() === 200
    )
    await page.click('#btn-operator-complete')
    await completePromise

    await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible()
    await expect(page.locator('button:has-text("Take New Token")')).toBeVisible()
  })

  test('Scenario 6: Unauthorized resource access (BOLA/IDOR) is rejected', async ({
    page,
    request,
  }) => {
    const { serviceId } = await setupIsolatedService(request, 'IDOR BOLA Verification')

    // Citizen A joins queue and gets sessionId
    await page.goto('/')
    await loginAsCitizenHelper(page)

    await page.selectOption('#facility-service', { value: serviceId })
    await page.click('#btn-join-queue')
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    const sessionA = await page.evaluate(() =>
      localStorage.getItem('queless_active_session_id')
    )
    expect(sessionA).toBeTruthy()

    // Citizen A logs out
    await page.click('#btn-logout')
    await expect(page.locator('#btn-open-auth')).toBeVisible()

    // Register Citizen B
    const uniqueB = `citizen.b.${Date.now()}@example.com`
    await page.click('#btn-open-auth')
    await page.click('#tab-register')
    await page.fill('#input-register-name', 'Citizen B Non-Owner')
    await page.fill('#input-register-email', uniqueB)
    await page.fill('#input-register-password', 'CitizenBPass123!')
    await page.click('#btn-submit-register')

    await expect(page.locator('#auth-user-badge')).toContainText('Citizen B Non-Owner')

    // Citizen B attempts to access Citizen A's ticket session via localStorage injection
    await page.evaluate((sid) => {
      localStorage.setItem('queless_active_session_id', sid!)
    }, sessionA)

    const status403Promise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/v1/queue/${sessionA}/status`) && resp.status() === 403
    )
    await page.reload()
    const statusResp = await status403Promise
    const errBody = await statusResp.json()
    expect(errBody.detail).toContain('You are not authorized to view this queue session')

    // Verify UI handles the BOLA error gracefully without crash
    await expect(page.locator('#citizen-error-msg')).toBeVisible()
    await expect(page.locator('#citizen-error-msg')).toContainText(
      'You are not authorized to view this queue session'
    )
  })

  test('Scenario 7: Logout clears session and removes authenticated access', async ({
    page,
  }) => {
    await page.goto('/')
    await loginAsCitizenHelper(page)
    await expect(page.locator('#auth-user-badge')).toBeVisible()

    // Click logout
    await page.click('#btn-logout')

    // Badges disappear
    await expect(page.locator('#auth-user-badge')).not.toBeVisible()
    await expect(page.locator('#auth-role-badge')).not.toBeVisible()
    await expect(page.locator('#btn-open-auth')).toBeVisible()

    // LocalStorage keys removed
    const token = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    const user = await page.evaluate(() => localStorage.getItem('queless_auth_user'))
    expect(token).toBeNull()
    expect(user).toBeNull()
  })

  test('Scenario 8: Page refresh preserves auth state and identity from localStorage', async ({
    page,
  }) => {
    await page.goto('/')
    await loginAsCitizenHelper(page)
    await expect(page.locator('#auth-user-badge')).toContainText('Citizen Amit Sharma')
    await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')

    // Reload page
    await page.reload()

    // Verify auth persists across refresh
    await expect(page.locator('#auth-user-badge')).toContainText('Citizen Amit Sharma')
    await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')
    await expect(page.locator('#btn-logout')).toBeVisible()
  })

  test('Scenario 9: Corrupted or expired JWT token is cleared gracefully without app crash', async ({
    page,
  }) => {
    await page.goto('/')

    // Inject invalid JWT token into localStorage
    await page.evaluate(() => {
      localStorage.setItem('queless_access_token', 'invalid.corrupted.jwt.token')
      localStorage.setItem(
        'queless_auth_user',
        JSON.stringify({ full_name: 'Ghost User', role: 'CITIZEN' })
      )
    })

    // Reload page -> /me endpoint fails with 401
    await page.reload()

    // App should clear the bad token and show unauthenticated interface
    await expect(page.locator('#btn-open-auth')).toBeVisible()
    await expect(page.locator('#auth-user-badge')).not.toBeVisible()

    const token = await page.evaluate(() => localStorage.getItem('queless_access_token'))
    expect(token).toBeNull()
  })

  test('Scenario 10: Complete lifecycle from Join to Dismiss with authenticated role switching', async ({
    page,
    request,
  }) => {
    const { serviceId, opEmail, opPass } = await setupIsolatedService(
      request,
      'Full Flow Lifecycle'
    )

    // 1. Citizen joins
    await page.goto('/')
    await loginAsCitizenHelper(page)

    await page.selectOption('#facility-service', { value: serviceId })
    await page.click('#btn-join-queue')
    await expect(page.getByText('WAITING IN LINE', { exact: true })).toBeVisible()

    // 2. Switch to Operator assigned to this service
    await page.click('#btn-logout')
    await expect(page.locator('#btn-open-auth')).toBeVisible()

    await page.click('#btn-open-auth')
    await page.fill('#input-login-email', opEmail)
    await page.fill('#input-login-password', opPass)
    await page.click('#btn-submit-login')

    await expect(page.locator('#auth-user-badge')).toContainText('Desk Operator Rajesh')

    if (await page.locator('#tab-view-citizen').isVisible()) {
      await page.click('#tab-view-citizen')
    }

    await expect(page.locator('#operator-role-indicator')).toContainText('Authorized (OPERATOR)')

    // 3. Operator starts service
    await page.click('#btn-operator-start')
    await expect(page.getByText('NOW AT COUNTER (IN SERVICE)', { exact: true })).toBeVisible()

    // 4. Operator completes service
    await page.click('#btn-operator-complete')
    await expect(page.getByText('COMPLETED', { exact: true })).toBeVisible()

    // 5. Citizen takes new token (dismiss ticket)
    await page.click('button:has-text("Take New Token")')
    await expect(page.locator('#btn-join-queue')).toBeVisible()
  })

  test('Scenario 11: Stale session (404) auto-recovers cleanly and allows issuing a new token', async ({
    page,
  }) => {
    await page.goto('/')
    await loginAsCitizenHelper(page)

    // Inject a non-existent / stale session ID into localStorage
    const staleUUID = '00000000-0000-0000-0000-000000000000'
    await page.evaluate((sid) => {
      localStorage.setItem('queless_active_session_id', sid)
    }, staleUUID)

    // Reload page
    await page.reload()

    // Expect the recoverable notice banner to appear
    await expect(page.locator('#stale-session-notice')).toBeVisible()
    await expect(page.locator('#stale-session-notice')).toContainText(
      'Your previous queue session is no longer active'
    )

    // Token desk must be in clean 'Issue Digital Token' state
    await expect(page.locator('#btn-join-queue')).toBeVisible()
    await expect(page.locator('#btn-join-queue')).toBeEnabled()

    // Stale session ID must have been cleared from localStorage
    const storedSession = await page.evaluate(() =>
      localStorage.getItem('queless_active_session_id')
    )
    expect(storedSession).toBeNull()
  })

  test('Scenario 12: Citizen Access modal displays Configuration Required notice when Google Client ID is unconfigured', async ({
    page,
  }) => {
    // Intercept Google config to ensure unconfigured state
    await page.route('**/api/v1/auth/google/config', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: false, client_id: null }),
      })
    })

    await page.goto('/')
    await page.click('#btn-open-citizen-access')
    await expect(page.getByText('Google Sign-In Configuration Required')).toBeVisible()
    await expect(
      page.getByText('Google OAuth Client ID is not configured on this environment')
    ).toBeVisible()
  })

  test('Scenario 13: Citizen Access modal displays Configuration Required notice when Google config endpoint fails or is unavailable', async ({
    page,
  }) => {
    // Intercept Google config and simulate endpoint failure / 500 error
    await page.route('**/api/v1/auth/google/config', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Service Unavailable' }),
      })
    })

    await page.goto('/')
    await page.click('#btn-open-citizen-access')
    await expect(page.getByText('Google Sign-In Configuration Required')).toBeVisible()
    await expect(
      page.getByText('Google OAuth Client ID is not configured on this environment')
    ).toBeVisible()
  })

  test('Scenario 14: Direct URL route checking fails closed for unauthorized or deprecated workspaces', async ({
    page,
  }) => {
    // 1. Unauthenticated direct access to /#admin fails closed
    await page.goto('/#admin')
    const alert = page.locator('#route-access-notice')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Please sign in with an Administrator account')

    // 2. Direct access to /#operator shows operator workspace is deprecated
    await page.goto('/#operator')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Operator Workspace is not active in this release')

    // 3. Authenticate as Citizen and verify /#admin is still blocked
    await page.click('#btn-open-auth')
    await page.fill('#input-login-email', 'citizen@queless.gov.in')
    await page.fill('#input-login-password', 'CitizenPass123!')
    await page.click('#btn-submit-login')
    await expect(page.locator('#auth-role-badge')).toHaveText('CITIZEN')

    await page.goto('/#admin')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText('Administrator credentials required')

    // 4. Authenticate as Admin and verify Admin Workspace loads
    await page.click('#btn-logout')
    await page.click('#btn-open-auth')
    await page.fill('#input-login-email', 'admin@queless.gov.in')
    await page.fill('#input-login-password', 'AdminPass123!')
    await page.click('#btn-submit-login')
    await expect(page.locator('#auth-role-badge')).toHaveText('ADMIN')

    await page.goto('/#admin')
    await expect(page.getByRole('heading', { name: 'System Administrator Workspace' })).toBeVisible()
  })
})
