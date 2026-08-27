import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('el jingle permite repetición automática y comienza con ella activada', async () => {
  const source = await readFile(new URL('../src/app/(public)/movimiento/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState\(true\)/);
  assert.match(source, /loop=\{loopEnabled\}/);
  assert.match(source, /aria-pressed=\{loopEnabled\}/);
  assert.match(source, /Repetición automática:/);
});

test('el kit digital enlaza el paquete de Sticker.ly y conserva descarga alternativa', async () => {
  const source = await readFile(new URL('../src/app/(public)/movimiento/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /https:\/\/sticker\.ly\/s\/5ZP3MN/);
  assert.match(source, /Agregar a WhatsApp/);
  assert.match(source, /stickers-karen-acevedo\.zip/);
  for (let index = 1; index <= 4; index += 1) {
    const name = `../public/stickers/karen-acevedo/sticker-${String(index).padStart(2, '0')}.webp`;
    const file = await readFile(new URL(name, import.meta.url));
    assert.ok(file.length > 0);
  }
});
