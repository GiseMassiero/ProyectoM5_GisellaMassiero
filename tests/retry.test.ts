import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestError } from "@octokit/request-error";
import type { ListRepositoriesInput } from "../src/schemas/index.js";

vi.mock("../src/github/client.js", () => ({
    octokit: {
        rest: {
            repos: {
                listForAuthenticatedUser: vi.fn(),
            },
        },
    },
}));

import { octokit } from "../src/github/client.js";
import { listRepositories } from "../src/github/operations.js";

type ListReposResponse = Awaited<ReturnType<typeof octokit.rest.repos.listForAuthenticatedUser>>;

function makeRequestError(status: number, headers: Record<string, string> = {}): RequestError {
    const error = Object.create(RequestError.prototype) as RequestError;
    return Object.assign(error, {
        name: "HttpError",
        message: "GitHub error",
        status,
        response: {
            url: "https://api.github.com/user/repos",
            status,
            headers,
            data: {},
        },
    });
}

const emptyInput: ListRepositoriesInput = {};

describe("withRetry - el guardián de la cuota", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("reintenta ante un 429 y termina devolviendo el resultado", async () => {
        const error = makeRequestError(429, { "retry-after": "0" });
        const fakeResponse = { data: [{ name: "repo-de-prueba" }] } as unknown as ListReposResponse;

        const mockedList = vi.mocked(octokit.rest.repos.listForAuthenticatedUser);
        mockedList.mockRejectedValueOnce(error).mockResolvedValueOnce(fakeResponse);

        const result = await listRepositories(emptyInput);

        expect(mockedList).toHaveBeenCalledTimes(2);
        expect(result).toEqual(fakeResponse);
    });

    it("reintenta ante un 403 CON header de rate limit agotado", async () => {
        const error = makeRequestError(403, { "x-ratelimit-remaining": "0" });
        const fakeResponse = { data: [] } as unknown as ListReposResponse;

        const mockedList = vi.mocked(octokit.rest.repos.listForAuthenticatedUser);
        mockedList.mockRejectedValueOnce(error).mockResolvedValueOnce(fakeResponse);

        const result = await listRepositories(emptyInput);

        expect(mockedList).toHaveBeenCalledTimes(2);
        expect(result).toEqual(fakeResponse);
    });

    it("NO reintenta ante un 403 SIN header de rate limit (es de permisos)", async () => {
        const error = makeRequestError(403, {});

        const mockedList = vi.mocked(octokit.rest.repos.listForAuthenticatedUser);
        mockedList.mockRejectedValue(error);

        await expect(listRepositories(emptyInput)).rejects.toThrow();
        expect(mockedList).toHaveBeenCalledTimes(1);
    });
});