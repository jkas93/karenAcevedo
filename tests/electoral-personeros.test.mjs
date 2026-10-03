import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHACLACAYO_ELECTORAL_LOCATIONS,
  CHACLACAYO_TOTAL_MESAS,
  googleMapsUrl,
} from '../src/lib/electoral/locations.ts';
import { validatePersoneroInput } from '../src/lib/validation/personero.ts';

test('la relación electoral contiene los 8 locales y 138 mesas entregados', () => {
  assert.equal(CHACLACAYO_ELECTORAL_LOCATIONS.length, 8);
  assert.equal(CHACLACAYO_TOTAL_MESAS, 138);
  assert.deepEqual(
    CHACLACAYO_ELECTORAL_LOCATIONS.map((local) => local.mesas),
    [16, 18, 16, 28, 16, 20, 16, 8],
  );
});

test('Florentino Prat conserva la dirección confirmada en la consulta electoral', () => {
  const florentino = CHACLACAYO_ELECTORAL_LOCATIONS.find((local) => local.code === '1192');
  assert.ok(florentino);
  assert.match(florentino.direccion, /Nicolás Ayllón 2032/);
  assert.match(googleMapsUrl(florentino.nombre, florentino.direccion), /^https:\/\/www\.google\.com\/maps\/search/);
});

test('normaliza un personero con datos completos', () => {
  assert.deepEqual(validatePersoneroInput({
    dni: ' 71260540 ',
    nombre_completo: '  Ana   Pérez Flores ',
    telefono: '987 654 321',
    local_id: 'local-1',
    mesa_numero: '041295',
  }), {
    dni: '71260540',
    nombre_completo: 'Ana Pérez Flores',
    telefono: '987654321',
    local_id: 'local-1',
    mesa_numero: '041295',
  });
});

test('permite registrar personero solo con DNI como único requisito indispensable', () => {
  assert.deepEqual(validatePersoneroInput({
    dni: ' 71260540 ',
  }), {
    dni: '71260540',
    nombre_completo: '',
    telefono: '',
    local_id: '',
    mesa_numero: '',
  });
});

test('rechaza DNI con menos de 8 dígitos', () => {
  assert.throws(
    () => validatePersoneroInput({ dni: '123' }),
    /El DNI debe tener 8 dígitos/
  );
});

test('rechaza celular mal formateado si se ingresa', () => {
  assert.throws(
    () => validatePersoneroInput({ dni: '71260540', telefono: '123456789' }),
    /El celular es opcional, pero si lo ingresas/
  );
});

test('permite registrar personero con sede fuera_chaclacayo', () => {
  const result = validatePersoneroInput({
    dni: '71260540',
    nombre_completo: 'Carlos Quispe',
    local_id: 'fuera_chaclacayo',
    mesa_numero: '012345',
  });
  assert.equal(result.local_id, 'fuera_chaclacayo');
  assert.equal(result.mesa_numero, '012345');
});
