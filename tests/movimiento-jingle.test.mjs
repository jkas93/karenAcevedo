import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la playlist conserva el jingle y reproduce las cinco canciones en secuencia', async () => {
  const source = await readFile(new URL('../src/app/(public)/movimiento/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /useState\(true\)/);
  assert.match(source, /onEnded=\{handleTrackEnded\}/);
  assert.match(source, /aria-pressed=\{loopEnabled\}/);
  assert.match(source, /Lista en bucle:/);
  assert.match(source, /jingle-karen-acevedo-2027\.mp3/);

  const songs = [
    'gracias-por-su-carino.mp3',
    'los-jovenes-somos-el-cambio.mp3',
    'chaclacayo-el-verdadero-cambio.mp3',
    'un-chaclacayo-seguro.mp3',
  ];
  for (const song of songs) {
    assert.match(source, new RegExp(song.replace('.', '\\.')));
    const file = await readFile(new URL(`../public/audio/${song}`, import.meta.url));
    assert.ok(file.length > 0);
    assert.equal(file.subarray(0, 3).toString('ascii'), 'ID3');
  }

  assert.ok(source.indexOf("title: 'Jingle oficial'") < source.indexOf("title: 'Gracias por su cariño'"));
  assert.ok(source.indexOf("title: 'Gracias por su cariño'") < source.indexOf("title: 'Los jóvenes somos el cambio'"));
});

test('el reproductor aparece antes que el Kit Digital', async () => {
  const source = await readFile(new URL('../src/app/(public)/movimiento/page.tsx', import.meta.url), 'utf8');
  assert.ok(source.indexOf('id="playlist-heading"') < source.indexOf('id="kit-digital-heading"'));
});

test('movimiento ya no carga ni muestra la agenda pública', async () => {
  const source = await readFile(new URL('../src/app/(public)/movimiento/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /agendaService|ActividadAgenda|Agenda de Actividades/);
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
