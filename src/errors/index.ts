export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class GitHubAPIError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "GitHubAPIError";
  }
}

export class AuthenticationError extends GitHubAPIError {
  constructor(message = "La autenticación con GitHub falló. Verifica tu GITHUB_TOKEN.") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

export class NetworkError extends Error {
  constructor(message = "No se pudo conectar con GitHub. Verifica tu conexión e intenta nuevamente.") {
    super(message);
    this.name = "NetworkError";
  }
}

export function toNaturalLanguageError(error: unknown, context = ""): string {
  if (error instanceof ValidationError) {
    return error.message;
  }

  if (error instanceof AuthenticationError) {
    return error.message;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof GitHubAPIError) {
    if (error.status === 404) {
      return context
        ? `El recurso ${context} no fue encontrado. Verifica el nombre e intenta de nuevo.`
        : "El recurso solicitado no fue encontrado. Verifica los datos e intenta de nuevo.";
    }

    if (error.status === 403 || error.status === 429) {
      return "GitHub rechazó temporalmente la solicitud, posiblemente por límites de uso. Espera unos segundos e intenta nuevamente.";
    }

    if (error.status === 422) {
      return "GitHub no pudo procesar los datos enviados. Revisa los parámetros e intenta nuevamente.";
    }

    return `GitHub devolvió un error${error.status ? ` (${error.status})` : ""}: ${error.message}`;
  }

  return "Ocurrió un error inesperado al comunicarse con GitHub.";
}
