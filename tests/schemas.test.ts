import { describe, expect, it } from "vitest";
import {
  createRepositorySchema,
  createIssueSchema,
  createCommitSchema,
  listIssuesSchema,
} from "../src/schemas/index.js";

describe("Schemas Zod", () => {
  it("acepta un nombre de repositorio válido", () => {
    expect(createRepositorySchema.safeParse({ name: "m5-github-mcp" }).success).toBe(true);
  });

  it("rechaza nombres de repositorio demasiado cortos", () => {
    expect(createRepositorySchema.safeParse({ name: "ab" }).success).toBe(false);
  });

  it("rechaza caracteres inválidos en el repositorio", () => {
    expect(createRepositorySchema.safeParse({ name: "repo con espacios" }).success).toBe(false);
  });

  it("acepta un issue válido", () => {
    expect(
      createIssueSchema.safeParse({
        owner: "GiseMassiero",
        repo: "m5-github-mcp",
        title: "Primer issue",
      }).success
    ).toBe(true);
  });

  it("rechaza un commit sin mensaje", () => {
    expect(
      createCommitSchema.safeParse({
        owner: "GiseMassiero",
        repo: "m5-github-mcp",
        path: "README.md",
        message: "",
        content: "hola",
      }).success
    ).toBe(false);
  });

  it("aplica open como estado por defecto para issues", () => {
    const parsed = listIssuesSchema.parse({
      owner: "GiseMassiero",
      repo: "m5-github-mcp",
    });
    expect(parsed.state).toBe("open");
  });
});
