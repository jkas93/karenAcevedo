# Karen Auto Clicker — instalación y operación

La solución tiene dos proyectos hermanos: `web-campana` (dashboard/API) y `android-autoclicker` (APK nativo). La app no es una PWA y requiere Android 8.0/API 26 o superior.

## Preparar el backend

1. Conservar la configuración Firebase Admin y Firebase Auth del proyecto web.
2. Ejecutar `node scripts/configure-autoclicker.mjs` desde `web-campana`. Genera `AUTOCLICKER_PAIRING_SECRET` en `.env.local` si falta, sin imprimirlo. Para producción, provisionar un secreto aleatorio de al menos 32 caracteres en el administrador de variables del hosting. Nunca usar `NEXT_PUBLIC_` para este secreto.
3. `AUTOCLICKER_TRUST_PROXY=true` se permite únicamente si el proxy de despliegue reemplaza `X-Forwarded-For`, impidiendo que un cliente lo elija. Por defecto se usa una cuota compartida conservadora para los endpoints móviles. Revisar los límites al ampliar el número de teléfonos.
4. Revisar y desplegar `firestore.rules` y `firestore.indexes.json` junto con el backend cuando se autorice la publicación. El índice compuesto permite combinar búsqueda y estado; los TTL limpian desafíos/códigos/cuotas expirados. La seguridad no depende de esa limpieza.
5. Compilar con `npm run build`. La API requiere runtime Node.js; no funciona como exportación estática.

Este trabajo no publica automáticamente la web, reglas ni APK. El APK configurado con el dominio público necesita que esta API y su secreto estén desplegados para vincularse.

## Primer dispositivo

1. Entrar en Karen como superusuario. En Gestión de Accesos, conceder los permisos del módulo a los roles que lo necesiten. Por defecto los demás roles no reciben acceso.
2. Instalar el APK y aceptar la explicación de automatización. La app genera una clave P-256 en Android Keystore y obtiene un código automáticamente al conectar.
3. Abrir **Dispositivos Auto Clicker → Vincular teléfono**, comprobar código/modelo y registrar propietario y alias. El código vence en diez minutos y queda consumido.
4. Abrir el equipo, escribir motivo y **Habilitar**; opcionalmente establecer vencimiento.
5. En Android, conceder superposición y accesibilidad mediante las pantallas oficiales del sistema. Abrir la barra, añadir/mover puntos, configurar y guardar la secuencia.
6. Pulsar Play en el teléfono. Para comprobar coordenadas, usar primero su pantalla de prueba.

**Suspender** bloquea nuevos inicios y renovaciones conservando la vinculación. **Revocar** invalida permanentemente esa identidad. La app ofrece restablecer la identidad revocada y obtener un código nuevo; el nuevo registro necesita otra habilitación. Una reinstalación o borrado de datos también exige registrar de nuevo. Revocar el equipo antiguo si fue sustituido.

## Permisos y estados

`devices.view` permite consultar dispositivos; `devices.manage` permite vincular/editar propietario; `devices.authorize` permite habilitar/suspender/revocar; `devices.audit` permite leer historial. Todas las capacidades dependen de view. Modificar la matriz continúa reservado al superusuario. La API consulta permisos actuales para cada operación.

Estados persistidos: disabled, enabled, suspended, revoked. Antes del registro, pending se deriva de una sesión de vinculación. La expiración se calcula a partir de la fecha, sin depender de un cron.

El estado administrativo y el estado reportado por el teléfono son distintos. Un registro enabled no significa que esté conectado. `lastSeenAt` indica la última sesión de ejecución que contactó, no una garantía de presencia en tiempo real. Después de suspender se muestra el vencimiento del último permiso emitido y se actualiza al consultar el detalle. Los vencimientos se muestran en Lima; el selector datetime-local toma la zona del navegador y envía un instante UTC.

## Protocolo implementado

El contrato está en `docs/autoclicker.openapi.json`. Se usan tres rutas POST: `/api/autoclicker/admin`, `/api/autoclicker/device/challenge` y `/api/autoclicker/device/command`. La ruta administrativa utiliza el mismo Bearer ID token Firebase del dashboard. La ruta móvil usa desafíos firmados para **cada** comando, sin guardar un token bearer duradero en el teléfono.

La app manda su clave pública DER/SPKI en Base64. El ID de instalación es SHA-256 hexadecimal del Base64 canónico de esa clave. El servidor solo acepta EC P-256. Devuelve un desafío con ID y nonce aleatorios, válido sesenta segundos. La firma ECDSA/SHA-256 en formato DER se realiza sobre los bytes UTF-8 de:

```text
karen-autoclicker-v1\n{challengeId}\n{nonce}\n{sha256(payload)}
```

