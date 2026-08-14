import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        `Copiá .env.example a .env y completá los valores.`,
    );
  }
  return value;
}

export const env = {
  GITHUB_TOKEN: required("GITHUB_TOKEN"),
  GITHUB_MAX_RETRIES: Number(process.env.GITHUB_MAX_RETRIES ?? 3),
};
