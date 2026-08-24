import { expect, test } from '@playwright/test'

test('loads the production shell and starts a solo hunt', async ({ page }) => {
  const pageErrors: string[] = []
  const failedRequests: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('requestfailed', (request) => failedRequests.push(request.url()))
  await page.goto('/')
  await expect(page).toHaveTitle(/Dawnfall Protocol/)
  await expect(page.getByTestId('entry-panel')).toBeVisible()
  const heroArt = await page.locator('.hero-grid').evaluate((element) =>
    getComputedStyle(element, '::after').backgroundImage)
  expect(heroArt).toContain('hero-night.webp')
  await page.getByTestId('solo-button').click()
  await expect(page.getByText('CHOOSE YOUR HUNTER')).toBeVisible()
  await expect(page.locator('.portrait-art')).toHaveCount(4)
  await expect(page.locator('.portrait-art').first()).toHaveCSS('background-image', /hunter-portraits\.webp/)
  await expect(page.locator('.weapon-art')).toHaveCount(3)
  await page.getByTestId('launch-button').click()
  await expect(page.getByTestId('game-shell')).toBeVisible()
  await expect(page.locator('#game-canvas')).toBeVisible()
  await page.mouse.move(1180, 450)
  await page.mouse.down()
  await page.waitForTimeout(550)
  await page.mouse.up()
  await expect(page.locator('#ammo-hud strong')).not.toHaveText('6 / 6')
  const loadedArt = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.includes('/art/')))
  expect(loadedArt).toEqual(expect.arrayContaining([
    expect.stringContaining('hero-night.webp'),
    expect.stringContaining('hunter-portraits.webp'),
    expect.stringContaining('sprite-atlas.webp'),
    expect.stringContaining('structure-atlas.webp'),
    expect.stringContaining('night-ground.webp'),
  ]))
  expect(failedRequests).toEqual([])
  expect(pageErrors).toEqual([])
})

test('keeps the illustrated interface usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /HOLD THE LINE/ })).toBeVisible()
  await expect(page.getByTestId('entry-panel')).toBeVisible()
  await page.getByTestId('solo-button').click()
  await expect(page.locator('.character-card')).toHaveCount(4)
  await expect(page.getByTestId('launch-button')).toBeVisible()
})
