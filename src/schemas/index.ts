import { z } from "zod";

export const repositoryNameSchema = z
  .string()
  .trim()
  .min(3, "El nombre del repositorio debe tener al menos 3 caracteres")
  .max(100, "El nombre del repositorio no puede superar los 100 caracteres")
  .regex(
    /^[A-Za-z0-9-]+$/,
    "El nombre del repositorio solo puede contener letras, números y guiones"
  );

export const createRepositorySchema = z.object({
  name: repositoryNameSchema,
  description: z
    .string()
    .trim()
    .max(350, "La descripción no puede superar los 350 caracteres")
    .optional(),
});

export const createIssueSchema = z.object({
  owner: z.string().trim().min(1, "El owner es obligatorio"),
  repo: repositoryNameSchema,
  title: z.string().trim().min(1, "El título del issue es obligatorio").max(256),
  body: z.string().trim().max(65536).optional(),
});

export const listRepositoriesSchema = z.object({
  visibility: z.enum(["all", "public", "private"]).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
});

export const createCommitSchema = z.object({
  owner: z.string().trim().min(1, "El owner es obligatorio"),
  repo: repositoryNameSchema,
  path: z
    .string()
    .trim()
    .min(1, "La ruta del archivo es obligatoria")
    .refine((value) => !value.startsWith("/"), "La ruta no debe comenzar con /"),
  message: z.string().trim().min(1, "El mensaje del commit es obligatorio").max(72),
  content: z.string().min(1, "El contenido del archivo es obligatorio"),
  branch: z.string().trim().min(1).optional(),
});

export const listIssuesSchema = z.object({
  owner: z.string().trim().min(1, "El owner es obligatorio"),
  repo: repositoryNameSchema,
  state: z.enum(["open", "closed", "all"]).default("open"),
  per_page: z.number().int().min(1).max(100).optional(),
});

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type ListRepositoriesInput = z.infer<typeof listRepositoriesSchema>;
export type CreateCommitInput = z.infer<typeof createCommitSchema>;
export type ListIssuesInput = z.infer<typeof listIssuesSchema>;
