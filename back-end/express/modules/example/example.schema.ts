/**
 * Example Module Schemas / Types
 *
 * Responsibilities:
 * - Data Transfer Objects (DTOs) and request/response type definitions.
 * - Validation schemas (e.g. Zod / Joi / class-validator to be attached in P3).
 *
 * NOTE: Do NOT place business logic or database queries here.
 */

export interface CreateExampleDto {
  name: string;
  description?: string;
}

export interface UpdateExampleDto {
  name?: string;
  description?: string;
}

export interface ExampleItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}
