import { z } from 'zod';

/** Auth Module Schemas - credentials in, session descriptor out. */

export const loginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

export type LoginDto = z.infer<typeof loginSchema>;

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
  email: string;
  companyId: string;
}

export interface LoginResult extends AuthenticatedUser {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}
