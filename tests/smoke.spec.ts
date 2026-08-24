import { expect, test } from '@playwright/test'

test('loads the production shell and starts a solo hunt', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await expect(page).toHaveTitle(/Dawnfall Protocol/)
  await expect(page.getByTestId('entry-panel')).toBeVisible()
  await page.getByTestId('solo-button').click()
  await expect(page.getByText('CHOOSE YOUR HUNTER')).toBeVisible()
  await page.getByTestId('launch-button').click()
  await expect(page.getByTestId('game-shell')).toBeVisible()
  await expect(page.locator('#game-canvas')).toBeVisible()
  await page.mouse.move(1180, 450)
  await page.mouse.down()
  await page.waitForTimeout(550)
  await page.mouse.up()
  await expect(page.locator('#ammo-hud strong')).not.toHaveText('6 / 6')
  expect(pageErrors).toEqual([])
})
