# Flujo de Autenticación, Redirección y Roles

Este documento detalla el mapa técnico y la arquitectura del sistema de login y control de accesos para la campaña de Karen Acevedo.

---

## 1. Diagrama de Flujo (Secuencia de Autenticación y Redirección)

El siguiente gráfico en formato **Mermaid** describe paso a paso cómo se autentica un usuario y cómo los Route Guards protegen y derivan cada vista.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario / Personero / Admin
    participant LP as Página de Login (/login)
    participant FA as Firebase Auth (Servicio)
    participant FS as Firestore (usuarios)
    participant DL as Dashboard Layout (/dashboard/*)
    participant PL as Personero Layout (/personero)

    U->>LP: Ingresa DNI y Contraseña
    Note over LP: Se genera correo ficticio:<br/>[DNI]@fuerzaciudadana.pe
    LP->>FA: signInWithEmailAndPassword(email, pass)
    alt Credenciales incorrectas
        FA-->>LP: Error de Auth
        LP-->>U: Muestra "Credenciales incorrectas"
    else Autenticación Exitosa
        FA-->>LP: Retorna User Credentials (UID)
        LP->>FS: getDoc("usuarios", email)
        FS-->>LP: Retorna rol ('personero', 'administrador', 'candidata', 'usuario')
        alt Rol: personero
            LP->>U: Redirige a /personero
        else Otro rol (admin, candidata, usuario)
            LP->>U: Redirige a /dashboard
        end
    end

    Note over U, PL: Si se intenta entrar directamente a una URL:
    
    rect rgb(240, 248, 255)
        Note over PL: Middleware de protección (/personero)
        PL->>FA: Escucha onAuthStateChanged()
        alt No logueado
            PL->>LP: Redirige a /login
        else Logueado
            PL->>FS: getDoc(usuarios, email)
            alt Rol != 'personero'
                PL->>DL: Redirige a /dashboard
            else Rol == 'personero'
                PL-->>U: Muestra Interfaz de Personero
            end
        end
    end

    rect rgb(255, 240, 245)
        Note over DL: Middleware de protección (/dashboard/*)
        DL->>FA: Escucha onAuthStateChanged()
        alt No logueado
            DL->>LP: Redirige a /login
        else Logueado
            DL->>FS: getDoc(usuarios, email)
            alt Rol == 'personero'
                DL->>PL: Redirige a /personero
            else Otro Rol (admin, candidata, usuario)
                DL-->>U: Muestra Sidebar + Módulos del Dashboard
            end
        end
    end
```

---

## 2. Mapa de Archivos Clave

1. **[`src/app/login/page.tsx`](file:///c:/Users/KEVIN%20AVALOS/Webs/karen/web-campana/src/app/login/page.tsx)**:
   * Convierte el DNI del formulario a un formato de correo sintético compatible con Firebase: `${dni}@fuerzaciudadana.pe`.
   * Realiza la llamada a `signInWithEmailAndPassword`.
   * Hace la consulta inicial del rol a Firestore y despacha la redirección inicial.
2. **[`src/app/dashboard/layout.tsx`](file:///c:/Users/KEVIN%20AVALOS/Webs/karen/web-campana/src/app/dashboard/layout.tsx)**:
   * Protege todas las sub-rutas `/dashboard/*`.
   * Expulsa a usuarios desautenticados hacia `/login`.
   * Expulsa a usuarios con rol `personero` hacia `/personero`.
3. **[`src/app/personero/layout.tsx`](file:///c:/Users/KEVIN%20AVALOS/Webs/karen/web-campana/src/app/personero/layout.tsx)**:
   * Protege la sub-ruta `/personero`.
   * Expulsa a usuarios desautenticados hacia `/login`.
   * Expulsa a usuarios con otros roles (admin/candidata/usuario) hacia `/dashboard`.
4. **[`src/lib/firebase/user-service.ts`](file:///c:/Users/KEVIN%20AVALOS/Webs/karen/web-campana/src/lib/firebase/user-service.ts)**:
   * Modifica y estandariza la creación de usuarios para que todos compartan la estructura de datos unificada en Firestore.

---

## 3. Matriz de Permisos (Role-Based Access Control)

| Rol | Ruta Destino | Permisos del Módulo |
| :--- | :--- | :--- |
| **Administrador** | `/dashboard` | Acceso completo (Voluntarios, Control Electoral, Personeros, Configuración, Gestión de Accesos). |
| **Candidata** | `/dashboard` | Acceso de supervisión (Lectura de Voluntarios, Control Electoral y Personeros). Sin permisos de edición de accesos. |
| **Usuario** | `/dashboard` | Acceso mínimo (Solo visualización de Voluntarios para llamadas). |
| **Personero** | `/personero` | Acceso a interfaz móvil (Ingresar resultados de su mesa asignada y capturar foto del acta). |
