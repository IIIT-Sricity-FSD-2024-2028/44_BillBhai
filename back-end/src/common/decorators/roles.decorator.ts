import { SetMetadata } from '@nestjs/common';

/**
 * Key used to store roles in the metadata of controllers and routes.
 */
export const ROLES_KEY = 'roles';

/**
 * The @Roles() decorator allows you to define which user roles are permitted 
 * to access specific API endpoints.
 * 
 * Example: @Roles('admin', 'superuser')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
