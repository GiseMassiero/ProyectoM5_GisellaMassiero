import { listIssuesSchema } from "../schemas/index.js";
import { ValidationError } from "../errors/index.js";
import { listIssues } from "../github/operations.js";
import { failure, success } from "./helpers.js";

export async function runListIssues(input: unknown) {
  try {
    const parsed = listIssuesSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join("; "));
    }

    const response = await listIssues(parsed.data);
    const issues = response.data
      .filter((issue) => !issue.pull_request)
      .map((issue) => `- #${issue.number}: ${issue.title}`);

    return success(
      issues.length
        ? `Issues encontrados (${issues.length}):\n${issues.join("\n")}`
        : "No se encontraron issues."
    );
  } catch (error) {
    return failure(error, `"${String((input as { repo?: string })?.repo ?? "")}"`);
  }
}
