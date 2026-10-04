import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTAS_ESPERADAS,
  normalizeActaExtraction,
  normalizeMesaNumber,
  validateFinalActa,
} from '../src/lib/electoral/acta-schema.ts';

const validActa = {
  mesaNumero: '041295',
  departamento: 'Lima',
  provincia: 'Lima',
  distrito: 'Chaclacayo',
  electoresHabiles: 300,
  resultados: [
    { orden: 1, organizacion: 'Organización A', provincial: 80, distrital: 82 },
    { orden: 2, organizacion: 'Organización B', provincial: 100, distrital: 98 },
  ],
  especiales: {
    blancos: { provincial: 10, distrital: 10 },
    nulos: { provincial: 8, distrital: 8 },
    impugnados: { provincial: 2, distrital: 2 },
  },
  totalesEmitidos: { provincial: 200, distrital: 200 },
  ciudadanosVotaron: 200,
  observaciones: '',
  confianzaGeneral: 0.94,
  advertencias: [],
};

test('la elección se controla contra exactamente 138 actas', () => {
  assert.equal(ACTAS_ESPERADAS, 138);
});

test('normaliza el número de mesa y limita valores no confiables', () => {
  assert.equal(normalizeMesaNumber('Mesa N.° 041295'), '041295');
  assert.equal(normalizeMesaNumber('12'), '');

  const normalized = normalizeActaExtraction({
    ...validActa,
    mesaNumero: 'N° 041295',
    confianzaGeneral: 3,
    resultados: [{ organizacion: '  Partido   Uno ', provincial: '12', distrital: -1 }],
  });
  assert.equal(normalized.mesaNumero, '041295');
  assert.equal(normalized.confianzaGeneral, 1);
  assert.equal(normalized.resultados[0].organizacion, 'Partido Uno');
  assert.equal(normalized.resultados[0].provincial, 12);
  assert.equal(normalized.resultados[0].distrital, null);
});

test('acepta un acta cuyos totales cuadran en ambas elecciones', () => {
  const validation = validateFinalActa(validActa);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.totalProvincial, 200);
  assert.equal(validation.totalDistrital, 200);
});

test('impide guardar si las sumas o el padrón no cuadran', () => {
  const invalid = {
    ...validActa,
    electoresHabiles: 190,
    totalesEmitidos: { provincial: 199, distrital: 201 },
  };
  const validation = validateFinalActa(invalid);
  assert.equal(validation.errors.some((message) => message.includes('suma provincial')), true);
  assert.equal(validation.errors.some((message) => message.includes('suma distrital')), true);
  assert.equal(validation.errors.some((message) => message.includes('electores hábiles')), true);
});
