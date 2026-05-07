import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CenterScope } from '../../common/utils/center-scope.utils';

@Injectable()
export class RenewalService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findRenewalCandidates(
    where: any,
    threshold: number = 20,
    keyword?: string,
  ) {
    const searchKeyword = keyword?.trim();
    const today = new Date();

    const contracts = await this.prisma.contract.findMany({
      where: {
        ...where,
        status: 'ACTIVE',
        student: searchKeyword
          ? {
              OR: [
                { fullName: { contains: searchKeyword, mode: 'insensitive' } },
                { code: { contains: searchKeyword, mode: 'insensitive' } },
                {
                  studentPhone: {
                    contains: searchKeyword,
                    mode: 'insensitive',
                  },
                },
                {
                  relations: {
                    some: {
                      parent: {
                        phone: {
                          contains: searchKeyword,
                          mode: 'insensitive',
                        },
                      },
                    },
                  },
                },
              ],
            }
          : undefined,
      },
      include: {
        student: {
          include: {
            attendance: {
              where: { status: { in: ['PRESENT', 'LATE'] } },
              select: { classId: true, date: true },
            },
            classStudent: {
              where: { status: 'ACTIVE' },
              include: {
                class: {
                  include: { schedules: true },
                },
              },
              take: 1,
            },
            relations: {
              where: { isPrimaryContact: true },
              include: { parent: { select: { phone: true } } },
              take: 1,
            },
          },
        },
        center: { select: { id: true, name: true } },
        details: {
          include: { plan: { select: { sessionCount: true, name: true } } },
        },
      },
      orderBy: { endDate: 'asc' },
    });

    const candidates = contracts.map((contract) => {
      let totalSessions = Number(contract.contractedSessions || 0);
      if (totalSessions === 0) {
        totalSessions = contract.details.reduce((sum, detail) => {
          return sum + (detail.plan?.sessionCount || 0) * detail.quantity;
        }, 0);
      }

      const activeClass = contract.student.classStudent?.[0]?.class;
      const activeClassIds = new Set(
        contract.student.classStudent.map((item) => item.classId),
      );
      const uniqueAttendance = new Set<string>();

      contract.student.attendance.forEach((attendance) => {
        if (attendance.date < contract.startDate || attendance.date > today) {
          return;
        }
        if (
          activeClassIds.size > 0 &&
          !activeClassIds.has(attendance.classId)
        ) {
          return;
        }

        const dateKey = attendance.date.toISOString().split('T')[0];
        uniqueAttendance.add(`${attendance.classId}_${dateKey}`);
      });

      const usedSessions = uniqueAttendance.size;
      const remainingSessions = Math.max(0, totalSessions - usedSessions);

      let estimatedEndDate: Date | null = null;
      if (
        activeClass &&
        activeClass.schedules.length > 0 &&
        remainingSessions > 0
      ) {
        const sessionsPerWeek = activeClass.schedules.length;
        const weeksLeft = Math.ceil(remainingSessions / sessionsPerWeek);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + weeksLeft * 7);
        estimatedEndDate = endDate;
      }

      return {
        id: contract.id,
        code: contract.code,
        status: contract.status,
        endDate: contract.endDate,
        center: contract.center,
        student: {
          id: contract.student.id,
          fullName: contract.student.fullName,
          code: contract.student.code,
          phone:
            contract.student.studentPhone ||
            contract.student.relations[0]?.parent?.phone ||
            null,
        },
        planName:
          contract.details[0]?.plan?.name ||
          contract.feePackage ||
          contract.productName ||
          'N/A',
        feePackage: contract.feePackage,
        totalSessions,
        usedSessions,
        remainingSessions,
        estimatedEndDate,
        className: activeClass?.name || 'Chưa vào lớp',
        urgencyLevel: remainingSessions <= 7 ? 'CRITICAL' : 'POTENTIAL',
      };
    });

    return candidates
      .filter(
        (candidate) =>
          candidate.totalSessions > 0 &&
          candidate.remainingSessions <= threshold,
      )
      .sort((a, b) => a.remainingSessions - b.remainingSessions);
  }

  async createRenewal(contractId: string, userId: string, user: any) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: { student: { select: { fullName: true, code: true } } },
    });

    if (!contract) throw new NotFoundException('Hợp đồng không tồn tại');

    CenterScope.validate(user, contract.centerId);

    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Chỉ có thể gia hạn hợp đồng đang hoạt động',
      );
    }

    const existingRenewal = await this.prisma.renewal.findFirst({
      where: {
        oldContractId: contractId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existingRenewal) {
      throw new BadRequestException(
        'Hợp đồng này đã có bản ghi gia hạn đang xử lý',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const renewal = await tx.renewal.create({
        data: {
          oldContractId: contractId,
          status: 'PENDING',
          notes: `Tạo gia hạn tự động từ hợp đồng ${contract.code}`,
        },
      });

      await this.auditService.trackChange(
        userId,
        'Renewal',
        renewal.id,
        'CREATE',
        renewal,
        null,
        contract.centerId,
      );

      await this.ensureRenewalTask(tx, {
        title: 'Tư vấn gia hạn hợp đồng',
        description: `Hợp đồng ${contract.code} của ${contract.student.fullName} đã được đưa vào danh sách gia hạn. Cần liên hệ phụ huynh và cập nhật phương án tái tục.`,
        dueDate: this.daysFromNow(2),
        priority: 'HIGH',
        assigneeId: contract.ownerId || userId,
        studentId: contract.studentId,
        contractId: contract.id,
      });

      return renewal;
    });
  }

  private daysFromNow(days: number) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private async ensureRenewalTask(
    tx: any,
    data: {
      title: string;
      description: string;
      dueDate: Date;
      priority: string;
      assigneeId: string;
      studentId: string;
      contractId: string;
    },
  ) {
    const existing = await tx.task.findFirst({
      where: {
        title: data.title,
        contractId: data.contractId,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { id: true },
    });

    if (existing) return existing;

    return tx.task.create({ data });
  }
}
