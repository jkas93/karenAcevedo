export const VOLUNTEER_HELP_OPTIONS = ['difusion', 'voluntariado', 'personero'] as const;

export type VolunteerSubmission = {
  nombre: string;
  telefono: string;
  dni: string;
  zona: string;
  ayuda: (typeof VOLUNTEER_HELP_OPTIONS)[number];
};

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateVolunteerSubmission(value: unknown): VolunteerSubmission {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Datos inválidos.');
  }

  const input = value as Record<string, unknown>;
  const nombre = text(input.nombre, 100);
  const telefono = text(input.telefono, 20);
  const dni = text(input.dni, 8);
  const zona = text(input.zona, 100);
  const ayuda = text(input.ayuda, 20);

  if (nombre.length < 2) throw new Error('Ingresa tu nombre y apellidos.');
  if (!/^\+?[0-9]{9,15}$/.test(telefono.replace(/[\s()-]/g, ''))) {
    throw new Error('Ingresa un número de celular válido.');
  }
  if (dni && !/^\d{8}$/.test(dni)) throw new Error('El DNI debe tener 8 dígitos.');
  if (!VOLUNTEER_HELP_OPTIONS.includes(ayuda as VolunteerSubmission['ayuda'])) {
    throw new Error('Selecciona una forma de apoyo válida.');
  }

  return {
    nombre,
    telefono,
    dni,
    zona,
    ayuda: ayuda as VolunteerSubmission['ayuda'],
  };
}
