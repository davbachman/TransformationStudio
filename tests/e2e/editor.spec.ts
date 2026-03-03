import { expect, test } from '@playwright/test';

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9WfY5QAAAABJRU5ErkJggg==',
  'base64',
);

test('core editor flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Transformation Studio')).toBeVisible();

  await page.getByRole('button', { name: 'Mirror' }).click();
  await expect(page.locator('.right-sidebar').getByText('Mirror')).toBeVisible();

  await page.getByRole('button', { name: 'Rotate' }).click();
  await expect(page.locator('.right-sidebar').getByText('Rotate')).toBeVisible();

  await page.setInputFiles('input[type="file"]', {
    name: 'tiny.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  });

  await expect(page.getByRole('button', { name: 'Upload Image' })).toBeVisible();

  await page.getByRole('button', { name: 'Square Grid' }).click();
  await page.getByRole('button', { name: 'Polar Grid' }).click();
});

test('camera source flow', async ({ page }) => {
  await page.addInitScript(() => {
    const installMock = () => {
      const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);

      mediaDevices.getUserMedia = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#2d7f1d';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        return canvas.captureStream(12);
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        value: mediaDevices,
        configurable: true,
      });
    };

    installMock();
  });

  await page.goto('/');

  await page.getByRole('button', { name: 'Use Camera' }).click();
  await expect(page.getByRole('button', { name: 'Stop Camera' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hide Source Camera' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Source Camera' })).toBeEnabled();

  await page.getByRole('button', { name: 'Hide Source Camera' }).click();
  await expect(page.getByRole('button', { name: 'Show Source Camera' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByRole('button', { name: 'Hide all' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Source Camera' }).click();
  await expect(page.getByRole('button', { name: 'Use Camera' })).toBeVisible();
});
