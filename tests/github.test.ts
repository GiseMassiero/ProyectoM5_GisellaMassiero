import { describe, expect, it, vi } from "vitest";

const createForAuthenticatedUser = vi.fn();
const listForAuthenticatedUser = vi.fn();

vi.mock("../src/github/client.js", () => ({
  octokit: {
    rest: {
      repos: {
        createForAuthenticatedUser,
        listForAuthenticatedUser,
      },
    },
  },
}));

describe("Operaciones GitHub", () => {
  it("mockea la creación de un repositorio", async () => {
    createForAuthenticatedUser.mockResolvedValueOnce({
      data: { full_name: "GiseMassiero/demo", html_url: "https://github.com/GiseMassiero/demo" },
    });

    const { createRepository } = await import("../src/github/operations.js");
    const response = await createRepository({ name: "demo" });

    expect(createForAuthenticatedUser).toHaveBeenCalled();
    expect(response.data.full_name).toBe("GiseMassiero/demo");
  });

  it("mockea el listado de repositorios", async () => {
    listForAuthenticatedUser.mockResolvedValueOnce({
      data: [{ full_name: "GiseMassiero/demo" }],
    });

    const { listRepositories } = await import("../src/github/operations.js");
    const response = await listRepositories({});

    expect(listForAuthenticatedUser).toHaveBeenCalled();
    expect(response.data).toHaveLength(1);
  });
});
