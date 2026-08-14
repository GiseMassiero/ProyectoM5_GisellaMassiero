export function logInfo(message: string, meta?: Record<string, unknown>) {
  console.error(`[INFO] ${message}`, meta ?? "");
}

export function logError(message: string, error?: unknown) {
  console.error(`[ERROR] ${message}`, error instanceof Error ? error.message : error ?? "");
}
