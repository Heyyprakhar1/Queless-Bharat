import { expect, test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { resolveApiBaseUrl } from '../src/api/client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test.describe('API Routing & Base URL Configuration', () => {
  test('resolveApiBaseUrl defaults to empty string for same-origin proxying', () => {
    // 1. Empty string (default in Dockerfile) must resolve to ''
    expect(resolveApiBaseUrl('')).toBe('')

    // 2. Undefined must resolve to ''
    expect(resolveApiBaseUrl(undefined)).toBe('')

    // 3. Null must resolve to ''
    expect(resolveApiBaseUrl(null)).toBe('')

    // 4. Whitespace-only must resolve to ''
    expect(resolveApiBaseUrl('   ')).toBe('')

    // 5. Explicit base URL is preserved and trailing slash stripped
    expect(resolveApiBaseUrl('http://localhost:8001')).toBe('http://localhost:8001')
    expect(resolveApiBaseUrl('http://localhost:8001/')).toBe('http://localhost:8001')
    expect(resolveApiBaseUrl('https://api.queless.gov.in/')).toBe('https://api.queless.gov.in')
  })

  test('no frontend source files contain hardcoded localhost:8000', () => {
    const srcDir = path.resolve(__dirname, '../src')
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[]

    for (const file of files) {
      if (typeof file === 'string' && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
        const fullPath = path.join(srcDir, file)
        const content = fs.readFileSync(fullPath, 'utf-8')
        expect(
          content.includes('localhost:8000'),
          `File ${file} must not contain hardcoded localhost:8000`
        ).toBeFalsy()
      }
    }
  })

  test('browser network requests use relative /api/v1 paths without localhost:8000', async ({
    page,
  }) => {
    const apiRequests: string[] = []

    // Monitor all network requests originating from the page
    page.on('request', (req) => {
      const url = req.url()
      if (url.includes('/api/v1/')) {
        apiRequests.push(url)
      }
    })

    await page.goto('/')

    // Wait for health check to complete
    await expect(page.getByRole('heading', { name: 'Backend Health & Readiness' })).toBeVisible()
    await expect(page.getByText('PostgreSQL Database')).toBeVisible()
    await expect(page.getByText('Connected')).toBeVisible()

    // Verify API requests were made and intercepted
    expect(apiRequests.length).toBeGreaterThan(0)

    // Verify all API requests intercepted do NOT contain port 8000
    for (const reqUrl of apiRequests) {
      expect(reqUrl).not.toContain('localhost:8000')
      expect(reqUrl).not.toContain(':8000/')
    }
  })
})
