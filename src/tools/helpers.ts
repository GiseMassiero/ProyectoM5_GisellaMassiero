import { z } from "zod";
import { toNaturalLanguageError } from "../errors/index.js";
import type { ToolResult } from "../types.js";

export function success(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

export function failure(error: unknown, context?: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: toNaturalLanguageError(error, context) }],
  };
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input);
}
