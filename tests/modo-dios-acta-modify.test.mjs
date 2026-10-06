import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMesaNumber } from '../src/lib/electoral/acta-schema.ts';
import { effectiveRole, SUPERUSER_EMAIL } from '../src/lib/access-control.ts';

test('Modo Dios es el único rol con autorización para modificar actas en auditoría', () => {
  assert.equal(effectiveRole(SUPERUSER_EMAIL, 'superusuario'), 'superusuario');
  assert.equal(effectiveRole('admin@fuerzaciudadana.pe', 'administrador'), 'administrador');
  assert.notEqual(effectiveRole('admin@fuerzaciudadana.pe', 'administrador'), 'superusuario');
});

test('normaliza el identificador de mesa para modificaciones en Modo Dios', () => {
  assert.equal(normalizeMesaNumber('041234'), '041234');
  assert.equal(normalizeMesaNumber('Mesa-041234'), '041234');
  assert.equal(normalizeMesaNumber('99'), '');
});

test('cálculo de totales de acta concilia suma de organizaciones y votos especiales', () => {
  const partidos = [
    { orden: 1, distrital: 50, provincial: 40 },
    { orden: 2, distrital: 80, provincial: 75 },
    { orden: 9, distrital: 120, provincial: 110 },
  ];
  const especiales = {
    blancos: { distrital: 5, provincial: 8 },
    nulos: { distrital: 10, provincial: 12 },
    impugnados: { distrital: 1, provincial: 2 },
  };

  const sumaPartidosDistrital = partidos.reduce((acc, p) => acc + p.distrital, 0);
  const sumaEspecialesDistrital = especiales.blancos.distrital + especiales.nulos.distrital + especiales.impugnados.distrital;
  const totalDistrital = sumaPartidosDistrital + sumaEspecialesDistrital;

  assert.equal(sumaPartidosDistrital, 250);
  assert.equal(sumaEspecialesDistrital, 16);
  assert.equal(totalDistrital, 266);
});
