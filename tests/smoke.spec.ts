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
  await expect(page.locator('.portrait-art')).toHaveCount(8)
  await expect(page.locator('.portrait-art').first()).toHaveCSS('background-image', /hunter-portraits-v3\.webp/)
  await expect(page.locator('.weapon-art')).toHaveCount(10)
  await expect(page.locator('.map-card')).toHaveCount(3)
  await expect(page.locator('[data-map="reliquary"]')).toContainText('9 ROOMS')
  await expect(page.locator('[data-weapon="seeker"]')).toContainText('Nightjar')
  const initialCharacter = await page.locator('[data-character].selected').getAttribute('data-character')
  await page.getByTestId('random-character').click()
  await expect(page.locator('[data-character].selected')).not.toHaveAttribute('data-character', initialCharacter!)
  const initialWeapon = await page.locator('[data-weapon].selected').getAttribute('data-weapon')
  await page.getByTestId('random-weapon').click()
  await expect(page.locator('[data-weapon].selected')).not.toHaveAttribute('data-weapon', initialWeapon!)
  await page.locator('[data-weapon="sword"]').click()
  await expect(page.locator('[data-weapon="sword"]')).toHaveClass(/selected/)
  await expect(page.locator('[data-weapon="sword"] .weapon-art')).toHaveCSS('background-image', /sword-dawncleaver\.webp/)
  await page.locator('[data-map="reliquary"]').click()
  await expect(page.locator('[data-map="reliquary"]')).toHaveClass(/selected/)
  await page.getByTestId('launch-button').click()
  await expect(page.getByTestId('game-shell')).toBeVisible()
  await expect(page.locator('#game-canvas')).toBeVisible()
  await expect(page.locator('#map-hud')).toContainText('The Reliquary')
  await page.mouse.move(1180, 450)
  await page.mouse.down()
  await page.waitForTimeout(550)
  await page.mouse.up()
  await expect(page.locator('#ammo-hud strong')).toHaveText('∞')
  const loadedArt = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.includes('/art/')))
  expect(loadedArt).toEqual(expect.arrayContaining([
    expect.stringContaining('hero-night.webp'),
    expect.stringContaining('hunter-portraits-v3.webp'),
    expect.stringContaining('armory-atlas-v2.webp'),
    expect.stringContaining('sword-dawncleaver.webp'),
    expect.stringContaining('hunter-sprites-v3.webp'),
    expect.stringContaining('weapon-sprites-v1.webp'),
    expect.stringContaining('companion-sprites-v1.webp'),
    expect.stringContaining('enemy-sprites.webp'),
    expect.stringContaining('structure-atlas-v2.webp'),
    expect.stringContaining('biome-textures-v1.webp'),
    expect.stringContaining('night-ground.webp'),
  ]))
  expect(failedRequests).toEqual([])
  expect(pageErrors).toEqual([])

  for (const art of ['upgrade-vesper-1.webp', 'upgrade-seraph-5.webp', 'recap-victory-1.webp', 'recap-defeat-5.webp']) {
    expect((await page.request.get(`/art/${art}`)).ok()).toBe(true)
  }
})

test('keeps the illustrated interface usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /HOLD THE LINE/ })).toBeVisible()
  await expect(page.getByTestId('entry-panel')).toBeVisible()
  await page.getByTestId('solo-button').click()
  await expect(page.locator('.character-card')).toHaveCount(8)
  await expect(page.getByTestId('launch-button')).toBeVisible()
})
