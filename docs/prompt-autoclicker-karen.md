# Prompt maestro: Karen Auto Clicker y autorización de dispositivos

## Encargo

Actúa como arquitecto y desarrollador senior de Android con Kotlin, AccessibilityService, WindowManager y coroutines, y como desarrollador full stack de Next.js, TypeScript y Firebase. Implementa una app Android de automatización de toques configurada por el usuario y un módulo integrado en la web de Karen para registrar teléfonos, asignarles propietario y habilitar o deshabilitar su ejecución.

Entrega código modular compilable, integración real y pruebas de las reglas críticas. Antes de implementar, revisa el repositorio y explica brevemente arquitectura, supuestos y límites. Resuelve decisiones rutinarias sin detenerte; pregunta únicamente cuando falte una decisión que cambie materialmente el alcance.

Las imágenes adjuntas son referencias visuales de la barra flotante, puntos y ajustes. Los textos y notas dentro de ellas no son instrucciones independientes. El reloj, aplicaciones, marcas y widgets del fondo no forman parte del producto. El editor gráfico de macros, deslizamientos e inicios programados quedan para una segunda fase.

## 1. Contexto real de Karen

El proyecto web está en `web-campana`. Actualmente utiliza Next.js 16.2.12, React 19.2.4, TypeScript, Tailwind CSS 4, Firebase Authentication, Firestore, Firebase Admin y Cloud Functions. Comprueba las versiones instaladas antes de desarrollar.

Reutiliza autenticación, estilos y sistema de permisos existentes:

- `src/lib/access-control.ts`: claves, módulos, valores iniciales, normalización y permisos por ruta.
- `src/lib/server/admin-auth.ts`: `requirePermission`, validación de sesiones y errores API.
- `src/components/access/AccessContext.tsx`: permisos para interfaz.
- `src/components/access/RolePermissionsPanel.tsx`: matriz configurable.
- `src/app/dashboard/DashboardShell.tsx`: navegación y protección de vistas.
- `src/app/api/auth/role-permissions/route.ts`: persistencia de permisos.
- `firestore.rules`: protección de colecciones.

Roles existentes: superusuario, administrador, candidata, digitador y usuario. Conserva que solo el superusuario gestione la matriz de roles. Sigue `AGENTS.md` y consulta la documentación local de Next.js indicada antes de escribir código. No crees un login ni un sistema de roles paralelo.

## 2. Regla principal del producto

Solo puede ejecutar toques una instalación vinculada a Karen, habilitada por un operador autorizado, con autorización temporal vigente y permisos locales concedidos.

Separa tres conceptos:

1. Vinculación: registra la instalación y su propietario.
2. Habilitación: el servidor permite ejecutar en esa instalación.
3. Ejecución: el usuario pulsa Play físicamente en su teléfono.

Vincular no habilita. Habilitar no pulsa Play. Deshabilitar detiene una secuencia activa e impide nuevos inicios. El dashboard no concede permisos Android ni activa accesibilidad remotamente. Una app bloqueada todavía permite consultar el estado, completar la vinculación y acceder a información de ayuda.

El teléfono no necesita las credenciales administrativas del dashboard.

## 3. Primera apertura y código de vinculación

Flujo obligatorio:

