import { createIssueSchema } from "../schemas/index.js";
import { ValidationError } from "../errors/index.js";
import { createIssue } from "../github/operations.js";
import { failure, success } from "./helpers.js";

export async function runCreateIssue(input: unknown) {
  try {
    const parsed = createIssueSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
    }

    const response = await createIssue(parsed.data);
    return success(`Issue #${response.data.number} creado correctamente: ${response.data.html_url}`);
  } catch (error) {
    return failure(error, `"${String((input as { repo?: string })?.repo ?? "")}"`);
  }
}
