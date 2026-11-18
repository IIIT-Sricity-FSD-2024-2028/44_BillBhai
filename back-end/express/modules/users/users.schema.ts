import { z } from 'zod';
import { ROLES } from '../../middleware/rbac.middleware';
import { SafeUser, User } from '../../data/entities';

/** Users Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

export const USER_STATUSES = ['Active', 'Suspended'] as const;

export const listUsersQuerySchema = z.object({
  companyId: z.string().optional(),
  role: z.string().optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().regex(/^USR-\d+$/i, 'User id must look like USR-001'),
});

const passwordSchema = z
  .string()
  .min(6, 'password must be at least 6 characters')
  .max(72, 'password is too long');

export const createUserSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().trim().min(2, 'name must be at least 2 characters').max(80),
  role: z.enum(ROLES),
  email: emailSchema,
  mobileNo: z
    .string()
    .transform((v) => v.replace(/\D/g, '').slice(-10))
    .refine((v) => /^[6-9]\d{9}$/.test(v), 'mobileNo must be a 10-digit Indian mobile number'),
  username: z
    .string()
    .trim()
    .min(3, 'username must be at least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, 'username may only contain letters, digits, dot, underscore or hyphen'),
  /** Leave out to have the server generate a temporary password. */
  password: passwordSchema.optional(),
  status: z.enum(USER_STATUSES).optional(),
});

export const updateUserSchema = createUserSchema
  .partial()
  .extend({ version: z.number().int().optional() })
  .refine((value) => Object.keys(value).filter((k) => k !== 'version').length > 0, {
    message: 'At least one field must be supplied',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: passwordSchema,
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type { SafeUser, User };

export interface DeleteUserResult {
  message: string;
  user: SafeUser;
}
