import { RequestError } from "@octokit/request-error";
import { octokit } from "./client.js";
import { env } from "../config/env.js";
import { AuthenticationError, GitHubAPIError, NetworkError } from "../errors/index.js";
import type {
  CreateCommitInput,
  CreateIssueInput,
  CreateRepositoryInput,
  ListIssuesInput,
  ListRepositoriesInput,
} from "../schemas/index.js";

const MAX_RETRIES = env.GITHUB_MAX_RETRIES;

function isStatusError(error: unknown): error is { status: number; message?: string } {
  return typeof error === "object" && error !== null && "status" in error;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


function isRateLimited(error: unknown): boolean {
  if (!(error instanceof RequestError)) return false;
  if (error.status === 429) return true;
  if (error.status === 403) {
    return error.response?.headers?.["x-ratelimit-remaining"] === "0";
  }
  return false;
}

function isTransientServerError(status: number | undefined): boolean {
  return status === 502 || status === 503 || status === 504;
}

function delayForAttempt(error: unknown, attempt: number): number {
  if (error instanceof RequestError) {
    const headers = error.response?.headers ?? {};
    const retryAfter = headers["retry-after"];
    if (retryAfter) return Number(retryAfter) * 1000;

    const reset = headers["x-ratelimit-reset"];
    if (reset) {
      const waitMs = Number(reset) * 1000 - Date.now();
      if (waitMs > 0) return Math.min(waitMs, 30_000);
    }
  }
  return 500 * 2 ** attempt;
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const status = isStatusError(error) ? error.status : undefined;
      const rateLimited = isRateLimited(error);
      const retryable = rateLimited || isTransientServerError(status);

      if (!retryable || attempt === MAX_RETRIES) {
        break;
      }

      const delay = delayForAttempt(error, attempt);
      console.error(
        `[retry] GitHub respondió ${status}${rateLimited ? " (rate limit)" : ""}. ` +
        `Reintentando en ${Math.round(delay)}ms...`,
      );
      await sleep(delay);
    }
  }

  throw normalizeGitHubError(lastError);
}

function normalizeGitHubError(error: unknown): Error {
  if (isStatusError(error)) {
    if (error.status === 401) return new AuthenticationError();
    return new GitHubAPIError(error.message ?? "Error de GitHub", error.status);
  }

  if (error instanceof TypeError) {
    return new NetworkError();
  }

  return error instanceof Error ? error : new GitHubAPIError("Error desconocido de GitHub");
}

export async function createRepository(input: CreateRepositoryInput) {
  return withRetry(() =>
    octokit.rest.repos.createForAuthenticatedUser({
      name: input.name,
      description: input.description,
      private: false,
    })
  );
}

export async function listRepositories(input: ListRepositoriesInput) {
  return withRetry(() =>
    octokit.rest.repos.listForAuthenticatedUser({
      visibility: input.visibility,
      per_page: input.per_page ?? 30,
      sort: "updated",
      direction: "desc",
    })
  );
}

export async function createIssue(input: CreateIssueInput) {
  return withRetry(() =>
    octokit.rest.issues.create({
      owner: input.owner,
      repo: input.repo,
      title: input.title,
      body: input.body,
    })
  );
}

export async function listIssues(input: ListIssuesInput) {
  return withRetry(() =>
    octokit.rest.issues.listForRepo({
      owner: input.owner,
      repo: input.repo,
      state: input.state,
      per_page: input.per_page ?? 30,
    })
  );
}

export async function createCommit(input: CreateCommitInput) {
  return withRetry(async () => {

    const branch =
      input.branch ??
      (
        await octokit.rest.repos.get({
          owner: input.owner,
          repo: input.repo,
        })
      ).data.default_branch;


    const { data: ref } = await octokit.rest.git.getRef({
      owner: input.owner,
      repo: input.repo,
      ref: `heads/${branch}`,
    });
    const parentCommitSha = ref.object.sha;


    const { data: parentCommit } = await octokit.rest.git.getCommit({
      owner: input.owner,
      repo: input.repo,
      commit_sha: parentCommitSha,
    });
    const baseTreeSha = parentCommit.tree.sha;


    const { data: blob } = await octokit.rest.git.createBlob({
      owner: input.owner,
      repo: input.repo,
      content: Buffer.from(input.content, "utf-8").toString("base64"),
      encoding: "base64",
    });


    const { data: tree } = await octokit.rest.git.createTree({
      owner: input.owner,
      repo: input.repo,
      base_tree: baseTreeSha,
      tree: [
        {
          path: input.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        },
      ],
    });


    const { data: commit } = await octokit.rest.git.createCommit({
      owner: input.owner,
      repo: input.repo,
      message: input.message,
      tree: tree.sha,
      parents: [parentCommitSha],
    });


    await octokit.rest.git.updateRef({
      owner: input.owner,
      repo: input.repo,
      ref: `heads/${branch}`,
      sha: commit.sha,
    });

    return {
      branch,
      path: input.path,
      commitSha: commit.sha,
      commitUrl: commit.html_url,
    };
  });
}