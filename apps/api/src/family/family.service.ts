import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CenterScope } from '../common/utils/center-scope.utils';
import { ContractStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class FamilyService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any, search?: string) {
    const where: any = {};

    const allowedCenterIds =
      user.role === 'SUPER_ADMIN' ? null : user.allowedCenterIds;

    if (allowedCenterIds) {
      where.relations = {
        some: {
          student: {
            centerId: { in: allowedCenterIds },
          },
        },
      };
    }

    if (search) {
      const searchFilter = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      };
      if (where.relations) {
        where.AND = [searchFilter];
      } else {
        Object.assign(where, searchFilter);
      }
    }
    // but the detail view will be strictly scoped.
    return this.prisma.family.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { relations: true },
        },
      },
    });
  }

  async findOne(id: string, user: any) {
    const family = await this.prisma.family.findUnique({
      where: { id },
      include: {
        relations: {
          include: {
            student: {
              include: { center: true },
            },
            parent: true,
          },
        },
      },
    });

    if (!family) throw new NotFoundException('Family not found');

    // Scope Summary & Filtering
    const allowedCenterIds =
      user.role === 'SUPER_ADMIN' ? null : user.allowedCenterIds;

    const visibleRelations = family.relations.filter(
      (rel) =>
        !allowedCenterIds || allowedCenterIds.includes(rel.student.centerId),
    );

    if (allowedCenterIds && visibleRelations.length === 0) {
      throw new NotFoundException('Family not found or access denied');
    }

    const visibleStudentIds = visibleRelations.map((rel) => rel.studentId);

    // Summary Card Data (Scope-Aware)
    const summary = await this.calculateSummary(family.id, allowedCenterIds);

    return {
      ...family,
      relations: visibleRelations,
      summary,
      isFullyVisible:
        !allowedCenterIds ||
        family.relations.length === visibleRelations.length,
    };
  }

  private async calculateSummary(
    familyId: string,
    allowedCenterIds: string[] | null,
  ) {
    const whereStudent: any = {
      relations: { some: { familyId } },
    };
    if (allowedCenterIds) {
      whereStudent.centerId = { in: allowedCenterIds };
    }

    const students = await this.prisma.student.findMany({
      where: whereStudent,
      include: {
        contracts: {
          where: {
            status: { in: [ContractStatus.ACTIVE, ContractStatus.PENDING] },
          },
          include: {
            payments: {
              where: { status: PaymentStatus.COMPLETED },
            },
          },
        },
      },
    });

    const activeStudents = students.filter(
      (s) => s.status === 'ACTIVE',
    ).length;
    const centers = [...new Set(students.map((s) => s.centerId))];

    let totalReceivable = 0;
    let totalPaid = 0;

    students.forEach((student) => {
      if (student.contracts) {
        student.contracts.forEach((contract) => {
          totalReceivable += Number(contract.finalAmount || 0);
          if (contract.payments) {
            contract.payments.forEach((payment) => {
              totalPaid += Number(payment.amount || 0);
            });
          }
        });
      }
    });

    return {
      totalChildren: students.length,
      activeStudents,
      centersInvolved: centers.length,
      totalOutstandingBalance: totalReceivable - totalPaid,
    };
  }
}
