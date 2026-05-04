import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CenterGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) return false;

    // SUPER_ADMIN bypasses center scoping
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    const centerId =
      request.params.centerId ||
      request.query.centerId ||
      request.body.centerId;

    if (!centerId) {
      // If no centerId is provided, we might allow the request
      // but the service should enforce scoping during data fetch
      return true;
    }

    const userCenter = await this.prisma.userCenter.findUnique({
      where: {
        userId_centerId: {
          userId: user.userId,
          centerId: centerId as string,
        },
      },
    });

    if (!userCenter) {
      throw new ForbiddenException(
        'Bạn không có quyền truy cập vào trung tâm này',
      );
    }

    return true;
  }
}
