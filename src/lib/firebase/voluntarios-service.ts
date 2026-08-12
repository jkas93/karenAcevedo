import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Voluntario } from './types';

export const voluntariosService = {
  /**
   * Suscripción en tiempo real a la colección voluntarios,
   * ordenados por fecha descendente.
   */
  subscribe: (
    callback: (voluntarios: Voluntario[]) => void,
    onError?: (error: Error) => void
  ) => {
    const q = query(collection(db, 'voluntarios'), orderBy('fecha', 'desc'), limit(500));
    return onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Voluntario[];
        callback(data);
      },
      (error) => {
        console.error('Error en suscripción a voluntarios:', error);
        onError?.(error);
      }
    );
  },

  /** Actualizar el estado de contacto de un voluntario */
  actualizarEstado: async (id: string, nuevoEstado: string) => {
    const volRef = doc(db, 'voluntarios', id);
    await updateDoc(volRef, { estado: nuevoEstado });
  },

  /** Obtener todos los voluntarios (one-shot, para exportación) */
  getAll: async (): Promise<Voluntario[]> => {
    const snapshot = await getDocs(query(collection(db, 'voluntarios'), orderBy('fecha', 'desc'), limit(5000)));
    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Voluntario[];
  },

  /**
   * Exportar lista de voluntarios a CSV con BOM para compatibilidad Excel.
   * Función ÚNICA de exportación (elimina la duplicación entre Dashboard y Configuración).
   */
  exportarCSV: (voluntarios: Voluntario[], filename?: string) => {
    if (voluntarios.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const headers = [
      'Nombre',
      'DNI',
      'Teléfono',
      'Zona',
      'Tipo de Ayuda',
      'Estado',
      'Fecha Registro',
    ];

    const csvRows: string[] = [headers.join(',')];

    voluntarios.forEach((v) => {
      const fecha = v.fecha?.seconds
        ? new Date(v.fecha.seconds * 1000).toLocaleDateString('es-PE')
        : 'Reciente';

      const ayudaLabel: Record<string, string> = {
        difusion: 'Difusión Digital',
        voluntariado: 'Voluntariado en Calle',
        personero: 'Personero de Mesa',
      };

      csvRows.push(
        [
          `"${(v.nombre || '').replace(/"/g, '""')}"`,
          `"${v.dni || ''}"`,
          `"${v.telefono || ''}"`,
          `"${(v.zona || '').replace(/"/g, '""')}"`,
          `"${ayudaLabel[v.ayuda] || v.ayuda || ''}"`,
          `"${v.estado || 'pendiente'}"`,
          `"${fecha}"`,
        ].join(',')
      );
    });

    const csvString = csvRows.join('\n');
    // BOM (\uFEFF) para que Excel abra correctamente con tildes
    const blob = new Blob(['\uFEFF' + csvString], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download =
      filename ??
      `Voluntarios_KarenAcevedo_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
