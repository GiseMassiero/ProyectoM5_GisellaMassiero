import { createRepositorySchema } from "../schemas/index.js";
import { ValidationError } from "../errors/index.js";
import { createRepository } from "../github/operations.js";
import { failure, success } from "./helpers.js";

export async function runCreateRepository(input: unknown) {
  try {
    const parsed = createRepositorySchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
    }

    const response = await createRepository(parsed.data);
    return success(`Repositorio "${response.data.full_name}" creado correctamente: ${response.data.html_url}`);
  } catch (error) {
    return failure(error);
  }
}
