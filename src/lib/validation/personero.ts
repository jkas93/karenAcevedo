export type PersoneroInput = {
  dni: string;
  nombre_completo?: string;
  telefono?: string;
  local_id?: string;
  mesa_numero?: string;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

export function validatePersoneroInput(value: unknown): Required<PersoneroInput> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Los datos del personero no son válidos.');
  }

  const data = value as Record<string, unknown>;
  const dni = clean(data.dni, 8).replace(/\D/g, '');
  const nombre_completo = clean(data.nombre_completo, 120);
  const telefono = clean(data.telefono, 20).replace(/\D/g, '');
  const local_id = clean(data.local_id, 128);
  const mesa_numero = clean(data.mesa_numero, 10).replace(/\D/g, '');

  if (!/^\d{8}$/.test(dni)) {
    throw new Error('El DNI debe tener 8 dígitos numéricos (es el único requisito indispensable para guardar).');
  }

  // El nombre es opcional.
  // El celular es opcional, pero si se ingresa debe tener 9 dígitos y empezar en 9.
  if (telefono && !/^9\d{8}$/.test(telefono)) {
    throw new Error('El celular es opcional, pero si lo ingresas debe tener 9 dígitos y comenzar con 9.');
  }

  // Colegio y mesa son opcionales y pueden completarse o editarse luego.

  return {
    dni,
    nombre_completo,
    telefono,
    local_id,
    mesa_numero,
  };
}
