import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { MODULE_KEY } from '../decorators/require-module.decorator';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const moduleCode = this.reflector.getAllAndOverride<string>(MODULE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (!moduleCode) {
        return true;
      }

      // Check if module is enabled globally (centerId = null)
      const moduleSetting = await this.prisma.moduleSetting.findFirst({
        where: {
          module: { code: moduleCode },
          centerId: null, // Check global setting
        },
        select: { isEnabled: true },
      });

      if (moduleSetting && !moduleSetting.isEnabled) {
        throw new ForbiddenException(
          `Tính năng '${moduleCode}' hiện đang khóa hoặc không khả dụng.`,
        );
      }

      return true;
    } catch (error) {
      console.error('[MODULE ERROR] ModuleGuard:', error);
      throw error;
    }
  }
}
