# ProyectoM5_GisellaMassiero — GitHub MCP Server

Servidor **MCP (Model Context Protocol)** en Node.js + TypeScript que expone 5
herramientas de GitHub para que un agente de IA (conectado a **Antigravity**) las
use a partir de instrucciones en lenguaje natural: crear repositorios, abrir
issues, listar repositorios, hacer commits reales y listar issues.

## Qué hace

En vez de que la persona usuaria tenga que abrir GitHub y hacer clics, le pide al
agente algo como *"Creá un issue en mi-repo con título 'Bug en el login'"*, y el
agente:

1. Decide sola, por la `description` de cada tool, cuál necesita usar.
2. Arma los parámetros a partir del lenguaje natural.
3. Este servidor valida esos parámetros con **Zod** antes de tocar la red.
4. Ejecuta la acción real contra la API de GitHub con **Octokit**, con reintentos
   automáticos si GitHub aplica rate limiting.
5. Si algo sale mal, el error se traduce a un mensaje en lenguaje natural que el
   agente le puede explicar a la persona usuaria — nunca un stack trace crudo.

## Por qué es útil — casos de uso

- **Triage rápido de issues**: "Listame los issues abiertos de mi-repo" en vez de
  navegar la UI de GitHub.
- **Bootstrap de proyectos nuevos**: "Creá un repo llamado proyecto-x" sin salir
  del chat con el agente.
- **Documentación al vuelo**: "Agregá un archivo CHANGELOG.md a mi-repo con este
  contenido" — un commit real, sin clonar el repo localmente.
- **Reporte de bugs desde una conversación**: mientras charlás con el agente sobre
  un problema, le pedís que abra el issue directamente, con el contexto ya
  resumido en el título y el body.
- **Onboarding de un asistente de IA a tu flujo de trabajo de GitHub** sin
  escribirle código de integración a mano por cada acción.

## Requisitos del sistema

- **Node.js 20 o superior** (el proyecto usa ES Modules y TypeScript moderno).
- **npm** (viene con Node).
- Una cuenta de **GitHub** con permisos para crear repos/issues en donde se vaya
  a probar.
- **Antigravity** instalado, si se va a conectar como MCP Host (no es
  obligatorio para correr los tests o el server a mano).

## Instalación paso a paso

```bash
# 1. Clonar o descomprimir el proyecto, y pararse en la carpeta
cd ProyectoM5_GisellaMassiero

# 2. Instalar dependencias (lee package.json y package-lock.json)
npm install

# 3. Verificar que TypeScript compila sin errores
npm run typecheck

# 4. (Opcional) Compilar a JavaScript plano en dist/
npm run build

# 5. Correr los tests para confirmar que todo funciona
npm test
```

`npm run typecheck` no debería imprimir nada si está todo bien — la ausencia de
salida es la señal de éxito de `tsc --noEmit`. `npm test` debería mostrar
`Tests 18 passed (18)`.

## Configuración

### 1. Cómo obtener un GitHub Personal Access Token

1. Entrá a GitHub → tu foto de perfil (arriba a la derecha) → **Settings**.
2. En el menú de la izquierda, bajá hasta **Developer settings**.
3. **Personal access tokens** → **Tokens (classic)** (la vía más simple y
   compatible con todas las tools de este proyecto).
4. **Generate new token** → **Generate new token (classic)**.
5. Ponele un nombre descriptivo (ej: `mcp-github-m5`) y una fecha de expiración.
6. Marcá los scopes de la sección siguiente.
7. **Generate token** y **copiá el valor inmediatamente** — GitHub no lo vuelve a
   mostrar después de salir de esa pantalla.

### 2. Qué scopes necesita el token

| Scope | Para qué se usa acá |
|---|---|
| `repo` | Necesario para las 5 tools: crear repos, crear/listar issues, hacer commits y listar repos **privados** con `list_repositories`. |

Si solo vas a trabajar con repositorios públicos, el scope más acotado
`public_repo` alcanza para todo excepto ver repos privados en
`list_repositories`. Ante la duda, `repo` es la opción segura.

> **Importante:** el token es una credencial — tratalo como una contraseña.
> Nunca lo subas a git, ni lo compartas en capturas de pantalla, chats o zips
> del proyecto (ver la sección Seguridad más abajo).

### 3. Cómo configurar el `.env`

```bash
cp .env.example .env
```

Y completá el archivo:

