import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  createRepositorySchema,
  createIssueSchema,
  listRepositoriesSchema,
  createCommitSchema,
  listIssuesSchema,
} from "./schemas/index.js";

import { runCreateRepository } from "./tools/create-repository.js";
import { runCreateIssue } from "./tools/create-issue.js";
import { runListRepositories } from "./tools/list-repositories.js";
import { runCreateCommit } from "./tools/create-commit.js";
import { runListIssues } from "./tools/list-issues.js";

import { logInfo } from "./utils/logging.js";

const server = new McpServer({
  name: "m5-github-mcp",
  version: "1.0.0",
});

server.registerTool(
  "create_repository",
  {
    description:
      "Crea un repositorio nuevo y público en la cuenta autenticada de GitHub (la del token). " +
      "Usarla cuando no existe todavía el repositorio y hay que crearlo de cero. " +
      "Requiere solo el nombre (3-100 caracteres, letras/números/guiones); la descripción es opcional. " +
      "Si el repositorio ya existe, usar list_repositories para confirmarlo antes de intentar crearlo de nuevo.",
    inputSchema: createRepositorySchema,
  },
  async (input) => runCreateRepository(input),
);

server.registerTool(
  "create_issue",
  {
    description:
      "Abre un issue nuevo en un repositorio de GitHub ya conocido (owner + repo exactos). " +
      "Requiere owner, repo y title; el body es opcional. " +
      "Si no se sabe el nombre exacto del repositorio, usar list_repositories primero para no adivinarlo.",
    inputSchema: createIssueSchema,
  },
  async (input) => runCreateIssue(input),
);

server.registerTool(
  "list_repositories",
  {
    description:
      "Lista los repositorios del usuario autenticado (dueño del token). " +
      "Usarla para DESCUBRIR qué repos existen o confirmar el nombre exacto de uno antes de " +
      "llamar a create_issue, create_commit o list_issues, que necesitan owner/repo exactos.",
    inputSchema: listRepositoriesSchema,
  },
  async (input) => runListRepositories(input),
);

server.registerTool(
  "create_commit",
  {
    description:
      "Crea o modifica UN archivo puntual en un repositorio ya conocido y hace commit del cambio " +
      "(usa la Contents API de GitHub, no un git push tradicional). " +
      "Requiere owner, repo, path, content y message. Si el archivo ya existe en ese path, lo actualiza; " +
      "si no existe, lo crea. Esta tool ESCRIBE en el repo — no es de solo lectura.",
    inputSchema: createCommitSchema,
  },
  async (input) => runCreateCommit(input),
);

server.registerTool(
  "list_issues",
  {
    description:
      "Lista los issues de un repositorio ya conocido (owner + repo exactos), filtrando pull requests. " +
      "Requiere owner y repo; state es opcional (default 'open'). " +
      "Si no se sabe el nombre exacto del repositorio, usar list_repositories primero.",
    inputSchema: listIssuesSchema,
  },
  async (input) => runListIssues(input),
);

const transport = new StdioServerTransport();

logInfo("Iniciando MCP Server de GitHub...");

await server.connect(transport);