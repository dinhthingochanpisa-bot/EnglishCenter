import { Injectable, NotFoundException } from '@nestjs/common';
import { CenterScope } from '../common/utils/center-scope.utils';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ParentService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, search?: string) {
    const allowedCenterIds = user.role === 'SUPER_ADMIN' ? null : user.allowedCenterIds;
    const trimmedSearch = search?.trim();

    const where: any = {
      ...(trimmedSearch
        ? {
            OR: [
              { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
              { phone: { contains: trimmedSearch, mode: 'insensitive' } },
              { email: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    if (allowedCenterIds) {
      where.AND = [
        {
          OR: [
            { relations: { some: { student: { centerId: { in: allowedCenterIds } } } } },
            { leads: { some: { centerId: { in: allowedCenterIds } } } },
          ],
        },
      ];
    }

    const parents = await this.prisma.parent.findMany({
      where,
      include: {
        relations: {
          where: allowedCenterIds
            ? { student: { centerId: { in: allowedCenterIds } } }
            : undefined,
          include: {
            student: { include: { center: true } },
            family: true,
          },
        },
        leads: {
          where: allowedCenterIds ? { centerId: { in: allowedCenterIds } } : undefined,
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        _count: {
          select: {
            relations: true,
            leads: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return parents;
  }

  async findOne(id: string, user: any) {
    const parent = await this.prisma.parent.findUnique({
      where: { id },
      include: {
        relations: {
          include: {
            student: { include: { center: true } },
            family: true,
          },
        },
      },
    });

    if (!parent) throw new NotFoundException('Parent not found');

    const allowedCenterIds = user.role === 'SUPER_ADMIN' ? null : user.allowedCenterIds;
    if (allowedCenterIds) {
      const visibleRelations = parent.relations.filter(r => allowedCenterIds.includes(r.student.centerId));
      if (visibleRelations.length === 0 && parent.relations.length > 0) {
        throw new NotFoundException('Parent not found');
      }
      parent.relations = visibleRelations;
    }

    return parent;
  }

  async update(id: string, data: any, user: any) {
    // ensure access first
    await this.findOne(id, user);

    return this.prisma.parent.update({
      where: { id },
      data,
    });
  }
}