```env
GITHUB_TOKEN=el_token_que_generaste_arriba
GITHUB_MAX_RETRIES=3
```

- `GITHUB_TOKEN`: obligatorio — el server no arranca sin él (falla rápido, con
  un mensaje claro, en vez de fallar más adelante de forma confusa).
- `GITHUB_MAX_RETRIES`: opcional, default `3` — cuántas veces reintenta una
  operación cuando GitHub aplica rate limiting (ver sección de Troubleshooting).

### 4. Cómo configurar el MCP server en Antigravity

1. En Antigravity, clic en el **"..."** (más opciones) arriba del panel del
   agente → **MCP Servers** → **Manage MCP Servers** → **View raw config**. Esto
   abre el `mcp_config.json` directamente en el editor.
2. Agregá una entrada para este server dentro de `mcpServers` (si ya tenés otros
   servers cargados, sumá esta clave al lado de las que ya existen, sin
   borrarlas):

```json
{
  "mcpServers": {
    "github-m5": {
      "command": "npx",
      "args": [
        "tsx",
        "RUTA/ABSOLUTA/A/ProyectoM5_GisellaMassiero/src/server.ts"
      ],
      "env": {
        "GITHUB_TOKEN": "tu_token_aca",
        "GITHUB_MAX_RETRIES": "3"
      }
    }
  }
}
```

- Usá la **ruta absoluta** a `src/server.ts` en tu máquina, con `/` en vez de
  `\` (en Windows, JSON necesita escapar `\`, así que `/` evita el problema y
  funciona igual).
- El `env` de acá es necesario porque Antigravity levanta el server como un
  proceso propio — **no** hereda el `.env` de la carpeta del proyecto.
- Alternativa más segura para no pegar el token en texto plano: definir
  `GITHUB_TOKEN` como variable de entorno del sistema operativo, y poner
  `"GITHUB_TOKEN": "${GITHUB_TOKEN}"` en el JSON — Antigravity lo resuelve solo.
3. Guardá el archivo y reiniciá Antigravity **por completo** (no alcanza con
   cerrar la pestaña — ver Troubleshooting si se queda cargando).
4. Volvé a **Manage MCP Servers**: deberías ver `github-m5` en la lista con
   **5/5 tools** cargadas y el toggle en verde/activado.

## Documentación de cada tool

### `create_repository`

Crea un repositorio nuevo y **público** en la cuenta autenticada por el token.

| Parámetro | Tipo | Obligatorio | Detalle |
|---|---|---|---|
| `name` | `string` | Sí | 3-100 caracteres. Solo letras, números y guiones (sin espacios ni símbolos). |
| `description` | `string` | No | Hasta 350 caracteres. |

> Nota: actualmente crea siempre un repo público (no expone un parámetro para
> crearlo privado).

**Prompt de ejemplo que funciona bien:**
> "Creá un repositorio llamado `mcp-demo-notas` con la descripción 'Notas de
> prueba para la demo del MCP server'."

### `create_issue`

Abre un issue nuevo en un repositorio ya conocido (owner + repo exactos).

| Parámetro | Tipo | Obligatorio | Detalle |
|---|---|---|---|
| `owner` | `string` | Sí | Usuario u organización dueño del repo. |
| `repo` | `string` | Sí | Nombre exacto del repositorio. |
| `title` | `string` | Sí | 1-256 caracteres. |
| `body` | `string` | No | Hasta 65.536 caracteres. |

**Prompt de ejemplo que funciona bien:**
> "Abrí un issue en `GiseMassiero/mcp-demo-notas` con título 'Agregar
> validación de fechas' y descripción 'El formulario acepta fechas pasadas,
> debería rechazarlas'."

### `list_repositories`

Lista los repositorios del **usuario autenticado** (el dueño del token) — no de
un usuario arbitrario.

| Parámetro | Tipo | Obligatorio | Detalle |
|---|---|---|---|
| `visibility` | `"all" \| "public" \| "private"` | No | Si se omite, GitHub aplica su default (`all`). |
| `per_page` | `number` | No | Entre 1 y 100. Default interno: 30. |

**Prompt de ejemplo que funciona bien:**
> "Listame mis repositorios de GitHub." o "Mostrame solo mis repos privados."

### `create_commit`

Crea o actualiza **un archivo puntual** en un repositorio conocido, siguiendo el
flujo real de la Git Data API (`blob → tree → commit → ref`) — no un atajo de
alto nivel.

| Parámetro | Tipo | Obligatorio | Detalle |
|---|---|---|---|
| `owner` | `string` | Sí | Dueño del repo. |
| `repo` | `string` | Sí | Nombre exacto del repositorio. |
| `path` | `string` | Sí | Ruta del archivo (ej: `docs/notas.md`). No puede empezar con `/`. |
| `message` | `string` | Sí | Mensaje del commit, hasta 72 caracteres (convención de git). |
| `content` | `string` | Sí | Contenido del archivo en texto plano (se codifica a base64 internamente). |
| `branch` | `string` | No | Si se omite, usa la rama por default del repositorio. |

**Prompt de ejemplo que funciona bien:**
> "En `GiseMassiero/mcp-demo-notas`, agregá un archivo `docs/prueba.md` con el
> contenido 'Primera prueba del MCP server' y el mensaje de commit 'docs: agrega
> nota de prueba'."

### `list_issues`

Lista los issues de un repositorio conocido (owner + repo exactos), filtrando
pull requests (que la API de GitHub devuelve mezclados con los issues).

| Parámetro | Tipo | Obligatorio | Detalle |
|---|---|---|---|
| `owner` | `string` | Sí | Dueño del repo. |
| `repo` | `string` | Sí | Nombre exacto del repositorio. |
| `state` | `"open" \| "closed" \| "all"` | No | Default `"open"`. |
| `per_page` | `number` | No | Entre 1 y 100. Default interno: 30. |

**Prompt de ejemplo que funciona bien:**
> "Listame los issues cerrados de `GiseMassiero/mcp-demo-notas`."

## Ejemplos de uso (las 5 tools en una sola sesión)

Una conversación real con el agente podría recorrer así las 5 tools, de punta a
punta:

1. **"Creá un repositorio llamado `demo-m5` con la descripción 'Repo de
   práctica para la defensa'."** → `create_repository` crea el repo público.
2. **"Confirmame que el repo se creó — listame mis repositorios."** →
   `list_repositories` lo trae en la lista, confirmando el nombre exacto.
3. **"Abrí un issue en `tu-usuario/demo-m5` con título 'Setup inicial' y
   descripción 'Falta agregar el README'."** → `create_issue` crea el ticket.
4. **"Agregá un archivo `README.md` a `tu-usuario/demo-m5` con el contenido
   '# Demo M5' y el mensaje de commit 'docs: agrega README'."** →
   `create_commit` sube el archivo con un commit real (blob → tree → commit →
   ref).
5. **"Listame los issues abiertos de `tu-usuario/demo-m5`."** → `list_issues`
   confirma que el issue del paso 3 sigue abierto.

Cada paso queda registrado de verdad en GitHub — no hay simulación ni mocks
fuera de los tests.

## Arquitectura

```text
Antigravity (Host)
        |
        | stdio
        v
