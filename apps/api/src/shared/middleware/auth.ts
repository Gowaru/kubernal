import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../errors.js';
import type { UserRole } from '@kubernal/shared-types';
import { hasRole } from '@kubernal/shared-types';

export function requireAuth() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    next();
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const userRole = req.user.role as UserRole;
    const hasPermission = roles.some(role => hasRole(userRole, role));
    if (!hasPermission) {
      throw new ForbiddenError(
        `Insufficient permissions. Required role: ${roles.join(' or ')}. Your role: ${userRole}`,
      );
    }
    next();
  };
}