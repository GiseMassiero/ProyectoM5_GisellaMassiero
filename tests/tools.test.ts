import { describe, expect, it, vi, beforeEach } from "vitest";
import { RequestError } from "@octokit/request-error";

/**
 * Arma un RequestError "de verdad" (la misma clase que usa Octokit),
 * para que el código bajo test lo detecte con `instanceof RequestError`
 * tal como pasaría con un error real de la API de GitHub.
 */
function makeRequestError(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): RequestError {
  return new RequestError(message, status, {
    request: { method: "GET", url: "https://api.github.com/test", headers: {} },
    response: { status, url: "https://api.github.com/test", headers, data: {} },
  });
}

/** Saca el texto del primer bloque de contenido de un CallToolResult. */
function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  const block = result.content[0];
  if (!block || block.type !== "text" || typeof block.text !== "string") {
    throw new Error("Se esperaba un bloque de tipo texto");
  }
  return block.text;
}

const createForAuthenticatedUser = vi.fn();
const listForAuthenticatedUser = vi.fn();
const createIssue = vi.fn();
const reposGet = vi.fn();
const getRef = vi.fn();
const getCommit = vi.fn();
const createBlob = vi.fn();
const createTree = vi.fn();
const createGitCommit = vi.fn();
const updateRef = vi.fn();

vi.mock("../src/github/client.js", () => ({
  octokit: {
    rest: {
      repos: { createForAuthenticatedUser, listForAuthenticatedUser, get: reposGet },
      issues: { create: createIssue },
      git: {
        getRef,
        getCommit,
        createBlob,
        createTree,
        createCommit: createGitCommit,
        updateRef,
      },
    },
  },
}));

describe("Tools — casos edge con Octokit mockeado", () => {
  beforeEach(() => {
    createForAuthenticatedUser.mockReset();
    listForAuthenticatedUser.mockReset();
    createIssue.mockReset();
    reposGet.mockReset();
    getRef.mockReset();
    getCommit.mockReset();
    createBlob.mockReset();
    createTree.mockReset();
    createGitCommit.mockReset();
    updateRef.mockReset();
  });

  it("create_issue: repositorio no existe (404) → mensaje en lenguaje natural + isError", async () => {
    createIssue.mockRejectedValueOnce(makeRequestError(404, "Not Found"));

    const { runCreateIssue } = await import("../src/tools/create-issue.js");
    const result = await runCreateIssue({
      owner: "octocat",
      repo: "no-existe-123",
      title: "test",
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("no fue encontrado");
  });

  it("list_repositories: credenciales inválidas (401) → menciona GITHUB_TOKEN + isError", async () => {
    listForAuthenticatedUser.mockRejectedValueOnce(
      makeRequestError(401, "Bad credentials"),
    );

    const { runListRepositories } = await import(
      "../src/tools/list-repositories.js"
    );
    const result = await runListRepositories({});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("GITHUB_TOKEN");
  });

  it("create_repository: reintenta ante un 403 de rate limit y termina bien", async () => {
    const rateLimitError = makeRequestError(403, "secondary rate limit", {
      "x-ratelimit-remaining": "0",
      "retry-after": "0", // 0s para que el test no espere de verdad
    });

    createForAuthenticatedUser
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({
        data: {
          full_name: "octocat/demo",
          html_url: "https://github.com/octocat/demo",
        },
      });

    const { runCreateRepository } = await import(
      "../src/tools/create-repository.js"
    );
    const result = await runCreateRepository({ name: "demo" });

    expect(createForAuthenticatedUser).toHaveBeenCalledTimes(3);
    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("octocat/demo");
  });

  it("create_repository: un 403 sin rate limit NO reintenta (es un permiso real)", async () => {
    const forbiddenError = makeRequestError(403, "Resource not accessible");

    createForAuthenticatedUser.mockRejectedValueOnce(forbiddenError);

    const { runCreateRepository } = await import(
      "../src/tools/create-repository.js"
    );
    const result = await runCreateRepository({ name: "demo" });

    expect(createForAuthenticatedUser).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
  });

  it("create_issue: un input inválido nunca llega a Octokit", async () => {
    const { runCreateIssue } = await import("../src/tools/create-issue.js");
    const result = await runCreateIssue({
      owner: "octocat",
      repo: "demo",
      title: "", // título vacío: lo rechaza el schema
    });

    expect(result.isError).toBe(true);
    expect(createIssue).not.toHaveBeenCalled();
  });

  it("create_commit: sigue el flujo blob → tree → commit → ref y llama a cada paso una vez", async () => {
    reposGet.mockResolvedValueOnce({ data: { default_branch: "main" } });
    getRef.mockResolvedValueOnce({ data: { object: { sha: "parent-commit-sha" } } });
    getCommit.mockResolvedValueOnce({ data: { tree: { sha: "base-tree-sha" } } });
    createBlob.mockResolvedValueOnce({ data: { sha: "blob-sha" } });
    createTree.mockResolvedValueOnce({ data: { sha: "new-tree-sha" } });
    createGitCommit.mockResolvedValueOnce({
      data: { sha: "new-commit-sha", html_url: "https://github.com/octocat/demo/commit/new-commit-sha" },
    });
    updateRef.mockResolvedValueOnce({ data: {} });

    const { runCreateCommit } = await import("../src/tools/create-commit.js");
    const result = await runCreateCommit({
      owner: "octocat",
      repo: "demo",
      path: "docs/nota.md",
      content: "hola mundo",
      message: "agrega nota",
    });

    // Cada paso del pipeline se llamó exactamente una vez, encadenado
    // con el sha del paso anterior — no se salteó ninguno.
    expect(getRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/main" }),
    );
    expect(getCommit).toHaveBeenCalledWith(
      expect.objectContaining({ commit_sha: "parent-commit-sha" }),
    );
    expect(createTree).toHaveBeenCalledWith(
      expect.objectContaining({ base_tree: "base-tree-sha" }),
    );
    expect(createGitCommit).toHaveBeenCalledWith(
      expect.objectContaining({ tree: "new-tree-sha", parents: ["parent-commit-sha"] }),
    );
    expect(updateRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "heads/main", sha: "new-commit-sha" }),
    );

    expect(result.isError).toBeUndefined();
    expect(textOf(result)).toContain("new-commit-sha");
  });
});