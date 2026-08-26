import { z } from 'zod';
import { ROLES } from '../../middleware/rbac.middleware';
import { SafeUser, User } from '../../data/entities';

/** Users Module Schemas - DTOs and zod validation only. No business logic. */

const emailSchema = z
  .email('email must be a valid address')
  .regex(/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/, 'email must be a valid address');

export const listUsersQuerySchema = z.object({
  companyId: z.string().optional(),
  role: z.string().optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().regex(/^USR-\d+$/i, 'User id must look like USR-001'),
});

export const createUserSchema = z.object({
  companyId: z.string().min(1, 'companyId is required'),
  name: z.string().min(2, 'name must be at least 2 characters'),
  role: z.enum(ROLES),
  email: emailSchema,
  mobileNo: z
    .string()
    .regex(/^\d{10}$/, 'mobileNo must be exactly 10 digits'),
  username: z
    .string()
    .min(3, 'username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'username may only contain letters, digits, dot, underscore or hyphen'),
  password: z.string().min(6, 'password must be at least 6 characters'),
  status: z.string().optional(),
});

export const updateUserSchema = createUserSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field must be supplied' },
);

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type { SafeUser, User };

export interface DeleteUserResult {
  message: string;
  user: SafeUser;
}
