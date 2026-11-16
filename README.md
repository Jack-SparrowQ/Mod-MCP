# Moodle ITESCAM MCP

Servidor [MCP](https://modelcontextprotocol.io/) que permite a un asistente de IA (Claude Code,
Claude Desktop, Codex u otro cliente MCP) consultar tu cuenta de estudiante en
[Moodle ITESCAM](https://moodle.itescam.edu.mx/moodle4/): cursos, contenidos, tareas, fechas
límite, calificaciones, calendario y avisos.

Usa la API oficial de Moodle (Web Services, el mismo servicio de la app móvil). No lee HTML, no
guarda tu contraseña. Las consultas son de lectura; la entrega de archivos requiere confirmación
explícita en un cliente MCP compatible con elicitation.

## Requisitos

- Node.js **24** o superior y npm
- Una cuenta de estudiante de Moodle ITESCAM

## Instalación

```bash
git clone <url-del-repo> moodle-itescam-mcp
cd moodle-itescam-mcp
npm install
npm run build
```

> En PowerShell de Windows, si `npm` falla con "running scripts is disabled", usa `npm.cmd`.

## Obtener tu token

El servidor se autentica con un **token** de Moodle, nunca con tu contraseña.

```bash
npm run token
```

Te pide usuario y contraseña (la contraseña no se muestra al escribirla), obtiene el token y lo
guarda en `.env` como `MOODLE_TOKEN`. El token no se imprime en pantalla y la contraseña no se
guarda en ningún sitio.

- `.env` está en `.gitignore`: nunca lo subas al repositorio.
- El token aparece en Moodle en **Preferencias → Claves de seguridad** (servicio
  `moodle_mobile_app`). Desde ahí puedes revocarlo en cualquier momento.
- Para "cerrar sesión": revoca la clave en Moodle y borra la línea `MOODLE_TOKEN` de `.env`.

Variables de `.env` (plantilla en `.env.example`):

| Variable | Obligatoria | Valor por defecto |
|---|---|---|
| `MOODLE_TOKEN` | sí | — (lo escribe `npm run token`) |
| `MOODLE_BASE_URL` | no | `https://moodle.itescam.edu.mx/moodle4/` (solo HTTPS) |
| `LOG_LEVEL` | no | `info` (`silent`, `error`, `warn`, `debug`…) |
| `MAX_DOWNLOAD_MB` | no | `50` (entero de 1 a 500; límite por archivo) |

El servidor carga el `.env` de la carpeta del proyecto aunque el cliente MCP lo lance desde otra
carpeta.

## Conectar un cliente MCP

Usa la ruta absoluta a `dist/index.js` de tu copia del proyecto.

**Claude Code**

```bash
claude mcp add --transport stdio moodle-itescam -- node /ruta/a/moodle-itescam-mcp/dist/index.js
```

**Codex**

```bash
codex mcp add moodle-itescam -- node /ruta/a/moodle-itescam-mcp/dist/index.js
```

**Claude Desktop** — en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "moodle-itescam": {
      "command": "node",
      "args": ["/ruta/a/moodle-itescam-mcp/dist/index.js"]
    }
  }
}
```

Reinicia el cliente y pídele: *"Comprueba mi conexión con Moodle"* (usa `moodle_auth_status`).

## Herramientas

Las herramientas actúan únicamente sobre tu cuenta: ninguna acepta un id de usuario.
`moodle_submit_assignment` es la única que escribe en Moodle y siempre requiere confirmación.
Las fechas se devuelven en ISO 8601 (UTC).

| Herramienta | Entradas | Devuelve |
|---|---|---|
| `moodle_auth_status` | — | si el token es válido y la versión del sitio |
| `moodle_get_profile` | — | tu nombre, usuario, correo y URL de perfil |
| `moodle_get_courses` | `query?`, `courseId?` | tus cursos; `query` ignora mayúsculas y acentos |
| `moodle_get_course_contents` | `courseId` | secciones y actividades (archivos: solo metadatos) |
| `moodle_get_assignments` | `courseId?`, `dueAfter?`, `dueBefore?`, `limit?` (50, máx. 200) | tareas; primero las próximas |
| `moodle_get_assignment` | `assignmentId` | instrucciones, estado de tu entrega, si está vencida y su nota |
| `moodle_get_upcoming_deadlines` | `days?` (14, máx. 60), `includeOverdue?` (sí) | lo que aún tienes pendiente, incluidas las vencidas |
| `moodle_get_calendar_events` | `from?`, `to?` (7 días, máx. 92), `courseId?` | eventos del calendario |
| `moodle_get_grades` | `courseId?` | resumen por curso, o elementos y total de un curso |
| `moodle_get_announcements` | `courseId?`, `limit?` (10, máx. 50) | avisos de los foros de noticias |
| `moodle_download_resource` | `courseId`, `moduleId`, `filename?`, `filepath?` | ruta local y metadatos de un archivo del curso |
| `moodle_submit_assignment` | `assignmentId`, `files` (1–20 nombres relativos) | entrega verificada, tras confirmación en el cliente |

Las descargas se guardan en `downloads/<courseId>/` dentro del proyecto, con un límite de 50 MB
por archivo (configurable con `MAX_DOWNLOAD_MB`). Los archivos existentes nunca se sobrescriben;
se añade un sufijo al nombre. En carpetas se descarga un archivo por petición.

### Entregar una tarea

Coloca los archivos en `submissions/` dentro del proyecto (carpeta ignorada por Git), por ejemplo
`submissions/practica/informe.pdf`. Pasa `practica/informe.pdf` en `files`, junto al `assignmentId`
obtenido con `moodle_get_assignments`. No se aceptan rutas absolutas ni archivos fuera de esa
carpeta, enlaces simbólicos, archivos vacíos o duplicados.

El cliente mostrará un formulario de confirmación con curso, tarea, archivos y tamaños, fecha
límite y avisos de entrega tardía o reemplazo de borradores. Debes confirmar y, si corresponde,
aceptar la declaración de autoría. La IA no puede responder ese formulario. Sin un cliente con
elicitation de formularios (Claude Code; Codex también la declara), no se sube ni entrega nada.
Codex en modo no interactivo (`codex exec`) rechaza la confirmación automáticamente y además
bloquea las herramientas que no son de solo lectura, así que nunca puede entregar sin ti. Solo se informa éxito
cuando Moodle devuelve el estado `submitted`; las escrituras no se reintentan automáticamente. Si
los archivos llegaron a guardarse como borrador pero la entrega no se confirmó, el error lo indica
(`draftSaved: true`): revisa la tarea en Moodle antes de reintentar.

Ejemplos de peticiones: *"¿Qué tareas tengo pendientes esta semana?"*, *"Muéstrame mis
calificaciones de Redes"*, *"¿Qué hay en la sección 3 de Sistemas Operativos?"*.

### Errores

Las herramientas devuelven `{ error: { code, message, suggestion } }` con estos códigos:

| Código | Qué hacer |
|---|---|
| `AUTH_REQUIRED` / `SESSION_EXPIRED` | falta el token o fue revocado: ejecuta `npm run token` |
| `RESOURCE_NOT_FOUND` | no estás inscrito en ese curso o no existe esa tarea |
| `PERMISSION_DENIED` | Moodle no te permite ver eso |
| `MOODLE_UNAVAILABLE` | Moodle no responde; inténtalo más tarde |
| `VALIDATION_ERROR` | parámetros inválidos (p. ej. `from` posterior a `to`) |
| `INTEGRATION_UNSUPPORTED` | el servicio web de Moodle no está disponible |
| `OPERATION_FAILED` | Moodle devolvió algo inesperado |

## Privacidad y seguridad

- La IA nunca ve tu contraseña ni el token. Sí ve los datos académicos que le pidas (nombre,
  correo, notas…), porque ese es el propósito de la herramienta.
- Los logs van a stderr y solo registran la función de Moodle llamada, la duración y el resultado:
  sin parámetros, datos personales ni token.
- Solo se pueden llamar 12 funciones de lectura de Moodle (lista explícita en
  `src/infrastructure/moodle/rest-client.ts`). Las dos funciones de entrega tienen una vía de
  escritura separada, usada únicamente después de la confirmación. No hay funciones de profesor.
- No se devuelven enlaces de descarga de archivos.
- **Efecto de Moodle al consultar el estado de una tarea:** la primera vez que se consulta una tarea
  abierta (`moodle_get_assignment`, o las comprobaciones previas de `moodle_submit_assignment`),
  Moodle crea un registro de entrega vacío con estado `new`, igual que al abrir la tarea en el
  navegador. No contiene archivos, no es una entrega y no afecta a la calificación.

## Limitaciones actuales

- Entregas: solo archivos, sin texto en línea, reenvíos ni entregas de grupo. Requiere un cliente
  con elicitation de formularios; una tarea ya entregada se rechaza.
- Avisos: solo la primera página de cada foro de noticias.
- Fechas límite y calendario: como máximo 200 elementos por consulta (`truncated: true` si hay más).
- Probado contra Moodle ITESCAM 4.1.1+. Otras instalaciones de Moodle pueden funcionar si
  tienen habilitado el servicio móvil, pero no están verificadas.

## Desarrollo

```bash
npm run typecheck   # tsc --noEmit
npm test            # Vitest; la red real está bloqueada en los tests
npm run dev         # servidor con tsx (sin compilar)
```

Arquitectura: `docs/architecture.md`. Requisitos: `docs/requirements.md`. Hallazgos sobre Moodle
ITESCAM: `docs/moodle-investigation.md`. Decisiones: `docs/decisions/`. Flujo de trabajo entre
agentes: `AGENTS.md`, `CLAUDE.md`.
