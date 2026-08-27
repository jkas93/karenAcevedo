import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('las páginas públicas muestran accesos flotantes a TikTok y Facebook', async () => {
  const component = await readFile(new URL('../src/components/FloatingSocialButtons.tsx', import.meta.url), 'utf8');
  const publicLayout = await readFile(new URL('../src/app/(public)/layout.tsx', import.meta.url), 'utf8');
  const dashboardLayout = await readFile(new URL('../src/app/dashboard/layout.tsx', import.meta.url), 'utf8');

  assert.match(component, /https:\/\/www\.tiktok\.com\/@karenacevedo_chaclacayo/);
  assert.match(component, /https:\/\/www\.facebook\.com\/KarenAcevedoChaclacayo\//);
  assert.match(component, /bottom: 'max\(1rem, env\(safe-area-inset-bottom\)\)'/);
  assert.match(component, /right: 'max\(1rem, env\(safe-area-inset-right\)\)'/);
  assert.match(component, /backdrop-blur-xl/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener noreferrer"/);
  assert.match(publicLayout, /<FloatingSocialButtons \/>/);
  assert.doesNotMatch(dashboardLayout, /FloatingSocialButtons/);
});
