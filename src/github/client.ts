import { Octokit } from "@octokit/rest";
import { env } from "../config/env.js";
import { AuthenticationError } from "../errors/index.js";

// `env` ya valida (con un mensaje claro) que GITHUB_TOKEN exista antes
// de llegar acá — ver src/config/env.ts.
export const octokit = new Octokit({
  auth: env.GITHUB_TOKEN,
});

export async function getAuthenticatedUser() {
  try {
    return await octokit.rest.users.getAuthenticated();
  } catch (error) {
    if (isHttpError(error, 401)) {
      throw new AuthenticationError();
    }
    throw error;
  }
}

function isHttpError(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === status
  );
}

export async function verifyAuth() {
  const response = await getAuthenticatedUser();
  return response.data;
}
