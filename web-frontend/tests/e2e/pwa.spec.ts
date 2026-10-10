import { expect, type Page, test } from '@playwright/test';

test('the app is installable and works offline-first for its shell', async ({ request, page }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body = (await manifest.json()) as { display: string; start_url: string; icons: Array<{ purpose?: string; sizes: string }> };
  expect(body.display).toBe('standalone');
  expect(body.start_url).toBe('/');
  expect(body.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  expect(body.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

  const worker = await request.get('/sw.js');
  expect(worker.ok()).toBe(true);
  expect(worker.headers()['cache-control']).toContain('no-cache');

  await page.goto('/offline');
  await expect(page.getByText('You Are Offline')).toBeVisible();
});

const WORKER_CONTROL_TIMEOUT_MS = 10_000;
const NEXT_WORKER_URL = '/sw.js?v=e2e-next';

const workerControls = (page: Page) =>
  page.evaluate(
    (timeout) =>
      new Promise<boolean>((resolve) => {
        if (navigator.serviceWorker.controller) return resolve(true);
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), { once: true });
        setTimeout(() => resolve(false), timeout);
      }),
    WORKER_CONTROL_TIMEOUT_MS,
  );

const countLoads = (page: Page) => {
  const counter = { loads: 0 };
  page.on('load', () => {
    counter.loads += 1;
  });
  return counter;
};

test('the first visit is not reloaded when the offline worker takes control', async ({ page }) => {
  const counter = countLoads(page);
  await page.goto('/login');
  test.skip(!(await workerControls(page)), 'The offline worker registers only in production builds');
  await page.waitForLoadState('networkidle');
  expect(counter.loads).toBe(1);
  await page.getByLabel('Mobile Number').fill('9876543210');
  await expect(page.getByLabel('Mobile Number')).toHaveValue('98765 43210');
});

test('a new version of the offline worker is applied only when the user asks', async ({ page }) => {
  const counter = countLoads(page);
  await page.goto('/login');
  test.skip(!(await workerControls(page)), 'The offline worker registers only in production builds');
  await page.evaluate((url) => navigator.serviceWorker.register(url, { scope: '/', updateViaCache: 'none' }), NEXT_WORKER_URL);
  await expect(page.getByText('A new version of FundenFlo is ready.')).toBeVisible();
  expect(counter.loads).toBe(1);
  await page.getByRole('button', { name: 'Update', exact: true }).click();
  await expect.poll(() => counter.loads).toBe(2);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '')).toContain(NEXT_WORKER_URL);
});
