import { expect, test } from '@playwright/test'

test.describe('QueuelessBharat — City Fallback & Empty State Handling', () => {
  test('Test 1: Public Civic Explorer falls back to 20 demo cities when backend returns empty city list []', async ({
    page,
  }) => {
    // Intercept backend city list to return an empty array
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    await page.goto('/')

    // Step 1: City dropdown in IndiaDemoExplorer must fall back to the 20 demo cities
    const citySelect = page.locator('#city-select')
    await expect(citySelect).toBeVisible()

    const options = citySelect.locator('option')
    await expect(options).toHaveCount(20)

    // Verify key showcase cities are available in fallback
    await expect(citySelect.locator('option[value="Pune"]')).toBeAttached()
    await expect(citySelect.locator('option[value="Patna"]')).toBeAttached()
    await expect(citySelect.locator('option[value="Delhi"]')).toBeAttached()
  })

  test('Test 2: Public Civic Explorer merges backend registered cities when available', async ({
    page,
  }) => {
    // Intercept backend city list with specific registered cities
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['Patna', 'Lucknow']),
      })
    })

    await page.goto('/')

    const citySelect = page.locator('#city-select')
    await expect(citySelect).toBeVisible()

    // Explorer incorporates the registered cities into its catalog
    await expect(citySelect.locator('option[value="Patna"]')).toBeAttached()
    await expect(citySelect.locator('option[value="Lucknow"]')).toBeAttached()
  })

  test('Test 3: Admin Workspace truthfully displays 0 markets covered and disabled selector when backend cities list is []', async ({
    page,
  }) => {
    // Intercept backend city list as empty
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })

    // Mock Admin authentication profile
    const mockAdmin = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@queless.gov.in',
      full_name: 'Lead Admin Officer',
      role: 'ADMIN',
      is_active: true,
    }

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdmin),
      })
    })

    // Seed localStorage auth session before navigation
    await page.addInitScript((adminData) => {
      localStorage.setItem('queless_access_token', 'mock_admin_token')
      localStorage.setItem('queless_auth_user', JSON.stringify(adminData))
    }, mockAdmin)

    await page.goto('/')

    // Verify Admin Workspace is active
    const adminHeading = page.getByText(/Markets Covered/i)
    await expect(adminHeading).toBeVisible()

    // Verify Markets Covered KPI reflects 0 (not a fabricated 20)
    const kpiCard = adminHeading.locator('..')
    await expect(kpiCard).toContainText('0')
    await expect(kpiCard).not.toContainText('20')

    // Verify Facilities city selector in AdminWorkspace is disabled and displays placeholder
    const adminCitySelect = page.locator('select:has(option:text("No registered cities"))')
    await expect(adminCitySelect).toBeVisible()
    await expect(adminCitySelect).toBeDisabled()
  })

  test('Test 4: Admin Workspace displays exact registered city count and enabled selector when cities exist', async ({
    page,
  }) => {
    // Intercept backend city list with 2 registered cities
    await page.route('**/api/v1/locations/cities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['Pune', 'Patna']),
      })
    })

    const mockAdmin = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'admin@queless.gov.in',
      full_name: 'Lead Admin Officer',
      role: 'ADMIN',
      is_active: true,
    }

    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAdmin),
      })
    })

    await page.addInitScript((adminData) => {
      localStorage.setItem('queless_access_token', 'mock_admin_token')
      localStorage.setItem('queless_auth_user', JSON.stringify(adminData))
    }, mockAdmin)

    await page.goto('/')

    // Verify Markets Covered KPI reflects 2
    const adminHeading = page.getByText(/Markets Covered/i)
    await expect(adminHeading).toBeVisible()
    const kpiCard = adminHeading.locator('..')
    await expect(kpiCard).toContainText('2')

    // Verify Facilities city selector in AdminWorkspace is enabled and contains Pune and Patna
    const adminCitySelect = page.locator('select:has(option[value="Pune"])')
    await expect(adminCitySelect).toBeVisible()
    await expect(adminCitySelect).toBeEnabled()
    await expect(adminCitySelect.locator('option[value="Patna"]')).toBeAttached()
  })
})
