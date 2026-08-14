# M5 - MCP Server para GitHub

MCP Server desarrollado con Node.js + TypeScript para permitir que un agente de IA utilice herramientas de GitHub mediante lenguaje natural.

## Arquitectura

```text
Antigravity (Host)
        |
        | stdio
        v
LLM / Cliente MCP
        |
        v
MCP Server
  |     |     |
 Zod  Tools  Errors
        |
        v
     Octokit
        |
        v
   GitHub API
```

## Tools

### create_repository
Crea un repositorio público para el usuario autenticado.

Ejemplo de prompt:

> "Creá un repositorio llamado m5-github-demo con la descripción MCP para GitHub."

### create_issue
Abre un issue.

> "Creá un issue en GiseMassiero/m5-github-demo con título 'Mejora' y body 'Agregar documentación'."

### list_repositories
Lista los repositorios del usuario autenticado.

> "Mostrame mis repositorios de GitHub."

### create_commit
Crea o modifica un archivo y realiza un commit.

> "En GiseMassiero/m5-github-demo agregá un archivo docs/demo.txt con el contenido 'Prueba MCP' y hacé un commit."

### list_issues
Lista los issues del repositorio.

> "Listame los issues abiertos de GiseMassiero/m5-github-demo."

## Requisitos

- Node.js 20+
- Git
- Cuenta de GitHub
- Personal Access Token de GitHub
- Antigravity

## Instalación

```bash
npm install
```

Copiá `.env.example` como `.env` y agregá tu token:

```env
GITHUB_TOKEN=tu_token
GITHUB_MAX_RETRIES=3
```

Nunca compartas ni subas `.env` a Git.

## Personal Access Token

Desde GitHub:

1. Abrí Settings.
2. Entrá en Developer settings.
3. Personal access tokens.
4. Generá un token con los permisos necesarios para repositorios e issues.
5. Copialo una sola vez y guardalo en `.env`.

## Verificación

```bash
npm run typecheck
npm test
```

## Ejecución

```bash
npm run dev
```

El servidor utiliza `stdio`, por lo que normalmente es iniciado por el host MCP.

## Configuración en Antigravity

Antigravity (como cualquier host MCP) necesita un archivo de configuración que le diga
qué comando ejecutar para levantar el server y qué variables de entorno pasarle. La
estructura sigue el mismo formato que usan Claude Desktop y otros hosts MCP:

```json
{
  "mcpServers": {
    "github-m5": {
      "command": "npx",
      "args": ["tsx", "C:/ruta/completa/a/ProyectoM5_GisellaMassiero/src/server.ts"],
      "env": {
        "GITHUB_TOKEN": "tu_token_aca",
        "GITHUB_MAX_RETRIES": "3"
      }
    }
  }
}
```

Puntos importantes de esta configuración:

- `command` + `args`: cómo se levanta el proceso. Como el proyecto usa `tsx` (no hay
  build a JS plano), se ejecuta directamente el `.ts` — no hace falta `npm run build`.
- La ruta en `args` tiene que ser **absoluta**, no relativa (Antigravity no sabe desde
  dónde vos correrías `npm run dev`).
- `env`: acá van las variables, **no** en el `.env` del proyecto — Antigravity levanta el
  proceso como un subproceso propio, así que el `.env` local no se comparte automáticamente.
- La ubicación exacta de este archivo (nombre y carpeta) depende de la versión de
  Antigravity instalada; buscá "MCP Servers" en su configuración para confirmar el path.

Después de guardar la configuración y reiniciar Antigravity, el LLM conectado debería
poder ver las 5 tools (`create_repository`, `create_issue`, `list_repositories`,
`create_commit`, `list_issues`) y usarlas cuando el prompt las necesite.

## Seguridad

- El token nunca se imprime en logs.
- `.env` está incluido en `.gitignore` — nunca se sube a git.
- **Cuidado al compartir el proyecto por fuera de git** (zip, pendrive, etc.): `.gitignore`
  solo protege contra `git add`/`git push`, no evita que el `.env` quede adentro de un
  `.zip` armado a mano. Antes de comprimir la carpeta para entregarla o compartirla,
  confirmá que `.env` no esté incluido (dejá solo `.env.example`).
- Si un token llegó a exponerse por error, se revoca desde GitHub → Settings →
  Developer settings → Personal access tokens, y se genera uno nuevo.
- Los inputs se validan antes de llamar a GitHub.
- Los errores técnicos se transforman en mensajes entendibles por el LLM.

## Testing

El proyecto utiliza Vitest (`npm test`) y contiene 17 tests en 4 archivos:

