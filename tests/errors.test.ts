import { describe, expect, it } from "vitest";
import {
  AuthenticationError,
  GitHubAPIError,
  NetworkError,
  ValidationError,
  toNaturalLanguageError,
} from "../src/errors/index.js";

describe("Errores", () => {
  it("transforma ValidationError", () => {
    expect(toNaturalLanguageError(new ValidationError("Nombre inválido"))).toBe("Nombre inválido");
  });

  it("transforma 404 a lenguaje natural", () => {
    const error = new GitHubAPIError("Not Found", 404);
    expect(toNaturalLanguageError(error, '"demo"')).toContain("no fue encontrado");
  });

  it("transforma autenticación", () => {
    expect(toNaturalLanguageError(new AuthenticationError())).toContain("GITHUB_TOKEN");
  });

  it("transforma NetworkError", () => {
    expect(toNaturalLanguageError(new NetworkError())).toContain("conectar con GitHub");
  });
});
