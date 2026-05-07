import { ForbiddenException } from '@nestjs/common';

/**
 * Utility to apply center scoping to Prisma queries.
 * Ensures users only see data belonging to centers they are authorized for.
 */
export class CenterScope {
  private static hasExplicitCenterScope(user: any) {
    return Array.isArray(user?.allowedCenterIds) && user.allowedCenterIds.length > 0;
  }

  /**
   * Generates a where clause for center filtering.
   * If the user is SUPER_ADMIN, it typically bypasses filtering (unless centerId is explicitly provided).
   */
  static filter(
    user: any,
    centerIdField: string = 'centerId',
    requestedCenterId?: string | null,
  ) {
    const normalizedCenterId =
      requestedCenterId && requestedCenterId !== 'all'
        ? requestedCenterId
        : null;

    if (normalizedCenterId) {
      this.validate(user, normalizedCenterId);
      return { [centerIdField]: normalizedCenterId };
    }

    // A global SUPER_ADMIN without explicit center assignments can see everything.
    // If the active role is assigned to centers, "all" means all assigned centers.
    if (user.role === 'SUPER_ADMIN' && !this.hasExplicitCenterScope(user)) {
      return {};
    }

    const allowedIds = user.allowedCenterIds || [];

    return {
      [centerIdField]: {
        in: allowedIds,
      },
    };
  }

  /**
   * Validates if a user has access to a specific center.
   * Useful for Detail view or Create/Update operations.
   */
  static validate(user: any, targetCenterId: string) {
    if (user.role === 'SUPER_ADMIN' && !this.hasExplicitCenterScope(user)) {
      return true;
    }

    const allowedIds = user.allowedCenterIds || [];
    if (!allowedIds.includes(targetCenterId)) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập dữ liệu của trung tâm này',
      );
    }
    return true;
  }
}
