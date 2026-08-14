import { listRepositoriesSchema } from "../schemas/index.js";
import { ValidationError } from "../errors/index.js";
import { listRepositories } from "../github/operations.js";
import { failure, success } from "./helpers.js";

export async function runListRepositories(input: unknown) {
  try {
    const parsed = listRepositoriesSchema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
    }

    const response = await listRepositories(parsed.data);
    const repositories = response.data.map((repo) => `- ${repo.full_name} (${repo.private ? "privado" : "público"})`);

    return success(
      repositories.length
        ? `Repositorios encontrados (${repositories.length}):\n${repositories.join("\n")}`
        : "No se encontraron repositorios."
    );
  } catch (error) {
    return failure(error);
  }
}