Los `\n` representan saltos de línea reales. `payload` es exactamente la cadena JSON enviada dentro del envelope; no se vuelve a serializar para verificar. El servidor valida firma y vencimiento y consume el desafío de manera atómica con el comando. Los comandos son pair, status, start, renew y stop. Consultar el estado requiere la clave, nunca solo el código corto. Un dispositivo no puede consultar otro equipo porque su identidad procede del desafío.

El lease tiene un máximo de treinta segundos; Android lo renueva cada diez segundos mientras RUNNING. Android descuenta desde antes de solicitar el desafío el tiempo total de ambas peticiones, usando `elapsedRealtime`. Antes de cada gesto se comprueban autorización y permisos. Las esperas también verifican autorización. La pérdida de conectividad detectada detiene; una interrupción silenciosa queda limitada por el lease. Después de reconectar se requiere Play local y nueva autorización.

Habilitar no inicia la app ni toques remotamente. Una suspensión no puede entregar instantáneamente un mensaje a un teléfono desconectado. La app oficial no enviará nuevos gestos después de vencer el permiso vigente; un gesto ya enviado puede finalizar. Un APK alterado o equipo comprometido queda fuera de esa garantía. FCM y Play Integrity no forman parte de este MVP.

## Persistencia y concurrencia

Firestore contiene `autoClickerDevices`, `autoClickerPairings`, `autoClickerInstallations`, `autoClickerChallenges` y `autoClickerRateLimits`. La auditoría vive en `autoClickerDevices/{id}/audit`. Todas quedan protegidas por la denegación de acceso directo del cliente en las reglas; Firebase Admin aplica los permisos dentro de la API.

Los códigos se almacenan mediante HMAC con secreto de servidor. Un código solo corresponde a una instalación pendiente. La creación/regeneración y el canje usan transacciones. La habilitación usa control de versión y `operationId` idempotente, ligado al actor y contenido. La versión cambia al editar o autorizar; una sesión que encuentre otra versión debe detenerse y volver a iniciar. Las renovaciones verifican el estado y vencimiento actuales dentro de una transacción.

Room guarda secuencias locales con IDs estables, geometría y ajustes. DataStore guarda el consentimiento. La clave privada nunca sale de Keystore. Backup/transferencia de datos de app están deshabilitados. No se solicitan IMEI, teléfono, mensajes ni contactos.

No se escribe un registro por toque. Aproximadamente cada renovación implica 7 lecturas y 6 escrituras Firestore en condiciones sin reintentos (cuotas, desafío, dispositivo y sesión pendiente): a seis renovaciones/minuto son 42 lecturas y 36 escrituras por dispositivo/minuto, más inicio/fin, consultas de estado y administración. Evaluar este coste antes de escalar; los límites actuales de creación de desafíos son 30/minuto por clave y 240/minuto por origen IP para cada ruta móvil. La vinculación se limita a 5/10 minutos por clave. No compartir una IP de proxy no saneada entre una flota sin revisar las cuotas.

TTL: desafíos 60 s, códigos/sesiones pendientes 10 min, cuotas según ventana. Los equipos y su auditoría se conservan para trazabilidad; definir con el responsable de datos un plazo de retención antes de producción. No hay eliminación automática de historiales permanentes en este MVP.

## Verificar

```powershell
npm test
npm run lint
npm run build
npm run test:autoclicker:integration
```

La última orden requiere Firebase CLI y Java compatible. Usa exclusivamente el proyecto `demo-karen-autoclicker`, Auth en 9198 y Firestore en 8188. Las pruebas rechazan otros proyectos/hosts para no escribir en producción. Los usuarios y propietarios de ensayo se crean solo en los emuladores.

Pruebas de integración: registro sin habilitación, Play denegado, habilitación y suspensión, doble canje concurrente, expiración/regeneración, replay y firma alterada, permisos separados y retirada inmediata, idempotencia/versiones, identidad revocada, cuotas concurrentes y acceso directo Firestore denegado.

Para Android, consultar `../android-autoclicker/README.md`. La pantalla de prueba y las pruebas de emulador no sustituyen la comprobación en un teléfono físico de los fabricantes previstos.

## Alcance

Incluido: múltiples secuencias locales, toques múltiples, overrides de intervalos, bucle/duración/ciclos, variación acotada, animación, barra minimizable, detención local, registro/propietario/habilitación, roles, historial, contratos y pruebas.

Fuera de este MVP: gestos swipe o pulsación larga, inicios programados, editor gráfico de macros, sincronización de scripts, órdenes remotas de Play, attestation y push de revocación. No se afirma que la variación aleatoria evite detección. Antes de distribución pública revisar la declaración y política vigente de AccessibilityService.
