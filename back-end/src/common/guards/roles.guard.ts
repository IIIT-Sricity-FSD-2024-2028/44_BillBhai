import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard: The core of the Role-Based Access Control (RBAC) system.
 * 
 * It intercepts every request and:
 * 1. Checks if the route/controller has a @Roles() decorator.
 * 2. If yes, it reads the 'x-role' header from the request.
 * 3. It compares the header value with the allowed roles.
 * 4. If authorized, the request proceeds; otherwise, a 403 error is thrown.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Get the roles required for this specific endpoint
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, the route is public (accessible by anyone)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 2. Extract the 'x-role' header from the request
    const request = context.switchToHttp().getRequest();
    const rawHeaderRole = request.headers['x-role'];

    if (!rawHeaderRole) {
      throw new ForbiddenException(
        'Missing "x-role" header. Please provide your role (e.g., admin, cashier) in the request headers.',
      );
    }

    // 3. Normalize the roles for consistent comparison
    const userRole = String(rawHeaderRole).trim().toLowerCase().replace(/\s+/g, '');
    const allowedRoles = requiredRoles.map((r) => r.toLowerCase().replace(/\s+/g, ''));

    // 4. Check if the user's role is in the list of allowed roles
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException(
        `Access denied. This action requires one of the following roles: ${requiredRoles.join(', ')}. Your current role is: ${rawHeaderRole}`,
      );
    }

    return true;
  }
}
