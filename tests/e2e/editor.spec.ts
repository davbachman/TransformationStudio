import { expect, test } from '@playwright/test';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9WfY5QAAAABJRU5ErkJggg==',
  'base64',
);

test('core editor flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Transformation Studio')).toBeVisible();

  await page.getByRole('button', { name: 'Mirror' }).click();
  await expect(page.locator('.right-sidebar').getByText('Mirror 1')).toBeVisible();

  await page.getByRole('button', { name: 'Rotate' }).click();
  await expect(page.locator('.right-sidebar').getByText('Rotate 1')).toBeVisible();

  await page.setInputFiles('input[type="file"]', {
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  });

  await expect(page.getByRole('button', { name: 'Upload Image' })).toBeVisible();

  await page.getByRole('button', { name: 'Square Grid' }).click();
  await page.getByRole('button', { name: 'Polar Grid' }).click();
});
