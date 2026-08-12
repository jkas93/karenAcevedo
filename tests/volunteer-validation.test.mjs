import assert from 'node:assert/strict';
import test from 'node:test';
import { validateVolunteerSubmission } from '../src/lib/validation/volunteer.ts';

test('normaliza un registro público válido', () => {
  assert.deepEqual(
    validateVolunteerSubmission({
      nombre: '  Ana Pérez  ',
      telefono: '999 888 777',
      dni: '71260540',
      zona: 'Centro',
      ayuda: 'voluntariado',
    }),
    {
      nombre: 'Ana Pérez',
      telefono: '999 888 777',
      dni: '71260540',
      zona: 'Centro',
      ayuda: 'voluntariado',
    },
  );
});

test('rechaza DNI, teléfono y modalidad inválidos', () => {
  assert.throws(() => validateVolunteerSubmission({
    nombre: 'Ana',
    telefono: '123',
    dni: '12',
    zona: '',
    ayuda: 'desconocida',
  }));
});

test('rechaza cuerpos que no sean objetos', () => {
  assert.throws(() => validateVolunteerSubmission(null));
  assert.throws(() => validateVolunteerSubmission([]));
});