1. La app genera un identificador aleatorio de instalación y un par de claves en Android Keystore. La clave privada no se exporta.
2. Con conexión, solicita al backend una sesión de vinculación, enviando clave pública y metadatos mínimos del dispositivo.
3. El servidor genera criptográficamente un código de exactamente seis caracteres alfanuméricos en mayúsculas. Usa un alfabeto sin caracteres ambiguos, por ejemplo `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
4. Muestra automáticamente el código, su vencimiento, Copiar y Regenerar. Sin conexión, muestra que necesita internet; no inventes códigos locales que el servidor desconozca.
5. El operador introduce el código en Karen. Se presentan marca, modelo y versión Android; introduce nombre del propietario obligatorio y alias opcional.
6. Confirma la vinculación y se consume el código mediante transacción. La instalación queda VINCULADA_DESHABILITADA.
7. Una acción separada Habilitar permite autorizarla, con vencimiento opcional y observación.
8. La app detecta la vinculación consultando su sesión mediante una credencial opaca de alta entropía, nunca usando solamente el código corto.

El código es temporal, de un solo uso y no es contraseña, token de ejecución ni identificador permanente. Caduca a los diez minutos. Regenerar invalida el anterior. Impide que dos operadores consuman el mismo código y resuelve colisiones entre códigos vigentes de manera atómica.

Protege creación, consulta y canje contra enumeración y fuerza bruta mediante límites distribuidos por cuenta, IP e instalación. Guarda una representación HMAC del código con secreto de servidor; evita códigos y credenciales en logs. El control de vencimiento se hace al atender la solicitud; la limpieza TTL no sustituye esa validación.

Registra únicamente ID de instalación, huella de clave pública, marca, fabricante, modelo, versión Android, versión de app y datos de pantalla necesarios. Nombre del propietario es ingresado por el operador. No solicites IMEI, número telefónico, contactos ni ubicación.

La vinculación identifica una instalación mediante su clave, no garantiza identificar para siempre el hardware. Una reinstalación, borrado de datos o pérdida de clave exige una nueva vinculación. Excluye credenciales e identidad de las copias de seguridad. El reemplazo de un equipo requiere revocar el registro previo desde Karen.

## 4. Autorización y deshabilitación

El backend es la autoridad. No autorices mediante un booleano local, un código guardado o una respuesta almacenada indefinidamente.

Implementa autenticación del dispositivo con desafío de un solo uso firmado por su clave privada. Define mensajes canónicos, expiración de desafíos y consumo atómico para impedir replay. Emite credenciales breves ligadas a la instalación y verifica la posesión de clave al obtener o renovar permisos de ejecución. No incluyas secretos administrativos en el APK.

Antes de cada Play o Reanudar, solicita una autorización nueva al servidor. Propón como valores iniciales:

- Permiso temporal de ejecución —lease— de hasta 30 segundos.
- Renovación cada 10 segundos mientras exista una sesión activa.
- El lease nunca supera el vencimiento administrativo de la habilitación.
- Si llega una denegación o se detecta pérdida de conectividad, detén la ejecución.
- Si la conexión queda silenciosamente interrumpida, no despaches gestos después del vencimiento del lease.
- Al recuperar conexión no reanudes automáticamente: exige validación y Play local.

Usa reloj del servidor para vencimientos administrativos y reloj monotónico Android para medir la vigencia local. Vincula la respuesta a la solicitud y descuenta el tiempo transcurrido desde su envío; una respuesta retrasada no puede extender la autorización. Descarta leases al reiniciar el proceso o teléfono.

Cada deshabilitación o revocación incrementa `authorizationVersion`. La emisión/renovación verifica en transacción estado, versión y fecha de expiración; una renovación concurrente no debe saltarse una revocación. Un token de identidad vigente no permite omitir esas comprobaciones.

FCM puede acelerar el aviso de cambios, pero es opcional y no constituye la autoridad ni una garantía de entrega. El mecanismo de leases debe funcionar sin FCM. No uses WorkManager para una verificación de diez segundos.

Explica el límite real: una revocación no puede llegar instantáneamente a un teléfono incomunicado. En la app oficial, el compromiso verificable es no enviar nuevos gestos tras agotar el lease, con un máximo residual de 30 segundos desde la revocación si se acaba de emitir uno. Un gesto ya enviado podría finalizar. No prometas protección absoluta contra un APK modificado o un dispositivo comprometido; Play Integrity puede evaluarse como defensa adicional según el canal de distribución.

## 5. Estados y transiciones

Mantén estados administrativos separados de presencia y ejecución.

Administración: PENDIENTE_VINCULACION, VINCULADO_DESHABILITADO, HABILITADO, SUSPENDIDO, REVOCADO. EXPIRADO puede derivarse del vencimiento, incluso si no se ejecuta una tarea programada.

- Suspender conserva el registro y permite rehabilitarlo.
- Revocar invalida credenciales y exige nueva vinculación para volver a usarlo.
- Cambiar propietario no habilita ni reanuda automáticamente.

Ejecución local: IDLE, RUNNING, PAUSED, STOPPING, BLOCKED y ERROR.

Presencia: última comunicación y estado reportado con fecha. Un teléfono HABILITADO puede estar DESCONECTADO. El dashboard debe decir “estado reportado” o “sin confirmación reciente” cuando corresponda.

## 6. Módulo web y permisos

Crea `/dashboard/dispositivos` con el nombre “Dispositivos Auto Clicker”. Incluye resumen, buscador por propietario/alias/modelo, filtros por estado, tabla paginada, vinculación por código, detalle y auditoría.

Acciones: editar propietario/alias, habilitar con o sin vencimiento, suspender, rehabilitar y revocar con motivo. Conserva el historial de registros revocados. Distingue “deshabilitación registrada” de “detención confirmada por el dispositivo”.

Añade estos permisos a la matriz actual:

| Permiso | Capacidad |
| --- | --- |
| `devices.view` | Ver módulo, lista y detalle |
| `devices.manage` | Vincular y editar datos del propietario |
| `devices.authorize` | Habilitar, suspender y revocar |
| `devices.audit` | Consultar historial de acciones |

Por defecto, superusuario tiene todos; los demás roles no reciben los nuevos permisos hasta asignación explícita. Los registros de permisos antiguos deben normalizar las nuevas claves a false para esos roles. Activar cualquiera de las tres capacidades adicionales requiere `devices.view`; desactivar `devices.view` desactiva las dependientes.

La matriz actual está organizada en pares ver/gestionar: extiéndela para soportar acciones adicionales sin romper los módulos anteriores. No equipares gestionar propietarios con autorizar ejecución. Actualiza tipos, normalización, UI de la matriz, etiquetas, menú, protección de ruta y tests existentes.

Valida permisos actuales con `requirePermission` en cada endpoint administrativo. Ocultar botones no basta. Aplica los controles antes de consultar datos o mutarlos. Evita cachés que permitan seguir autorizando después de retirar el permiso a un rol.

## 7. Datos y API

Define tipos TypeScript/Kotlin y un contrato OpenAPI con cuerpos, respuestas, códigos de error, límites y autenticación.

Colecciones propuestas:

- `autoClickerPairings`: sesión, HMAC del código, clave pública, metadatos, vencimiento y consumo.
- `autoClickerDevices`: identidad pública, propietario, alias, estado, `authorizationVersion`, habilitación, vencimiento, fechas y actor.
- `autoClickerChallenges`: desafíos temporales y uso único.
- `autoClickerSessions`: sesión de ejecución, lease y último estado reportado.
- `autoClickerAudit`: actor, acción, dispositivo, motivo, cambio anterior/posterior y hora del servidor.
- Colección de límites distribuidos si el repositorio no tiene un componente reutilizable.

Separar la renovación de lease de las escrituras de presencia si se necesita reducir costes, manteniendo la verificación autoritativa en cada renovación. Estimar lecturas/escrituras por dispositivo y minuto. No registrar un documento de auditoría por toque.

Endpoints orientativos bajo `/api/autoclicker`:

- `POST /pairings`: iniciar vinculación con límites de abuso.
- `POST /pairings/status`: consultar la sesión con credencial secreta de sesión.
- `POST /devices/claim`: consumir código y registrar propietario; requiere `devices.manage`.
- `GET /devices` y `GET /devices/:id`: listado/detalle; requiere `devices.view`.
- `PATCH /devices/:id`: editar campos permitidos; requiere `devices.manage`.
- `POST /devices/:id/authorization`: cambiar habilitación; requiere `devices.authorize`.
- `GET /devices/:id/audit`: requiere `devices.audit`.
- `POST /device/challenge` y `POST /device/authenticate`: autenticar instalación mediante prueba de posesión.
- `POST /device/execution/start`, `/renew` y `/stop`: autorización y sesión del dispositivo.

Define también revocación y limpieza de credenciales. Un dispositivo solo puede consultar su propia información reducida y nunca listar teléfonos o modificar habilitación/propietario.

Todas las colecciones nuevas se acceden desde el backend con Firebase Admin y se bloquean para clientes directos en Firestore. Firebase Admin omite las reglas: la API debe aplicar los controles explícitamente. Usa transacciones para cambios de estado y auditoría consistente; idempotencia para operaciones repetibles; control de versión para ediciones concurrentes; timestamps de servidor y respuestas sin secretos. Define índices, paginación y retención de información.

## 8. App Android y arquitectura

Kotlin, coroutines, StateFlow, Room para secuencias y DataStore para preferencias. MVVM con capas de UI, dominio y datos. Usa Android Keystore para identidad. Propón minSdk 26 para utilizar directamente `TYPE_APPLICATION_OVERLAY`; selecciona compileSdk/targetSdk estables compatibles con el canal de distribución y documenta versiones exactas al implementar.

Componentes mínimos:

- `AutoClickService.kt`: ciclo de vida de accesibilidad y puerta de entrada controlada a gestos.
- `GestureDispatcher.kt`: adaptación suspendible de `dispatchGesture`.
- `OverlayManager.kt`: barra, puntos, arrastre, ventanas y limpieza.
- `ExecutionEngine.kt`: orden, tiempos, pausa, ciclos y cancelación.
- `AuthorizationRepository.kt` y `AuthorizationMonitor.kt`: estado remoto y vigencia.
- `DeviceIdentityManager.kt`, `DeviceRegistrationRepository.kt` y cliente API.
- Modelos `TapPoint`, `ScriptConfig`, `StopCondition`, `ExecutionState` y `DeviceAuthorization`.
- Persistencia Room, ViewModels, pantalla inicial y ajustes.

El motor depende de interfaces de gestos, reloj, autorización y aleatoriedad para poder probarse sin Android. La autorización se verifica también en la ruta final de despacho para que ninguna llamada alternativa evite el control.

Manifiesto: `INTERNET`, `ACCESS_NETWORK_STATE` y `SYSTEM_ALERT_WINDOW`. Declara `android.permission.BIND_ACCESSIBILITY_SERVICE` como protección del `<service>`, no como permiso de ejecución concedible al usuario. Añade intent-filter, metadata, exportación apropiada y `accessibility_service_config.xml` con `canPerformGestures=true`. No habilites lectura de contenido de ventanas si el MVP no la necesita.

Guía al usuario para conceder superposición y accesibilidad mediante ajustes del sistema. Comprueba nuevamente los permisos al volver y antes de iniciar. No intentes activarlos por código. Si añades un servicio foreground, justifica su necesidad, tipo y permisos frente al targetSdk elegido; no inventes un tipo ni asumas que evita las restricciones de Android.

## 9. Barra flotante y puntos

Barra lateral vertical, arrastrable y ajustada al área visible, con Play/Pause, Stop siempre accesible, Añadir, Eliminar último, Ajustes, Guardar y Minimizar. Guardar y minimizar son acciones diferenciadas. Minimizar conserva una burbuja recuperable con parada accesible; cerrar los controles por completo detiene antes la ejecución.

Puntos circulares numerados 1..N, con ID estable independiente de su posición. Añadir selecciona el nuevo punto. Eliminar en la barra quita el último; eliminar en el modal quita el seleccionado. Renumera sin reutilizar IDs. Permite reordenar desde ajustes.

Cada punto guarda el centro en píxeles de pantalla, posición normalizada y dimensiones/orientación de referencia. Distingue píxeles, dp, coordenadas de ventana y pantalla; contempla insets, barras del sistema y recortes. No escales silenciosamente una secuencia ante rotación: pausa y solicita revisión de posiciones. Para el MVP utiliza la pantalla principal.

Arrastre con umbral de movimiento, límites visibles y `rawX/rawY` convertidos correctamente a coordenadas del WindowManager. Bloquea edición y arrastre mientras RUNNING; usa una instantánea inmutable de la secuencia durante cada ejecución.

Crea y actualiza vistas en el hilo principal. Maneja pérdida de permiso, ventanas ya retiradas y destrucción del servicio sin fugas ni crashes.

Los marcadores no pueden interceptar los toques inyectados. En ejecución retira/oculta las ventanas de objetivos del área de toque y verifica que la barra no cubra ningún objetivo. No basta agregar `FLAG_NOT_TOUCHABLE`: Android 12+ restringe toques bajo overlays no confiables. Diseña la animación sin bloquear el siguiente gesto y valida el comportamiento en dispositivo real. No recurras a desactivar protecciones del sistema. Si propones `TYPE_ACCESSIBILITY_OVERLAY` como alternativa, documenta el cambio respecto al requisito principal y sus pruebas.

## 10. Modal de secuencia

Nombre obligatorio, lista/selector de puntos, añadir/eliminar/reordenar, intervalo global con override por punto y unidades milisegundos/segundos/minutos. Convierte a `Long` milisegundos con validación de formato, límites y overflow.

Define el intervalo como espera DESPUÉS de finalizar un gesto y ANTES de iniciar el siguiente. La duración del gesto es independiente. No prometas frecuencia exacta: el sistema añade latencia.

Valor inicial propuesto: 300 ms. Advierte al ingresar menos de 40 ms y, en el MVP, exige corregirlo a al menos 40 ms para ejecutar. El umbral es una decisión conservadora del producto, no una garantía del sistema operativo.

Condiciones excluyentes: infinito hasta Stop, duración H:M:S positiva o número entero positivo de ciclos. Un ciclo recorre todos los puntos una vez y solo se contabiliza cuando todos sus gestos finalizan satisfactoriamente. El temporizador mide tiempo activo; se congela durante Pause. Define explícitamente el contador mostrado y la precedencia de overrides.

Toggles: variación aleatoria, animación de toque y barra ligera. La variación, desactivada por defecto, permite amplitud temporal de 5–15 ms y espacial de 2–5 px con signo aleatorio. Recorta el resultado a intervalo mínimo y área válida. Preséntala como variación configurable, sin prometer invisibilidad ni evadir mecanismos de otras aplicaciones. No llames “antidetección garantizada” a esta función.

Cancelar descarta el borrador; Guardar valida y persiste. No permitas ejecutar sin puntos, con coordenadas inválidas o configuración incompleta.

## 11. Motor y gestos

Planifica con coroutines en `Dispatchers.Default`; ejecuta operaciones de ventanas y despacho en `Dispatchers.Main.immediate`; usa API suspendibles y evita trabajo bloqueante en Main. Un único Job de ejecución, exclusión mutua y transiciones serializadas impiden inicios simultáneos por pulsaciones rápidas.

Construye el toque con Path y GestureDescription, con duración corta positiva. Espera `GestureResultCallback.onCompleted` antes de continuar. Maneja retorno false, `onCancelled`, timeout y callbacks tardíos. Un true solo significa que se aceptó la solicitud, no que la aplicación destino realizó la acción esperada.

Usa `suspendCancellableCoroutine` sin reanudar dos veces. Cancelar la coroutine no garantiza retirar un gesto enviado al sistema; evita nuevos despachos y documenta ese límite. No solapes gestos ni reintentes automáticamente uno cuyo resultado es incierto.

Antes de cada gesto valida Job activo, estado RUNNING, permisos locales, lease vigente, geometría y tiempo restante. Valida las condiciones también durante esperas y entre puntos, no solo al acabar cada ciclo. Usa reloj monotónico y `delay` cancelable, nunca Thread.sleep, GlobalScope o espera ocupada.

Play inicia en punto 1. Pause impide nuevos despachos, espera la resolución del gesto activo y conserva el siguiente índice y espera restante. Reanudar valida autorización y continúa solo si el estado anterior quedó resuelto. Stop cancela planificación y reinicia progreso. Los contadores se actualizan solo por resultados válidos y los callbacks de ejecuciones anteriores se descartan por ID de ejecución.

Pantalla bloqueada/apagada, servicio desconectado, permisos retirados, autorización denegada, lease vencido o error de gesto deben impedir nuevos toques. Rotación pausa para revisar posiciones. Reinicio del proceso restaura scripts, nunca una ejecución activa. El botón Stop debe seguir respondiendo durante esperas largas y secuencias infinitas.

## 12. Pruebas y aceptación

Prueba de extremo a extremo principal: instalar → obtener código → vincular con propietario → comprobar que Play sigue bloqueado → habilitar desde un rol permitido → Play local → suspender desde dashboard → comprobar detención y bloqueo de reanudación.

Automatiza pruebas significativas de:

- Código expirado, colisión, regeneración, doble canje concurrente y límites de intentos.
- Acceso API sin sesión, con rol sin permiso o con permisos retirados; matriz antigua sin claves nuevas.
- Separación entre gestionar propietario y autorizar; reglas Firestore contra acceso directo.
- Vinculación que nunca habilita automáticamente; identidad copiada sin clave privada rechazada.
- Desafío reutilizado, lease vencido, respuesta retrasada y renovación concurrente con revocación.
- Corte de red, servidor inaccesible, cambio manual de hora y reinicio sin reanudar.
- Orden de puntos, ciclos, duración, pausa, cancelación en delay y Play repetido.
- Gesto rechazado/cancelado, timeout y callback tardío sin doble toque ni doble continuación.
- Jitter dentro de límites, números inválidos, overflow, rotación y borrado del punto seleccionado.

Realiza pruebas instrumentadas/manuales de permisos, overlays y toques en Android 12+ y en un teléfono real. La prueba con gestos debe utilizar una pantalla de ensayo que cuente toques y muestre sus coordenadas. No presentes una prueba unitaria como validación de WindowManager o de fabricantes específicos.

Ejecuta los checks web existentes y los del proyecto Android. Informa exactamente qué se ejecutó, qué pasó y qué quedó sin verificar por falta de SDK/emulador/teléfono. No afirmes compilación ni funcionamiento físico sin evidencia.

## 13. Entregables y secuencia de trabajo

Entrega en este orden:

1. Arquitectura, decisiones, diagrama de vinculación/autorización y estados.
2. Modelo de datos, contrato OpenAPI, controles de acceso y política de conexión.
3. Módulo web funcional integrado con permisos, API, auditoría y reglas.
4. Proyecto Android compilable con Gradle, Manifest, XML, servicio, overlays, motor, registro y persistencia.
5. Pruebas y guía para configurar backend, generar APK de prueba y vincular el primer teléfono.
6. Informe de verificación, límites conocidos y trabajo pendiente.

No entregues exclusivamente pantallas estáticas, pseudocódigo ni archivos Kotlin aislados sin dependencias. No uses mocks como integración final ni actives un bypass de autorización en builds distribuibles. Mantén los cambios ajenos del repositorio y no publiques despliegues o versiones de tienda sin autorización de publicación.

MVP: toques múltiples, secuencias locales, ajustes, permisos Android, vinculación, habilitación/revocación, roles y auditoría. Fase posterior: swipes, pulsación larga, editor gráfico, sincronización de scripts e inicio programado. La habilitación remota nunca debe convertirse implícitamente en ejecución remota.

Antes de distribuir, documenta el uso real de AccessibilityService, consentimiento y requisitos del canal elegido. Una app general de automatización no debe declararse herramienta de accesibilidad para discapacidad si no lo es. No prometas aprobación automática en Google Play.

## Referencias técnicas verificadas al preparar este encargo

- Android AccessibilityService y dispatchGesture: https://developer.android.com/reference/android/accessibilityservice/AccessibilityService
- Restricciones de overlays y toques en Android 12: https://developer.android.com/about/versions/12/behavior-changes-all#untrusted-touch-events
- Android Keystore: https://developer.android.com/privacy-and-security/keystore
- Política de uso de AccessibilityService en Google Play: https://support.google.com/googleplay/android-developer/answer/10964491

Revalida documentación y versiones al implementar. Los plazos de código, lease e intervalos indicados son decisiones propuestas de este producto, no requisitos oficiales de Android.
