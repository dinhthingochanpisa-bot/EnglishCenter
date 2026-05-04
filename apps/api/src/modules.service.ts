import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class ModulesService {
  constructor(private prisma: PrismaService) {}

  async listModules() {
    return this.prisma.moduleRegistry.findMany({
      include: {
        settings: {
          where: { centerId: null }, // Global settings
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async toggleModule(code: string, isEnabled: boolean) {
    const module = await this.prisma.moduleRegistry.findUnique({
      where: { code },
    });

    if (!module) throw new Error('Module not found');

    const existing = await this.prisma.moduleSetting.findFirst({
      where: { moduleId: module.id, centerId: null },
    });

    let result;
    let action: 'CREATE' | 'UPDATE' = 'CREATE';

    if (existing) {
      action = 'UPDATE';
      result = await this.prisma.moduleSetting.update({
        where: { id: existing.id },
        data: { isEnabled },
      });
    } else {
      result = await this.prisma.moduleSetting.create({
        data: {
          moduleId: module.id,
          centerId: null,
          isEnabled,
        },
      });
    }

    return result;
  }
}
