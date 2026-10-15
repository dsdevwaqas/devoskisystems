import { test, expect } from '@playwright/test';

// Test-only widget double: never imported by the application or production build.
async function widget(page) {
  await page.route('https://www.google.com/recaptcha/api.js?onload=devoskiRecaptchaLoaded&render=explicit', route => route.fulfill({ contentType: 'text/javascript', body: `
    window.grecaptcha={
      render(el,opts){const b=document.createElement('button');b.type='button';b.textContent='Test verification';b.onclick=()=>opts.callback('test-token');el.replaceChildren(b);return 'test-widget'},
      reset(){}
    };window.devoskiRecaptchaLoaded();
  ` }));
}
async function fill(page) {
  await page.getByLabel('First name', { exact: false }).fill('Ali');
  await page.getByLabel('Last name', { exact: false }).fill('Khan');
  await page.getByLabel('Email', { exact: false }).first().fill('ali@example.com');
  await page.getByLabel('Your message', { exact: false }).fill('Please help me with a new website.');
  await page.getByRole('button', { name: 'Test verification', exact: true }).click();
}

test('Desktop and mobile retain design, fluid effect and routes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Big ideas.');
  await expect.poll(() => page.evaluate(() => Boolean(window.studioFluid))).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-smooth-scroll', 'locomotive');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Space Grotesk');
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Manrope');
  await expect.poll(() => page.locator('h1 .heading-line-inner').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'preview/react-desktop.png' });
  await page.mouse.wheel(0, 450);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await page.getByRole('navigation').getByRole('link', { name: 'Services', exact: true }).click();
  await expect(page.locator('h1')).toContainText('Idea, Strategy');
  await page.goto('/');
  await page.getByRole('link', { name: 'We support', exact: true }).click();
  await expect(page.locator('#we-support')).toBeInViewport();
  await page.goto('/web-design.html');
  await expect(page.locator('h1')).toHaveText('Web Design');
  expect(await page.locator('link[rel=canonical]').getAttribute('href')).toBe('https://devoskisystems.com/web-design/');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('html')).not.toHaveAttribute('data-smooth-scroll', 'locomotive');
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Big ideas.');
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation').getByRole('link', { name: 'Contact', exact: true }).click();
  await expect(page.locator('h1')).toContainText('digitally amazing');
  await expect.poll(() => page.locator('h1 .heading-line-inner').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'preview/react-contact-mobile.png' });
  expect(errors).toEqual([]);
});

test('Client validation blocks invalid fields before making a request', async ({ page }) => {
  await widget(page);
  let calls = 0;
  await page.route('**/api/contact.php', route => { calls++; return route.fulfill({ json: { ok: true } }); });
  await page.goto('/contact-us/');
  await page.getByRole('button', { name: 'Test verification', exact: true }).click();
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.locator('.field-error').first()).toContainText('required');
  expect(calls).toBe(0);
});

test('Loading state blocks duplicates; success is shown only after server confirms', async ({ page }) => {
  await widget(page);
  let calls = 0, resolve;
  const wait = new Promise(r => resolve = r);
  await page.route('**/api/contact.php', async route => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body.email).toBe('ali@example.com'); expect(body.recaptchaToken).toBe('test-token');
    await wait;
    await route.fulfill({ json: { ok: true, message: 'Your enquiry has been sent to our team.' } });
  });
  await page.goto('/contact-us/'); await fill(page);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  await page.locator('.enquiry-form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(calls).toBe(1);
  resolve();
  await expect(page.locator('.form-status.success')).toContainText('has been sent');
  await expect(page.getByRole('button', { name: 'Enquiry sent', exact: true })).toBeDisabled();
  await page.screenshot({ path: 'preview/react-form-success.png' });
});

test('Server errors and rate limits preserve visitor fields and reset verification', async ({ page }) => {
  await widget(page);
  await page.route('**/api/contact.php', route => route.fulfill({ status: 429, json: { ok: false, message: 'Too many attempts.', retryAfter: 30 } }));
  await page.goto('/contact-us/'); await fill(page);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.locator('.form-status.error')).toContainText('30 seconds');
  await expect(page.getByLabel('First name', { exact: false })).toHaveValue('Ali');
  await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeDisabled();
});

test('Ambiguous SMTP delivery cannot be resubmitted from the same form', async ({ page }) => {
  await widget(page);
  await page.route('**/api/contact.php', route => route.fulfill({ status: 502, json: { ok: false, code: 'delivery_unknown', message: 'Delivery could not be confirmed. Please contact us directly.' } }));
  await page.goto('/contact-us/'); await fill(page);
  await page.getByRole('button', { name: 'Send enquiry' }).click();
  await expect(page.locator('.form-status.error')).toContainText('could not be confirmed');
  await expect(page.getByRole('button', { name: 'Please contact us directly' })).toBeDisabled();
});

test('Reduced-motion preference uses the static fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Big ideas.');
  await expect(page.locator('#site-fluid')).toBeHidden();
  await expect(page.locator('html')).not.toHaveAttribute('data-smooth-scroll', 'locomotive');
  expect(await page.locator('h1 .heading-line-inner').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  expect(await page.evaluate(() => Boolean(window.studioFluid))).toBe(false);
});

test('Changing reduced-motion preference disables and restores smooth scrolling', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-smooth-scroll', 'locomotive');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).not.toHaveAttribute('data-smooth-scroll', 'locomotive');
  await expect.poll(() => page.locator('h1 .heading-line-inner').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-smooth-scroll', 'locomotive');
  expect(errors).toEqual([]);
});

for (const width of [1440, 390]) {
  test(`Fluid burst policy at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => Boolean(window.studioFluid))).toBe(true);
    await expect(page.locator('.site-preloader')).toHaveCount(0, { timeout: 8000 });
    await expect.poll(() => page.locator('h1 .heading-line-inner').first().evaluate(el => getComputedStyle(el).transform)).toBe('none');
    await expect(page.locator('.header-cta')).toHaveAttribute('href', 'tel:+923352110200');
    await page.evaluate(() => {
      window.testBursts = [];
      const original = window.studioFluid.burst;
      window.studioFluid.burst = strength => { window.testBursts.push(strength); original(strength); };
    });
    if (width < 900) await page.getByRole('button', { name: 'Toggle navigation' }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'Services', exact: true }).click();
    if (width > 900) {
      await page.waitForTimeout(5500);
      expect(await page.evaluate(() => window.testBursts)).toEqual([]);
      return;
    }
    await expect.poll(() => page.evaluate(() => window.testBursts.includes(0.65))).toBe(true);
    await expect.poll(() => page.evaluate(() => window.testBursts.includes(0.35)), { timeout: 8000 }).toBe(true);
    await page.evaluate(() => { window.studioFluid.setPaused(true); window.testBursts = []; });
    await page.waitForTimeout(5200);
    expect(await page.evaluate(() => window.testBursts.length)).toBe(0);
  });
}
