import { authenticatedPost } from './authenticated-request';

export interface FilaImportacionElectoral {
  mesa: string;
  local: string;
  direccion?: string;
  zona?: string;
  latitud?: number;
  longitud?: number;
}

type ElectoralDatabaseResponse = {
  success: boolean;
  locales: number;
  mesas: number;
};

export async function limpiarBaseElectoral() {
  return authenticatedPost<ElectoralDatabaseResponse>('/api/electoral/database', {
    action: 'clear',
  });
}

export async function seedColegiosChaclacayo() {
  return authenticatedPost<ElectoralDatabaseResponse>('/api/electoral/database', {
    action: 'seed',
  });
}

export async function importarBaseElectoralPersonalizada(
  filas: FilaImportacionElectoral[],
) {
  if (!filas.length) throw new Error('No hay filas para importar.');
  return authenticatedPost<ElectoralDatabaseResponse>('/api/electoral/database', {
    action: 'import',
    rows: filas,
  });
}
