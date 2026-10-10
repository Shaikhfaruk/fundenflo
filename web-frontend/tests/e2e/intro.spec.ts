import { expect, test } from '@playwright/test';

test('first visit shows the splash and intro slides, then sign in; later visits go straight to sign in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('A Clearer Path To Capital.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /Your Next Chapter/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /The Right Fit/ })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: /Less Uncertainty/ })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s Get Started' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /Know Who Can Fund You/ })).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
