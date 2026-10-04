export const ACTAS_ESPERADAS = 138;

export type ConteoDoble = {
  provincial: number | null;
  distrital: number | null;
};

export type ResultadoOrganizacion = ConteoDoble & {
  orden: number;
  organizacion: string;
  confianza?: number | null;
};

export type ExtraccionActa = {
  mesaNumero: string;
  departamento: string;
  provincia: string;
  distrito: string;
  electoresHabiles: number | null;
  resultados: ResultadoOrganizacion[];
  especiales: {
    blancos: ConteoDoble;
    nulos: ConteoDoble;
    impugnados: ConteoDoble;
  };
  totalesEmitidos: ConteoDoble;
  ciudadanosVotaron: number | null;
  observaciones: string;
  confianzaGeneral: number;
  advertencias: string[];
};

export type ActaFinalInput = ExtraccionActa & {
  draftId: string;
  localId: string;
};

const MAX_VOTOS = 2000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function nullableCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_VOTOS ? parsed : null;
}

function confidence(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
}

function pair(value: unknown): ConteoDoble {
  const source = record(value);
  return {
    provincial: nullableCount(source.provincial),
    distrital: nullableCount(source.distrital),
  };
}

export function normalizeMesaNumber(value: unknown): string {
  const digits = typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\D/g, '')
    : '';
  return digits.length >= 4 && digits.length <= 10 ? digits : '';
}

export function normalizeActaExtraction(value: unknown): ExtraccionActa {
  const source = record(value);
  const special = record(source.especiales);
  const rawResults = Array.isArray(source.resultados) ? source.resultados.slice(0, 40) : [];
  const resultados = rawResults.map((item, index) => {
    const result = record(item);
    return {
      orden: Number.isInteger(Number(result.orden)) ? Math.max(1, Number(result.orden)) : index + 1,
      organizacion: text(result.organizacion, 160) || `Organización ${index + 1}`,
      provincial: nullableCount(result.provincial),
      distrital: nullableCount(result.distrital),
      confianza: result.confianza === null || result.confianza === undefined
        ? null
        : confidence(result.confianza),
    };
  });

  return {
    mesaNumero: normalizeMesaNumber(source.mesaNumero),
    departamento: text(source.departamento, 80),
    provincia: text(source.provincia, 80),
    distrito: text(source.distrito, 80),
    electoresHabiles: nullableCount(source.electoresHabiles),
    resultados,
    especiales: {
      blancos: pair(special.blancos),
      nulos: pair(special.nulos),
      impugnados: pair(special.impugnados),
    },
    totalesEmitidos: pair(source.totalesEmitidos),
    ciudadanosVotaron: nullableCount(source.ciudadanosVotaron),
    observaciones: text(source.observaciones, 1000),
    confianzaGeneral: confidence(source.confianzaGeneral),
    advertencias: Array.isArray(source.advertencias)
      ? source.advertencias.map((item) => text(item, 240)).filter(Boolean).slice(0, 20)
      : [],
  };
}

function requiredCount(value: number | null, label: string, errors: string[]): number {
  if (!Number.isInteger(value) || value === null || value < 0 || value > MAX_VOTOS) {
    errors.push(`${label} debe ser un entero entre 0 y ${MAX_VOTOS}.`);
    return 0;
  }
  return value;
}

export function validateFinalActa(input: ExtraccionActa): {
  errors: string[];
  totalProvincial: number;
  totalDistrital: number;
} {
  const errors: string[] = [];
  if (!normalizeMesaNumber(input.mesaNumero)) errors.push('El número de mesa debe tener entre 4 y 10 dígitos.');
  if (input.resultados.length === 0) errors.push('El acta debe contener al menos una organización política.');

  const hasProvincial =
    input.totalesEmitidos.provincial !== null ||
    input.resultados.some((r) => r.provincial !== null) ||
    Object.values(input.especiales).some((e) => e.provincial !== null);

  let totalProvincial = 0;
  let totalDistrital = 0;
  input.resultados.forEach((result, index) => {
    if (!result.organizacion.trim()) errors.push(`Falta el nombre de la organización ${index + 1}.`);
    if (hasProvincial) {
      totalProvincial += requiredCount(result.provincial, `Voto provincial de ${result.organizacion || index + 1}`, errors);
    }
    totalDistrital += requiredCount(result.distrital, `Voto distrital de ${result.organizacion || index + 1}`, errors);
  });

  for (const [label, values] of Object.entries(input.especiales)) {
    if (hasProvincial) {
      totalProvincial += requiredCount(values.provincial, `${label} provinciales`, errors);
    }
    totalDistrital += requiredCount(values.distrital, `${label} distritales`, errors);
  }

  if (hasProvincial) {
    const declaredProvincial = requiredCount(input.totalesEmitidos.provincial, 'Total provincial', errors);
    if (declaredProvincial !== totalProvincial) {
      errors.push(`La suma provincial (${totalProvincial}) no coincide con el total declarado (${declaredProvincial}).`);
    }
  }

  const declaredDistrital = requiredCount(input.totalesEmitidos.distrital, 'Total distrital', errors);
  if (declaredDistrital !== totalDistrital) {
    errors.push(`La suma distrital (${totalDistrital}) no coincide con el total declarado (${declaredDistrital}).`);
  }

  if (input.ciudadanosVotaron !== null) {
    const citizens = requiredCount(input.ciudadanosVotaron, 'Total de ciudadanos que votaron', errors);
    if (declaredDistrital !== citizens) {
      errors.push('El total distrital debe coincidir con los ciudadanos que votaron.');
    }
    if (hasProvincial && totalProvincial !== citizens) {
      errors.push('El total provincial debe coincidir con los ciudadanos que votaron.');
    }
  }
  if (
    input.electoresHabiles !== null
    && input.ciudadanosVotaron !== null
    && input.ciudadanosVotaron > input.electoresHabiles
  ) {
    errors.push('Los ciudadanos que votaron no pueden superar a los electores hábiles.');
  }

  return { errors: [...new Set(errors)], totalProvincial, totalDistrital };
}