- `tests/schemas.test.ts` (6): validación de schemas Zod — inputs válidos pasan,
  inválidos fallan (nombre de repo con espacios, commit sin mensaje, etc.).
- `tests/errors.test.ts` (4): transformación de cada tipo de error a lenguaje natural.
- `tests/github.test.ts` (2): operaciones de GitHub con Octokit mockeado (camino feliz).
- `tests/tools.test.ts` (5): casos edge de punta a punta (schema → operación → mensaje),
  con Octokit mockeado:
  - repositorio inexistente (404) → mensaje "no fue encontrado";
  - credenciales inválidas (401) → mensaje que menciona `GITHUB_TOKEN`;
  - **rate limit (403 con `x-ratelimit-remaining: 0`) → reintenta automáticamente y
    termina bien** (se verifica que Octokit fue llamado 3 veces: 2 fallos + 1 éxito);
  - un 403 "real" (sin rate limit) → no reintenta, porque reintentar no arregla un
    permiso faltante;
  - input inválido → nunca llega a pegarle a la API.

Ninguno de los tests hace llamadas reales a GitHub — todos mockean `src/github/client.js`.

## Manejo de rate limiting (retry logic)

GitHub devuelve dos variantes de "estoy limitando tu request":

- **429 Too Many Requests**: siempre es rate limit.
- **403 Forbidden con el header `x-ratelimit-remaining: 0`**: el llamado "secondary
  rate limit". Un 403 sin ese header es un permiso real (token sin el scope necesario)
  y ahí no tiene sentido reintentar.

`src/github/operations.ts` distingue estos dos casos (`isRateLimited`) y, cuando
corresponde reintentar, calcula la espera usando los headers `retry-after` o
`x-ratelimit-reset` si GitHub los manda (en vez de un backoff a ciegas), con un techo
de 30s por intento para no colgar el proceso. Los reintentos son máximo
`GITHUB_MAX_RETRIES` (default 3, configurable por variable de entorno).

## Estructura del proyecto

```text
src/
  config/env.ts        # Carga y valida las variables de entorno (falla rápido y claro si falta GITHUB_TOKEN)
  errors/index.ts       # Jerarquía de errores: ValidationError, GitHubAPIError, AuthenticationError, NetworkError
  github/
    client.ts           # Instancia única de Octokit, autenticada con el token
    operations.ts        # Llamadas a la API de GitHub + retry logic (rate limiting incluido)
  schemas/index.ts      # Un schema Zod por tool, con las reglas de validación
  tools/                # Una función por tool: parsea el input, llama a operations.ts, arma la respuesta
  utils/logging.ts       # Logging simple a stderr (nunca se loguea el token)
  server.ts             # Registra las 5 tools en el McpServer y lo conecta por stdio
tests/                  # 17 tests con Vitest (ver sección Testing)
```

Cada tool sigue siempre el mismo camino: **schema (Zod) → handler de la tool → operación
de GitHub (con retry) → error normalizado a lenguaje natural o resultado exitoso.** Tener
un único camino repetido en las 5 tools es lo que hace que agregar una tool nueva sea
simple: se suma un schema, una función en `operations.ts` y un archivo en `tools/`.

## Defensa oral

Puntos importantes para explicar:

1. Antigravity actúa como Host; el LLM conectado es el Cliente MCP.
2. El LLM decide qué tool necesita según la descripción de cada una (por eso las
   descripciones dicen no solo "qué hace" la tool sino "cuándo usarla").
3. El MCP Server expone las 5 tools con un contrato explícito (`name` + `description` +
   `inputSchema`) antes de tener ninguna lógica interna — diseño "contract-first".
4. Zod valida los argumentos con reglas concretas (ej: nombre de repo 3-100 caracteres,
   alfanumérico y guiones) antes de que la tool intente llamar a GitHub.
5. Octokit comunica el servidor con GitHub; toda llamada pasa por `operations.ts`.
6. Los errores se clasifican en 4 tipos y se transforman a lenguaje natural para que el
   LLM se lo pueda explicar a la persona usuaria.
7. **Rate limiting**: un 403 con `x-ratelimit-remaining: 0` (o un 429) dispara reintentos
   automáticos respetando el tiempo que pide GitHub; un 403 sin eso no reintenta, porque
   es un problema de permisos, no de cuota.
8. Los tests mockean `src/github/client.js` para evitar llamadas reales — incluye un test
   que prueba el retry de rate limit contando cuántas veces se llamó a Octokit.
9. `stdio` permite la comunicación local entre Host y MCP Server (por eso Antigravity
   necesita la ruta absoluta al `server.ts`, no una URL).
