import { createCommitSchema } from "../schemas/index.js";
import { ValidationError } from "../errors/index.js";
import { createCommit } from "../github/operations.js";
import { failure, success } from "./helpers.js";

export async function runCreateCommit(input: unknown) {
  try {
    const parsed = createCommitSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
    }

    const result = await createCommit(parsed.data);
    return success(
      `Commit creado en la rama "${result.branch}". Archivo: ${result.path}. SHA: ${result.commitSha}. ${result.commitUrl}`,
    );
  } catch (error) {
    return failure(error, `"${String((input as { repo?: string })?.repo ?? "")}"`);
  }
}