# Validación de la entrega — 10 de septiembre de 2026

## Resultado

47 pruebas aprobadas: 25 pruebas web/unitarias, 11 de integración con Firebase local, 7 del motor Kotlin y 4 instrumentadas en Android 14/API 34.

La web compila con `npm run build`; el módulo queda en `/dashboard/dispositivos` y la API en `/api/autoclicker/[...path]`. ESLint no reportó errores; siguen tres advertencias preexistentes de imports sin usar en Calendario.

Android compila con Gradle 8.14.5, AGP 8.13.2 y JDK 17. `assembleDebug`, `assembleDebugAndroidTest`, `testDebugUnitTest` y `lintDebug` completaron correctamente. Lint mantiene advertencias no bloqueantes sobre traducciones, versiones más recientes de dependencias y recomendaciones de APIs/KSP.

## APK

- Archivo: `../android-autoclicker/app/build/outputs/apk/debug/app-debug.apk` respecto de la raíz de `web-campana`.
- Tamaño: 3 995 680 bytes.
- SHA-256: `b9774aa66189dfb4b71978ac6444df1e5fc0501dd73a0d87266cb3749a0f6d98`.
- Compilación de desarrollo; servidor configurado: `https://karenacevedo.com`.

## Integración Firebase

Proyecto aislado `demo-karen-autoclicker`; Auth y Firestore emulados. Ninguna prueba escribió en la base de producción.

Se verificaron registro sin habilitar, denegación de Play, habilitación, suspensión durante sesión, códigos consumidos concurrentemente, regeneración/expiración, firma alterada/replay, permisos retirados, idempotencia, revocación permanente, cuotas concurrentes, lease vencido y renovación concurrente con revocación. Las reglas rechazaron lectura/escritura directa de dispositivos mediante un token de cliente.

Se corrigió la mezcla de cuotas administrativas: la verificación/canje de códigos tiene una cuota separada de consultas/ediciones.

## Android

Se creó el AVD aislado `Karen_AutoClicker_API_34`. Se instalaron los APK de app y pruebas y se ejecutó AndroidJUnitRunner mediante ADB. La tarea `connectedDebugAndroidTest` de Gradle encontró un fallo de red al descargar el runner UTP del host; se ejecutó el mismo APK instrumentado directamente con:

```powershell
adb -s emulator-5580 install -r app/build/outputs/apk/debug/app-debug.apk
adb -s emulator-5580 install -r app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb -s emulator-5580 shell am instrument -w -r pe.karen.autoclicker.test/androidx.test.runner.AndroidJUnitRunner
```

Resultado: `OK (4 tests)`. Registro conservado en `android-autoclicker/docs/android-instrumentation.txt` y captura de inicio en `android-autoclicker/docs/screenshots/android-inicio.png`.

Se verificaron arranque sin permiso remoto, firma Keystore, serialización/persistencia de secuencias y gestos reales de AccessibilityService con barra y animación. La prueba de gestos solo toca la pantalla interna de ensayo; su autorización de prueba se inyecta exclusivamente desde `androidTest` y no existe como bypass en el APK entregado. Se verificó que un gate cerrado no despacha gestos.

La prueba detectó y corrigió un marcador que podía seguir interceptando toques: WindowManager registra la ventana antes de que `View.isAttachedToWindow` sea verdadero. Ahora se retiran todas las ventanas registradas, incluso antes de su primer render.

El emulador se cerró al terminar. No se modificaron permisos de teléfonos físicos.

## Puesta en marcha pendiente

- Publicar el código web/API y configurar su secreto en el hosting.
- Desplegar/revisar índices y políticas TTL de Firestore junto con las reglas.
- Asignar permisos a los roles operativos desde la cuenta superusuario.
- Completar la prueba integrada con el APK y el backend desplegado, y validar overlays/gestos en un teléfono físico de los fabricantes previstos.
- Configurar firma de publicación y revisar requisitos de distribución si se publicará fuera de pruebas internas.

El secreto de vinculación local se generó en `.env.local`, está excluido de Git y no se imprimió. No se desplegó código ni se publicó un APK en una tienda.