LLM / Cliente MCP (Gemini)
        |
        v
MCP Server  (src/server.ts)
  |     |     |
 Zod  Tools  Errors
        |
        v
   Octokit  (src/github/client.ts + operations.ts)
        |
        v
   GitHub API
```

- **Host** (Antigravity): la aplicación donde vive la persona usuaria; orquesta
  todo.
- **Client MCP / LLM**: decide qué tool llamar y con qué parámetros, leyendo el
  contrato (`name` + `description` + `inputSchema`) de cada una.
- **MCP Server**: este proyecto. Corre como proceso local, comunicado por
  **stdio** (entrada/salida estándar) — no por red, porque es un subproceso
  hijo de Antigravity en la misma máquina.
- **Octokit**: el cliente de la API real de GitHub.

El camino que sigue cada tool, siempre igual: **schema (Zod) → handler de la
tool → operación de GitHub (con retry) → error normalizado a lenguaje natural o
resultado exitoso.**

## Cómo ejecutar los tests

```bash
npm test          # corre los 18 tests una vez
npm run test:watch  # los corre en modo watch, útil mientras se desarrolla
```

El proyecto contiene 18 tests con Vitest en 4 archivos — ninguno hace llamadas
reales a GitHub (todos mockean `src/github/client.js`):

- `tests/schemas.test.ts` (6): validación de schemas Zod.
- `tests/errors.test.ts` (4): transformación de errores a lenguaje natural.
- `tests/github.test.ts` (2): operaciones con Octokit mockeado (camino feliz).
- `tests/tools.test.ts` (6): casos edge de punta a punta — repo inexistente
  (404), credenciales inválidas (401), rate limit con reintento automático, un
  403 real que no reintenta, input inválido que nunca llega a Octokit, y el
  flujo completo de `create_commit` (blob → tree → commit → ref, un llamado
  por paso).

## Manejo de rate limiting

GitHub devuelve dos "sabores" de estoy-limitando-tu-uso:

- **429 Too Many Requests**: siempre es rate limit.
- **403 Forbidden con el header `x-ratelimit-remaining: 0`**: el llamado
  "secondary rate limit". Un 403 **sin** ese header es un permiso real (falta
  un scope en el token) — ahí no tiene sentido reintentar.

`src/github/operations.ts` distingue estos dos casos y, cuando corresponde
reintentar, respeta `retry-after` o `x-ratelimit-reset` si GitHub los manda (con
un techo de 30s por intento), o backoff exponencial si no. Máximo
`GITHUB_MAX_RETRIES` intentos (default 3).

## Troubleshooting común

**"Unknown command: tsx" al correr el server a mano**
Se escribió `npm tsx archivo.ts` en vez de `npx tsx archivo.ts`. `npx` ejecuta
paquetes directamente; `npm` busca un comando registrado llamado "tsx" y no lo
encuentra.

**"Manage MCP servers" se queda en "Loading..." en Antigravity**
Suele deberse a un proceso `node.exe` colgado de una prueba manual anterior
(por ejemplo, haber dejado corriendo `npx tsx src/server.ts` en una terminal).
Cerrá ese proceso (o el proceso completo desde el Administrador de tareas),
cerrá Antigravity por completo (no solo la ventana — revisar la bandeja del
sistema) y volvé a abrirlo.

**El server no arranca / tira error apenas se ejecuta**
Casi siempre falta `GITHUB_TOKEN` en el `.env`, o el archivo `.env` no existe
todavía (`cp .env.example .env` y completarlo — ver sección de Configuración).

**Un prompt no ejecuta la tool que se esperaba**
Revisá que el prompt incluya lo que la `description` de la tool pide como
obligatorio (por ejemplo, `create_issue` no puede inferir el `owner` si nunca
se lo diste ni antes ni en el mismo mensaje). Pedirle primero
`list_repositories` para confirmar el nombre exacto suele resolverlo.

**"El repositorio [x] no fue encontrado" al crear un issue o commit**
El repo no existe con ese nombre exacto en la cuenta del token, o hay un typo.
Confirmá con `list_repositories` antes de reintentar.

**`npm run build` no existía**
Se agregó `"build": "tsc"` a `package.json` — compila a `dist/` (ya excluido en
`.gitignore`). No afecta a `dev`/`start`, que siguen corriendo el `.ts`
directo con `tsx`.

## Seguridad

- El token nunca se imprime en logs.
- `.env` está incluido en `.gitignore` — nunca se sube a git.
- **Cuidado al compartir el proyecto por fuera de git** (zip, pendrive, etc.):
  `.gitignore` solo protege contra `git add`/`git push`, no evita que `.env`
  quede adentro de un `.zip` armado a mano. Antes de comprimir la carpeta para
  entregarla, confirmá que `.env` no esté incluido (dejá solo `.env.example`).
- Si un token llegó a exponerse por error, se revoca desde GitHub → Settings →
  Developer settings → Personal access tokens, y se genera uno nuevo.
- Los inputs se validan con Zod antes de llamar a GitHub.
- Los errores técnicos se transforman en mensajes entendibles por el LLM, sin
  exponer detalles internos sensibles.

## Estructura del proyecto

```text
src/
  config/env.ts        # Carga y valida las variables de entorno
  errors/index.ts       # ValidationError, GitHubAPIError, AuthenticationError, NetworkError
  github/
    client.ts           # Instancia única de Octokit, autenticada
    operations.ts        # Llamadas a la API de GitHub + retry logic (rate limiting incluido)
  schemas/index.ts      # Un schema Zod por tool
  tools/                # Una función por tool: schema → operación → respuesta
  utils/logging.ts       # Logging simple a stderr (nunca el token)
  server.ts             # Registra las 5 tools en el McpServer, stdio
tests/                  # 18 tests con Vitest
```

Cada tool sigue siempre el mismo camino: **schema (Zod) → handler de la tool →
operación de GitHub (con retry) → error normalizado o resultado exitoso.**


## Licencia

Este proyecto está bajo la licencia **MIT** — ver el archivo [`LICENSE`](./LICENSE).