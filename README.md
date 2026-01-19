# Club Reino Ajedrez - Backend ♟️

Backend oficial del **Club Reino Ajedrez**, diseñado para gestionar una escuela de ajedrez online. Incluye gestión de cursos, alumnos, problemas tácticos diarios, clases en vivo e integración con Discord.

---

## 🚀 Tecnologías Principales

- **Runtime**: [Node.js](https://nodejs.org/) con **TypeScript**.
- **Framework**: [Express.js](https://expressjs.com/).
- **Base de Datos**: [LibSQL](https://turso.tech/libsql) (compatible con SQLite).
- **Comunicación**: [Socket.io](https://socket.io/) para interacciones en tiempo real.
- **Validación**: [Zod](https://zod.dev/) para esquemas de datos.
- **Seguridad**: JWT (JSON Web Tokens) y Bcrypt.js.
- **Automatización**: Node-cron para tareas programadas.

---

## ✨ Características Principales

### 🔓 Autenticación y Usuarios
- Sistema de roles: `student`, `teacher`, `admin`.
- Registro e inicio de sesión seguro.
- Perfil de usuario con estadísticas de juego y cálculo de ELO dinámico.

### 📚 Cursos y Lecciones
- Gestión de contenido educativo en formato Markdown.
- Seguimiento de progreso por lección mediante la tabla `user_lesson_progress`.
- Inscripción de alumnos en cursos específicos.

### 🧩 Sistema de Puzzles
- **Base de Datos Táctica**: Soporta miles de posiciones FEN.
- **Cálculo de ELO**: Implementación de fórmulas probabilísticas para ajustar el ranking del alumno al resolver puzzles.
- **Problema del Día**: Generación automática de un reto diario mediante cron jobs (diario a las 00:00).
- **Importación CSV**: Soporta el formato estándar de bases de datos de puzzles de Lichess.

### 🌓 Clases en Vivo & WebSockets
- **Sincronización en Tiempo Real**: Tablero compartido entre profesor y alumnos.
- **Gestión de Control**: El profesor puede otorgar o revocar el control del tablero a cualquier alumno presente.
- **Navegación**: Historial de movimientos sincronizado mediante eventos `nav-change`.

### 👥 Grupos de Alumnos
- Los profesores pueden crear grupos y asignar lecciones o clases exclusivas.
- Un alumno puede pertenecer a múltiples grupos simultáneamente.

---

## 📡 Comunicación en Tiempo Real (Socket.io)

El sistema de clases en vivo utiliza WebSockets para una latencia mínima.

### Eventos del Cliente
- `join-class`: Une al usuario a una sala de clase con validación de Token.
- `move`: Envía un nuevo movimiento (Solo si el usuario tiene `hasControl`).
- `grant-control` / `revoke-control`: Gestión de permisos (Solo Staff).
- `nav-change`: Sincroniza la navegación histórica del tablero.

### Eventos del Servidor
- `initial-state`: Envía el estado actual del tablero (FEN, turno, historial) al entrar.
- `participants-update`: Actualiza la lista de usuarios conectados.
- `move`: Notifica a todos los alumnos un nuevo movimiento en el tablero.

---

## 🛠️ Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone https://github.com/QuintaPe/chess-school-back.git
cd chess-school-back
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Variables de Entorno `.env`
```env
PORT=3000
JWT_SECRET=tu_secreto_super_seguro
# Configuración Discord
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
DISCORD_BOT_TOKEN=
# Frontend (para CORS)
FRONTEND_URL=http://localhost:5173
```

### 4. Inicialización
El proyecto utiliza **UUIDs** para todos los IDs. Para una instalación limpia:
1. Elimina `local.db` si existe.
2. Ejecuta `npm run dev`. El sistema ejecutará `src/models/init.ts` para crear el esquema.

---

## 🏗️ Estructura del Proyecto

```text
src/
├── config/        # Base de Datos, Swagger, Cron, Sockets
├── controllers/   # Lógica de negocio y validación Zod
├── middlewares/   # Auth, Roles (isStaff, isAdmin)
├── models/        # Esquemas SQL e interfaces TypeScript
├── routes/        # Definición de Endpoints API
├── sockets/       # Manejadores de eventos de Socket.io
└── index.ts       # Punto de entrada de la aplicación
```

---

## 🧩 Importación Masiva de Puzzles

Para importar puzzles mediante un archivo CSV:
Endpoint: `POST /puzzles/import` (Solo Admin)
Cabeceras esperadas en el CSV: `PuzzleId`, `FEN`, `Moves`, `Rating`, `Themes`, `OpeningTags`.

---

## 🧪 Documentación API
Puedes testear todos los endpoints directamente en Swagger:
`http://localhost:3000/api-docs`

---

## 📜 Licencia
Este proyecto es propiedad del **Club Reino Ajedrez**. Todos los derechos reservados.
