import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`Branded preloader runs once per session at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('.site-preloader')).toBeVisible();
    await expect(page.locator('.site-shell')).toHaveAttribute('inert');
    await page.screenshot({ path: `preview/preloader-${width}.png` });
    await expect(page.locator('.site-preloader')).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('.site-shell')).not.toHaveAttribute('inert');
    expect(await page.evaluate(() => sessionStorage.getItem('devoski:intro-seen'))).toBe('1');
    await expect.poll(() => page.locator('h1 .heading-line-inner').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
    if (width < 900) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'Services', exact: true }).click();
    await expect(page.locator('h1')).toContainText('Idea, Strategy');
    await expect(page.locator('.site-preloader')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('h1')).toContainText('Idea, Strategy');
    await expect(page.locator('.site-preloader')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).not.toBe('hidden');
  });
}

test('Intro can be skipped and reduced motion does not get trapped', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.locator('.site-preloader')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem('devoski:intro-seen'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.site-preloader')).toHaveCount(0);
  await expect(page.locator('.site-shell')).not.toHaveAttribute('inert');
  await expect(page.locator('#site-fluid')).toBeHidden();
});
