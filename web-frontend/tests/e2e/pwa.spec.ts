import { expect, test } from '@playwright/test';

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
  await expect(page.getByText('You are offline')).toBeVisible();
});
