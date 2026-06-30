export type AppDetail = {
  name: string;
  icon: string;
  role: string;
  features: string[];
};

export type Ecosystem = {
  title: string;
  subtitle: string;
  apps: AppDetail[];
};

export type VSMDetail = {
  programa: string;
  actores: string;
  financiamiento: string;
  metas: string;
  ecosystem?: Ecosystem;
};

export type CardData = {
  id: string;
  title: string;
  icon: "Building2" | "Laptop" | "Users" | "Briefcase";
  shortDesc: string;
  detail: VSMDetail;
};

export type TabData = {
  id: string;
  label: string;
  title: string;
  description: string;
  cards: CardData[];
};

export const planData: Record<string, TabData> = {
  seguridad: {
    id: "seguridad",
    label: "🛡️ Seguridad Real",
    title: "Seguridad Ciudadana y Convivencia",
    description: "Menos del 40% de las cámaras actuales funcionan. Los tiempos de respuesta del serenazgo varían entre 18 y 25 minutos, con un ratio de solo 0.6 serenos por cada 1,000 habitantes. Transformaremos el sistema completo.",
    cards: [
      {
        id: "seg-a",
        title: "A. Infraestructura",
        icon: "Building2",
        shortDesc: "Iluminación LED en parques y paraderos de alto riesgo, recuperación de espacio público mediante diseño ambiental (CPTED), equipamiento y control de nodos inseguros.",
        detail: {
          programa: "Puestos de vigilancia rápida y recuperación de espacios públicos críticos mediante CPTED (Prevención del Delito mediante el Diseño Ambiental).",
          actores: "Desarrollo urbano, servicios a la ciudad, juntas vecinales y serenazgo coordinando el uso del espacio.",
          financiamiento: "Presupuesto participativo, IOARR (Inversiones de Optimización) y alianzas con empresas locales.",
          metas: "Reducción de puntos ciegos e iluminación de parques y paraderos identificados como de alto riesgo."
        }
      },
      {
        id: "seg-b",
        title: "B. Tecnología",
        icon: "Laptop",
        shortDesc: "Centro Web-C3, videovigilancia con IA no biométrica, lectura de placas (LPR), App de Botón de Pánico y patrullaje digital para respuesta en menos de 5 minutos.",
        detail: {
          programa: "Implementación del Centro Web-C3 con analítica de video no biométrica, lectura de placas (LPR) y App de Botón de Pánico. La etapa inicial prioriza analítica no biométrica respetando la Ley de Protección de Datos (Opinión Consultiva N.° 049-2025).",
          actores: "Policía Nacional del Perú (PNP), Serenazgo, Tecnologías de la Información y Operadores certificados.",
          financiamiento: "Obras por Impuestos y Recursos Directamente Recaudados priorizados en Seguridad.",
          metas: "Reducir el tiempo promedio de respuesta de 18–25 minutos a menos de 5 minutos en zonas priorizadas del distrito.",
          ecosystem: {
            title: "Ecosistema Tecnológico Listo",
            subtitle: "Arquitectura Cloud Firestore (Firebase) en Tiempo Real",
            apps: [
              {
                name: "VecinoChaclacayoSeguro",
                icon: "Smartphone",
                role: "App para Ciudadanos",
                features: ["Reportes (SOS, Sospecha, Médica)", "Ubicación GPS Exacta (GeoPoint)", "Envío de Audio Probatorio", "Rastreo del patrullero"]
              },
              {
                name: "Web-C3",
                icon: "Monitor",
                role: "Centro de Comando",
                features: ["Panel de Control en Tiempo Real", "Monitoreo del Distrito (Mapa)", "Fiscalización de intervenciones", "Actualización administrativa"]
              },
              {
                name: "PatrullajeChaclacayo",
                icon: "Car",
                role: "App para Serenazgo",
                features: ["Recepción de alertas (PENDIENTE)", "Auto-asignación de emergencia", "Estados (Despachada, En Sitio)", "Protocolo de Coacción"]
              }
            ]
          }
        }
      },
      {
        id: "seg-c",
        title: "C. Gobernanza",
        icon: "Users",
        shortDesc: "Reactivación operativa del CODISEC, conformación de nuevas juntas vecinales, rondas mixtas preventivas, consultas públicas y control social sobre la labor del serenazgo.",
        detail: {
          programa: "Plan de reactivación operativa del CODISEC, conformación de nuevas juntas vecinales y rondas mixtas preventivas.",
          actores: "Alcaldía, Juntas Vecinales, Comisaría de Chaclacayo, Subprefectura y organizaciones civiles.",
          financiamiento: "Recursos Ordinarios de la municipalidad y presupuestos de capacitación comunitaria.",
          metas: "Mayor cantidad de vecinos activos en programas preventivos y auditoría social del servicio de serenazgo."
        }
      },
      {
        id: "seg-d",
        title: "D. Financiamiento y Articulación",
        icon: "Briefcase",
        shortDesc: "Paquetes de inversión priorizados, convenios de mancomunidad, articulación directa con la PNP, Ministerio del Interior y aliados para sostener el sistema en el tiempo.",
        detail: {
          programa: "Estrategia de financiamiento multianual para renovación de flota, cámaras y uniformes. Articulación con PNP y mancomunidades de Lima Este.",
          actores: "Gerencia Municipal, Presupuesto, Ministerio del Interior, Cooperación Internacional y empresas del distrito.",
          financiamiento: "Transferencias del Ministerio del Interior, Obras por Impuestos, convenios de donación de equipos y programación multianual.",
          metas: "Asegurar la viabilidad económica del sistema sin desfinanciar a la municipalidad a largo plazo."
        }
      }
    ]
  },
  prevencion: {
    id: "prevencion",
    label: "🚧 Prevención y Riesgo",
    title: "Territorio Seguro y Resiliente",
    description: "6 quebradas críticas (Huascarán, Los Cóndores, Cusipata, La Floresta, Alfonso Cobián y Santa Inés) con ~14,500 vecinos expuestos. El cierre de la Carretera Central genera pérdidas de S/ 250,000 diarios.",
    cards: [
      {
        id: "prev-a",
        title: "A. Infraestructura",
        icon: "Building2",
        shortDesc: "Construcción programada por etapas de muros de contención, diques secos trapezoidales, barreras dinámicas, limpieza de fajas marginales y rutas de evacuación.",
        detail: {
          programa: "Cartera anual de intervenciones en puntos críticos de quebradas, rutas de evacuación y fajas marginales. Construcción por etapas de muros de contención, diques secos y barreras dinámicas.",
          actores: "Gestión de Riesgos, Desarrollo Urbano, Obras Públicas, cuadrillas operativas, comités vecinales y almacén de ayuda humanitaria.",
          financiamiento: "Recursos municipales, transferencias por gestión del riesgo, FONDES, cooperación internacional y programación multianual.",
          metas: "Reducir significativamente la exposición de familias en zonas de muy alta y alta vulnerabilidad en las 6 quebradas priorizadas."
        }
      },
      {
        id: "prev-b",
        title: "B. Tecnología",
        icon: "Laptop",
        shortDesc: "Catastro operativo de riesgo con georreferenciación, sistema de alerta temprana comunitaria 24/7, sensores y drones para monitoreo en tiempo real.",
        detail: {
          programa: "Catastro operativo de riesgo con georreferenciación de quebradas, laderas y rutas de evacuación. Sistema de Alerta Temprana Comunitaria con canales digitales y tableros de seguimiento.",
          actores: "Centro de Operaciones de Emergencia Local (COEL), Senamhi, INDECI, CENEPRED, catastro municipal.",
          financiamiento: "Recursos propios, cooperación técnica, apoyos a gobierno digital y convenios con universidades.",
          metas: "Mapa operativo de riesgo actualizado permanentemente. Aviso temprano garantizado ante activación de quebradas."
        }
      },
      {
        id: "prev-c",
        title: "C. Gobernanza",
        icon: "Users",
        shortDesc: "Simulacros focalizados por sectores, fortalecimiento de comités vecinales y brigadas comunitarias, vigilancia territorial y cultura preventiva permanente.",
        detail: {
          programa: "Brigadas Comunitarias de Prevención, simulacros calendarizados por zonas de mayor exposición, campañas de autoprotección y vigilancia territorial.",
          actores: "Vecinos de zonas altas (Huascarán, Cóndores, etc.), Bomberos B-115, Cruz Roja, centros educativos y promotores territoriales.",
          financiamiento: "Presupuesto participativo, incentivos municipales y cooperación.",
          metas: "Población capacitada capaz de auto-organizarse en los primeros 30 minutos de un desastre. Instalar la prevención como práctica cívica permanente."
        }
      },
      {
        id: "prev-d",
        title: "D. Financiamiento y Articulación",
        icon: "Briefcase",
        shortDesc: "IOARR, proyectos por etapas, mesa técnica con ANA, CENEPRED, INDECI, MVCS y Municipalidad de Lima. Postulación a cooperación y fondos especializados.",
        detail: {
          programa: "Cartera de Inversión de Cierre de Brechas de Riesgo. Mesa técnica permanente y convenios con entidades nacionales e internacionales.",
          actores: "Oficina de Inversiones (OPI), Alcaldía, ANA, CENEPRED, INDECI, MVCS, Municipalidad Metropolitana de Lima, Agencias de Cooperación.",
          financiamiento: "Cofinanciamiento con Gobierno Central, fondos climáticos globales, canon y transferencias.",
          metas: "Al menos 3 proyectos de gran envergadura financiados por entidades externas al distrito durante el periodo."
        }
      }
    ]
  },
  barrios: {
    id: "barrios",
    label: "🏥 Bienestar Comunitario",
    title: "Hábitat, Servicios y Bienestar Comunitario",
    description: "Anemia infantil del 22.6%, desnutrición crónica del 11%, deserción escolar cercana al 22.5%. El 90.6% tiene agua potable y 89.5% alcantarillado, pero las brechas en zonas altas persisten.",
    cards: [
      {
        id: "bar-a",
        title: "A. Infraestructura",
        icon: "Building2",
        shortDesc: "Escaleras seguras, parques modernos, accesibilidad universal, arborización constante y cobertura total de recolección de residuos sólidos en todo el distrito.",
        detail: {
          programa: "Intervenciones integrales barriales: escaleras seguras, parques modernos, veredas accesibles y cobertura total de recolección de residuos.",
          actores: "Servicios a la ciudad, maestranza, asociaciones vecinales y comités de obra.",
          financiamiento: "Recaudación predial y arbitrios (mejora de cobranza, hoy con morosidad del 54%), presupuesto participativo.",
          metas: "100% del distrito con cobertura de limpieza y eliminación de focos infecciosos."
        }
      },
      {
        id: "bar-b",
        title: "B. Tecnología",
        icon: "Laptop",
        shortDesc: "Plataforma Digital de Gestión Documental (Cero Papel), expediente electrónico, firma digital, notificación electrónica y App vecinal de reportes.",
        detail: {
          programa: "Plataforma Digital de Gestión Documental – Cero Papel: expediente electrónico, firma digital, notificación electrónica. Integración con pagos digitales, archivo y transparencia.",
          actores: "Atención al ciudadano, área de sistemas, PCM (Presidencia del Consejo de Ministros) y contribuyentes.",
          financiamiento: "Implementación progresiva con recursos directamente recaudados. Alineado al D.L. 1412 - Ley de Gobierno Digital.",
          metas: "Transición total a expediente electrónico y atención de reclamos vecinales en menos de 48 horas."
        }
      },
      {
        id: "bar-c",
        title: "C. Gobernanza",
        icon: "Users",
        shortDesc: "Enfoque de género, intergeneracional e inclusivo. Casa de la Mujer, programas de salud preventiva, nutrición infantil y lucha frontal contra la anemia (22.6%).",
        detail: {
          programa: "Plan frontal contra la anemia infantil (22.6%) y desnutrición crónica (11%). Fortalecimiento de la Casa de la Mujer, programas deportivos y atención a personas con discapacidad.",
          actores: "Gerencia de Desarrollo Social, MINSA (Red Integrada de Salud Chaclacayo, DIRIS Lima Este), Vaso de Leche, Comedores Populares, SIS.",
          financiamiento: "Transferencias de programas sociales, convenios con ONGs de salud y articulación con la Red de Salud.",
          metas: "Reducir el índice de anemia a la mitad en los primeros 2 años de gestión. Fortalecer la articulación territorial con los 41 establecimientos de salud."
        }
      },
      {
        id: "bar-d",
        title: "D. Financiamiento y Articulación",
        icon: "Briefcase",
        shortDesc: "Articulación con MINSA, Sedapal, Ministerio de Vivienda. Fondos concursables, convenios interinstitucionales y gestión de destrabe de obras de saneamiento.",
        detail: {
          programa: "Mesa intersectorial para destrabe de obras de agua y saneamiento con Sedapal y MVCS. Convenios activos para cierre de brechas.",
          actores: "Alcaldía como gestor principal ante Gobierno Central, empresas prestadoras de servicios y entidades sectoriales.",
          financiamiento: "Presupuestos nacionales (Ministerio de Vivienda), fondos concursables y cooperación.",
          metas: "Cierre de brechas de agua potable y alcantarillado en asentamientos y zonas altas. Ampliación progresiva de servicios."
        }
      }
    ]
  },
  economia: {
    id: "economia",
    label: "💼 Economía Local",
    title: "Economía Local y Centralidad Distrital",
    description: "Informalidad comercial del 62%, morosidad fiscal del 54% y una PET de 31,862 personas (37.1% jóvenes). La burocracia excesiva empuja al emprendedor a la informalidad.",
    cards: [
      {
        id: "eco-a",
        title: "A. Infraestructura",
        icon: "Building2",
        shortDesc: "Corredores gastronómicos ordenados, ecoferias, señalización turística, mejora de paraderos y veredas en zonas de alto flujo comercial.",
        detail: {
          programa: "Ordenamiento de corredores gastronómicos, ecoferias y mejora del entorno físico para atraer consumo local y turismo de cercanía.",
          actores: "Desarrollo Urbano, Promoción Económica, asociaciones de comerciantes y transporte local.",
          financiamiento: "Inversión de escala baja/media, alianzas con patrocinadores locales y presupuesto barrial.",
          metas: "Crear centralidades comerciales vibrantes que retengan el gasto local y atraigan visitantes de fin de semana."
        }
      },
      {
        id: "eco-b",
        title: "B. Tecnología",
        icon: "Laptop",
        shortDesc: "Ventanilla empresarial exprés, licencias en 24h, escuela de neuro-ventas y finanzas digitales, directorio digital de negocios de Chaclacayo.",
        detail: {
          programa: "Ventanilla Empresarial Exprés, emisión de licencias en 24h, escuela de habilidades comerciales y neuro-ventas con aliados académicos, y directorio digital de negocios.",
          actores: "Desarrollo Económico Local, emprendedores, Defensa Civil (ITSE ágil), universidades e institutos.",
          financiamiento: "Autofinanciado por formalización. Convenios con PRODUCE, universidades e institutos.",
          metas: "Reducir drásticamente la informalidad (62%) eliminando barreras burocráticas. Tiempo de licencia: 24 horas máximo."
        }
      },
      {
        id: "eco-c",
        title: "C. Gobernanza",
        icon: "Users",
        shortDesc: "Mesas económicas con comerciantes, mercados y mototaxis. Red de mentoría para mujeres y jóvenes emprendedores. Reglas claras, sin discrecionalidad.",
        detail: {
          programa: "Red de mentoría para mujeres y jóvenes emprendedores. Mesas de diálogo con gremios, mototaxis y mercados. Relación transparente con industrias bajo integridad pública.",
          actores: "Alcaldía, gremios de transporte y comercio, líderes empresariales, universidades.",
          financiamiento: "Convenios con universidades (estudiantes voluntarios), patrocinio local y alianzas educativas.",
          metas: "Reglas claras de fiscalización: la municipalidad debe promover, no perseguir. Incorporar mujer y juventud a la agenda económica."
        }
      },
      {
        id: "eco-d",
        title: "D. Financiamiento y Articulación",
        icon: "Briefcase",
        shortDesc: "Oficina de Promoción de la Inversión Local, Banco de Proyectos Municipal, Comité Pro Turismo y alianzas con PRODUCE y programas de empleabilidad.",
        detail: {
          programa: "Creación de la Oficina de Promoción de la Inversión y la Competitividad Local. Banco de Proyectos de Inversión Municipal. Comité Pro Turismo y Red Turística de Chaclacayo.",
          actores: "Gerencia Municipal, PRODUCE, universidades, institutos, programas de empleo y sector privado.",
          financiamiento: "Fondos concursables nacionales (ProInnóvate), cooperación, alianzas académicas y sector privado.",
          metas: "Incrementar inversión privada formal que genere empleos para jóvenes. Convenios de certificación y formación laboral."
        }
      }
    ]
  },
  ambiente: {
    id: "ambiente",
    label: "🌿 Ambiente y Limpieza",
    title: "Limpieza Pública, Áreas Verdes y Gestión Ambiental",
    description: "Cobertura de limpieza del 80% en zonas consolidadas y solo 65% en zonas alejadas. Más de 8,500 toneladas de residuos sólidos al año. El distrito llegó a tener 11.3 m² de áreas verdes por habitante.",
    cards: [
      {
        id: "amb-a",
        title: "A. Infraestructura",
        icon: "Building2",
        shortDesc: "Cobertura total de recolección de residuos, puntos limpios por barrio, renovación de contenedores, mantenimiento de áreas verdes y programa de arborización urbana.",
        detail: {
          programa: "Plan Integral de Gestión de Residuos: cobertura al 100%, contenedores diferenciados por barrio, puntos limpios y limpieza de quebradas para evitar acumulación de escombros.",
          actores: "Servicios a la Ciudad, maestranza, juntas vecinales, voluntarios ambientales y empresas prestadoras de servicios.",
          financiamiento: "Arbitrios de limpieza (mejora de cobranza, actual morosidad 54%), presupuesto participativo y alianzas público-privadas.",
          metas: "Llevar la cobertura de limpieza del 65-80% actual al 100% en todo el distrito, incluyendo zonas alejadas y de ladera."
        }
      },
      {
        id: "amb-b",
        title: "B. Tecnología",
        icon: "Laptop",
        shortDesc: "Georreferenciación de puntos críticos de acumulación, app vecinal para reportar focos, sensores en contenedores y rutas optimizadas de recolección.",
        detail: {
          programa: "Sistema digital de gestión de residuos: mapeo de puntos de acumulación, optimización de rutas de recolección y tablero de seguimiento para cuadrillas.",
          actores: "Área de Tecnologías de la Información, servicios de limpieza, catastro y contribuyentes.",
          financiamiento: "Recursos directamente recaudados e integración con la plataforma digital municipal (Cero Papel).",
          metas: "Eliminación de puntos ciegos de acumulación y respuesta a reportes vecinales en menos de 24 horas."
        }
      },
      {
        id: "amb-c",
        title: "C. Gobernanza",
        icon: "Users",
        shortDesc: "Brigadas ambientales vecinales, educación ambiental en escuelas, campañas de reciclaje y separación en origen, vigilancia ciudadana de espacios verdes.",
        detail: {
          programa: "Programa de educación ambiental en las 117 instituciones educativas (34 públicas + 83 privadas). Brigadas ambientales por barrio y campañas de reciclaje.",
          actores: "Gerencia de Desarrollo Social, centros educativos (UGEL 06), juntas vecinales y organizaciones ambientales.",
          financiamiento: "Presupuesto municipal y alianzas con ONGs ambientales.",
          metas: "Recuperar y superar los 11.3 m² de áreas verdes por habitante. Instalar cultura de reciclaje y separación en origen."
        }
      },
      {
        id: "amb-d",
        title: "D. Financiamiento y Articulación",
        icon: "Briefcase",
        shortDesc: "Articulación con MINAM y OEFA, convenios con empresas recicladoras, acceso a fondos ambientales y cooperación técnica para gestión de residuos.",
        detail: {
          programa: "Convenios con MINAM, OEFA y empresas especializadas en gestión de residuos. Postulación a fondos verdes y programas de economía circular.",
          actores: "Alcaldía, MINAM, OEFA, empresas recicladoras, cooperación internacional y sector privado.",
          financiamiento: "Fondos ambientales nacionales e internacionales, cooperación técnica y alianzas con el sector privado.",
          metas: "Gestión ambiental sostenible con ingresos propios por reciclaje y reducción de costos de disposición final."
        }
      }
    ]
  }
};
