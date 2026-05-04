import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const isPublic = this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (isPublic) {
        return true;
      }

      const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
        'permissions',
        [context.getHandler(), context.getClass()],
      );

      // [SEC-01] Strict deny-by-default.
      // Any non-public route using PermissionsGuard must declare explicit permissions.
      if (!requiredPermissions) {
        throw new ForbiddenException(
          'Access denied by default: missing permissions metadata',
        );
      }

      const request = context.switchToHttp().getRequest();
      const { user } = request;

      if (!user) {
        return false;
      }

      // [IAM-01] SUPER_ADMIN bypasses all permission checks
      if (user.role === 'SUPER_ADMIN') {
        return true;
      }

      const hasPermission = requiredPermissions.every((permission) =>
        user.permissions?.includes(permission),
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          'Bạn không có quyền thực hiện hành động này',
        );
      }

      return true;
    } catch (error) {
      console.error('[AUTH ERROR] PermissionsGuard:', error);
      throw error;
    }
  }
}
