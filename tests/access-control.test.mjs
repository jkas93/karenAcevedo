import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_KEYS,
  SUPERUSER_EMAIL,
  defaultElectoralTab,
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
  assert.equal(isAssignableRole('coordinador'), true);
  assert.equal(isAssignableRole('equipo'), false);
});

test('coordinador solo accede a Control Electoral y abre Centros de Votación', () => {
  const permissions = normalizePermissions('coordinador', {});
  const enabled = PERMISSION_KEYS.filter((permission) => permissions[permission]);

  assert.deepEqual(enabled, ['electoral.view', 'electoral.manage']);
  assert.equal(defaultElectoralTab('coordinador'), 'colegios');
  assert.equal(defaultElectoralTab('administrador'), 'resumen');
});

test('Modo Dios conserva todos los permisos aunque reciba una matriz falsa', () => {
  const permissions = normalizePermissions('superusuario', {});
  assert.deepEqual(permissions, DEFAULT_ROLE_PERMISSIONS.superusuario);
  assert.equal(Object.values(permissions).every(Boolean), true);
});

test('una matriz inconsistente nunca concede administración sin lectura', () => {
  const inconsistent = normalizePermissions('usuario', {
    'electoral.view': false,
    'electoral.manage': true,
  });
  assert.equal(inconsistent['electoral.view'], false);
  assert.equal(inconsistent['electoral.manage'], false);

  const withoutView = normalizePermissions('administrador', {
    'electoral.view': false,
    'electoral.manage': false,
  });
  assert.equal(withoutView['electoral.view'], false);
  assert.equal(withoutView['electoral.manage'], false);
});

test('cada ruta del panel se asigna al permiso de lectura esperado', () => {
  assert.equal(permissionForDashboardPath('/dashboard/calendario'), 'calendar.view');
  assert.equal(permissionForDashboardPath('/dashboard/usuarios'), 'users.view');
  assert.equal(permissionForDashboardPath('/dashboard'), 'electoral.view');
});
