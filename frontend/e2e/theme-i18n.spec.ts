import { expect, test } from '@playwright/test'

test.describe('QueueLess Bharat — Platform-Wide Dark/Light Theme & Multilingual Foundation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test for predictable initial state
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
  })

  test('Test 1: Theme toggle switches to dark mode, applies .dark class, and persists in localStorage', async ({
    page,
  }) => {
    const themeBtn = page.locator('#btn-toggle-theme')
    await expect(themeBtn).toBeVisible()

    // Default state: light mode (no .dark on html)
    const htmlEl = page.locator('html')
    await expect(htmlEl).not.toHaveClass(/dark/)

    // Toggle to Dark Mode
    await themeBtn.click()
    await expect(htmlEl).toHaveClass(/dark/)
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark')

    // Verify localStorage persistence
    const storedTheme = await page.evaluate(() => localStorage.getItem('queless_theme'))
    expect(storedTheme).toBe('dark')

    // Reload page and verify dark theme is preserved
    await page.reload()
    await expect(htmlEl).toHaveClass(/dark/)
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark')

    // Toggle back to Light Mode
    await page.locator('#btn-toggle-theme').click()
    await expect(htmlEl).not.toHaveClass(/dark/)
    await expect(htmlEl).toHaveAttribute('data-theme', 'light')

    const storedThemeAfter = await page.evaluate(() => localStorage.getItem('queless_theme'))
    expect(storedThemeAfter).toBe('light')
  })

  test('Test 2: Multilingual switching to Hindi and Marathi translates civic UI and persists across reloads', async ({
    page,
  }) => {
    const langSelect = page.locator('#language-select')
    await expect(langSelect).toBeVisible()
    await expect(langSelect).toHaveValue('en')

    // Verify English UI text
    await expect(page.locator('h1')).toContainText('Predictable Waiting for Public Services Across India')
    await expect(page.locator('#btn-open-citizen-access')).toContainText('Citizen Access')
    await expect(page.locator('#simulation-notice-banner')).toContainText('SIMULATED DEMO DATA')

    // Switch to Hindi (hi)
    await langSelect.selectOption('hi')
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')

    // Verify Hindi civic headings and labels
    await expect(page.locator('h1')).toContainText('पूरे भारत में सार्वजनिक सेवाओं के लिए अनुमानित प्रतीक्षा')
    await expect(page.locator('#btn-open-citizen-access')).toContainText('नागरिक प्रवेश')
    await expect(page.locator('#simulation-notice-banner')).toContainText('सिम्युलेटेड डेमो डेटा')

    // Verify localStorage persistence
    const storedLangHi = await page.evaluate(() => localStorage.getItem('queless_language'))
    expect(storedLangHi).toBe('hi')

    // Reload and verify Hindi remains active
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await expect(page.locator('#language-select')).toHaveValue('hi')
    await expect(page.locator('h1')).toContainText('पूरे भारत में सार्वजनिक सेवाओं के लिए अनुमानित प्रतीक्षा')

    // Switch to Marathi (mr)
    await page.locator('#language-select').selectOption('mr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'mr')

    // Verify Marathi civic headings and labels
    await expect(page.locator('h1')).toContainText('संपूर्ण भारतात सार्वजनिक सेवांसाठी अंदाजित प्रतीक्षा')
    await expect(page.locator('#btn-open-citizen-access')).toContainText('नागरीक प्रवेश')
    await expect(page.locator('#simulation-notice-banner')).toContainText('सिम्युलेटेड डेमो डेटा')

    // Verify localStorage persistence
    const storedLangMr = await page.evaluate(() => localStorage.getItem('queless_language'))
    expect(storedLangMr).toBe('mr')

    // Switch back to English
    await page.locator('#language-select').selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.locator('h1')).toContainText('Predictable Waiting for Public Services Across India')
    await expect(page.locator('#btn-open-citizen-access')).toContainText('Citizen Access')
  })

  test('Test 3: Mobile viewport accommodates theme toggle and language dropdown cleanly', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    const themeBtn = page.locator('#btn-toggle-theme')
    const langSelect = page.locator('#language-select')

    await expect(themeBtn).toBeVisible()
    await expect(langSelect).toBeVisible()

    // Toggle theme on mobile
    await themeBtn.click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Switch to Hindi on mobile
    await langSelect.selectOption('hi')
    await expect(page.locator('h1')).toContainText('पूरे भारत में सार्वजनिक सेवाओं के लिए अनुमानित प्रतीक्षा')

    // Verify horizontal scrolling does not break mobile layout
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2) // Within 2px tolerance for layout scrollbar
  })

  test('Test 4: Switching theme or language does not reset user application state or selected city', async ({
    page,
  }) => {
    // 1. Select a non-default city (e.g. Mumbai)
    const citySelect = page.locator('#city-select')
    await citySelect.selectOption('Mumbai')
    await expect(citySelect).toHaveValue('Mumbai')

    // 2. Toggle theme to dark mode
    await page.locator('#btn-toggle-theme').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Verify selected city was not reset
    await expect(citySelect).toHaveValue('Mumbai')

    // 3. Switch language to Hindi
    await page.locator('#language-select').selectOption('hi')
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')

    // Verify selected city is still Mumbai
    await expect(citySelect).toHaveValue('Mumbai')

    // 4. Switch language to Marathi
    await page.locator('#language-select').selectOption('mr')
    await expect(page.locator('html')).toHaveAttribute('lang', 'mr')

    // Verify selected city is still Mumbai
    await expect(citySelect).toHaveValue('Mumbai')

    // 5. Toggle theme back to light
    await page.locator('#btn-toggle-theme').click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await expect(citySelect).toHaveValue('Mumbai')
  })
})
