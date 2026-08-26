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
  await expect(page.locator('.portrait-art')).toHaveCount(12)
  await expect(page.locator('.portrait-art').first()).toHaveCSS('background-image', /hunter-portraits-v3\.webp/)
  await expect(page.locator('[data-character="cinder"] .portrait-art')).toHaveCSS('background-image', /cinder-portrait\.webp/)
  await expect(page.locator('[data-character="bastion"] .portrait-art')).toHaveCSS('background-image', /ama-portrait\.webp/)
  await expect(page.locator('[data-character="bastion"]')).toContainText('Ama')
  await expect(page.locator('[data-character="bastion"]')).toContainText('Ghanaian-English')
  await expect(page.locator('.weapon-art')).toHaveCount(10)
  await expect(page.locator('.map-card')).toHaveCount(3)
  await expect(page.locator('[data-map="reliquary"]')).toContainText('9 ROOMS')
  await expect(page.locator('[data-weapon="seeker"]')).toContainText('Nightjar')
  await expect(page.locator('[data-character="rapunsel"]')).toContainText('Rapsy')
  await expect(page.locator('[data-character="rapunsel"]')).not.toContainText('adult')
  await expect(page.locator('[data-character="warden"]')).toContainText('Aiko')
  await expect(page.locator('[data-character="warden"]')).toContainText('Japanese')
  await expect(page.locator('[data-character="vesper"] kbd')).toHaveText('ABILITY')
  await expect(page.locator('.difficulty-option')).toHaveCount(4)
  await page.locator('[data-difficulty="nightmare"]').click()
  await expect(page.locator('[data-difficulty="nightmare"]')).toHaveClass(/selected/)
  const initialCharacter = await page.locator('[data-character].selected').getAttribute('data-character')
  await page.getByTestId('random-character').click()
  await expect(page.locator('[data-character].selected')).not.toHaveAttribute('data-character', initialCharacter!)
  await page.locator('[data-character="vesper"]').click()
  await expect(page.locator('[data-character="vesper"]')).toHaveClass(/selected/)
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
  await expect(page.locator('#map-hud')).toContainText('Black Signal')
  await expect(page.getByTestId('player-hearts')).toBeVisible()
  await expect(page.locator('.player-hearts .heart-shell')).toHaveCount(5)
  await expect(page.locator('.team-hearts .heart-shell')).toHaveCount(5)
  await expect(page.locator('.regen-readout')).toContainText('REGEN')
  await page.mouse.move(1180, 450)
  await page.mouse.down()
  await page.waitForTimeout(550)
  await page.mouse.up()
  await expect(page.locator('#ammo-hud .weapon-readout strong')).toHaveText('∞')
  const loadedArt = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.includes('/art/')))
  expect(loadedArt).toEqual(expect.arrayContaining([
    expect.stringContaining('hero-night.webp'),
    expect.stringContaining('hunter-portraits-v3.webp'),
    expect.stringContaining('cinder-portrait.webp'),
    expect.stringContaining('armory-atlas-v2.webp'),
    expect.stringContaining('sword-dawncleaver.webp'),
    expect.stringContaining('companion-sprites-v1.webp'),
    expect.stringContaining('enemy-sprites.webp'),
    expect.stringContaining('structure-atlas-v2.webp'),
    expect.stringContaining('biome-textures-v1.webp'),
    expect.stringContaining('night-ground.webp'),
  ]))
  expect(failedRequests).toEqual([])
  expect(pageErrors).toEqual([])

  for (const art of ['upgrade-vesper-1.webp', 'upgrade-seraph-5.webp', 'upgrade-backdrop-1.webp', 'upgrade-rapunsel-5.webp', 'upgrade-cinder-1.webp', 'upgrade-cinder-2.webp', 'upgrade-cinder-3.webp', 'upgrade-cinder-4.webp', 'upgrade-cinder-5.webp', 'upgrade-bastion-1.webp', 'upgrade-bastion-2.webp', 'upgrade-bastion-3.webp', 'upgrade-bastion-4.webp', 'upgrade-bastion-5.webp', 'cinder-portrait.webp', 'ama-portrait.webp', 'rapunsel-portrait.webp', 'aiko-portrait.webp', 'eira-portrait.webp', 'mara-portrait.webp', 'zahra-portrait.webp', 'recap-victory-1.webp', 'recap-defeat-5.webp']) {
    expect((await page.request.get(`/art/${art}`)).ok()).toBe(true)
  }
})

test('keeps the illustrated interface usable on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /HOLD THE LINE/ })).toBeVisible()
  await expect(page.getByTestId('entry-panel')).toBeVisible()
  await page.getByTestId('solo-button').click()
  await expect(page.locator('.character-card')).toHaveCount(14)
  await expect(page.getByTestId('launch-button')).toBeVisible()
  await page.getByTestId('launch-button').click()
  await expect(page.locator('.touch-controls')).toBeAttached()
  await expect(page.locator('[data-touch-stick="move"]')).toBeAttached()
  await expect(page.locator('[data-touch-stick="aim"]')).toBeAttached()
})
