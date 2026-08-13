import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ROLE_PERMISSIONS,
  SUPERUSER_EMAIL,
  effectiveRole,
  isAssignableRole,
  normalizePermissions,
  permissionForDashboardPath,
} from '../src/lib/access-control.ts';

test('el DNI canónico siempre obtiene Modo Dios', () => {
  assert.equal(effectiveRole(SUPERUSER_EMAIL, 'administrador'), 'superusuario');
  assert.equal(effectiveRole(SUPERUSER_EMAIL.toUpperCase(), 'usuario'), 'superusuario');
});

test('ninguna otra cuenta puede asumir el rol superusuario desde Firestore', () => {
  assert.equal(effectiveRole('70000000@fuerzaciudadana.pe', 'superusuario'), null);
  assert.equal(isAssignableRole('superusuario'), false);
  assert.equal(isAssignableRole('administrador'), true);
  assert.equal(isAssignableRole('equipo'), false);
});

test('Modo Dios conserva todos los permisos aunque reciba una matriz falsa', () => {
  const permissions = normalizePermissions('superusuario', {});
  assert.deepEqual(permissions, DEFAULT_ROLE_PERMISSIONS.superusuario);
  assert.equal(Object.values(permissions).every(Boolean), true);
});

test('una matriz inconsistente nunca concede administración sin lectura', () => {
  const inconsistent = normalizePermissions('usuario', {
    'agenda.view': false,
    'agenda.manage': true,
  });
  assert.equal(inconsistent['agenda.view'], false);
  assert.equal(inconsistent['agenda.manage'], false);

  const withoutView = normalizePermissions('administrador', {
    'agenda.view': false,
    'agenda.manage': false,
  });
  assert.equal(withoutView['agenda.view'], false);
  assert.equal(withoutView['agenda.manage'], false);
});

test('cada ruta del panel se asigna al permiso de lectura esperado', () => {
  assert.equal(permissionForDashboardPath('/dashboard/calendario'), 'calendar.view');
  assert.equal(permissionForDashboardPath('/dashboard/agenda'), 'agenda.view');
  assert.equal(permissionForDashboardPath('/dashboard/usuarios'), 'users.view');
  assert.equal(permissionForDashboardPath('/dashboard'), 'volunteers.view');
});
