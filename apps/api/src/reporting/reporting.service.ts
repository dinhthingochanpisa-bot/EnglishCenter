import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CenterScope } from '../common/utils/center-scope.utils';

@Injectable()
export class ReportingService {
  constructor(private prisma: PrismaService) {}

  async getExecutiveDashboard(user: any) {
    const where = this.getExecutiveScope(user);
    const centerWhere = this.getExecutiveScope(user, 'id');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      leadsTotal,
      leadsByStageRaw,
      leadsTrendRaw,
      contractsThisMonth,
      contractsTrendRaw,
      cashInThisMonth,
      cashTrendRaw,
      totalOutstanding,
      receivablesByStatusRaw,
      activeStudents,
      activeClasses,
      refireStudents,
      renewalCandidates,
      renewalDueContracts,
      activeClassCapacity,
      realExamTrendRaw,
      mockExamTrendRaw,
      centerBreakdown,
    ] = await Promise.all([
      // Total leads
      this.prisma.lead.count({ where }),

      // Leads by stage
      this.prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),

      this.prisma.lead.findMany({
        where: { ...where, createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),

      // Contracts this month
      this.prisma.contract.count({
        where: { ...where, createdAt: { gte: startOfMonth } },
      }),

      this.prisma.contract.findMany({
        where: { ...where, createdAt: { gte: trendStart } },
        select: { createdAt: true, finalAmount: true },
      }),

      // Cash-in this month (sum of payments)
      this.prisma.payment.aggregate({
        where: { ...where, paidAt: { gte: startOfMonth }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),

      this.prisma.payment.findMany({
        where: { ...where, paidAt: { gte: trendStart }, status: 'COMPLETED' },
        select: { paidAt: true, amount: true },
      }),

      // Total outstanding (sum of remainingAmount > 0)
      this.prisma.paymentSchedule.aggregate({
        where: { 
          contract: { ...where }, 
          remainingAmount: { gt: 0 },
          status: { notIn: ['CANCELLED', 'WAIVED'] } 
        },
        _sum: { remainingAmount: true },
      }),

      this.prisma.paymentSchedule.findMany({
        where: {
          contract: { ...where },
          remainingAmount: { gt: 0 },
          status: { notIn: ['CANCELLED', 'WAIVED'] },
        },
        select: { status: true, remainingAmount: true },
      }),

      // Active students
      this.prisma.student.count({
        where: { ...where, status: 'ACTIVE' },
      }),

      // Active classes
      this.prisma.class.count({
        where: { ...where, status: 'ACTIVE' },
      }),

      this.prisma.student.count({
        where: { ...where, status: 'RENEWAL_CANDIDATE' },
      }),

      // Contracts ending in 30 days (renewal candidates)
      this.prisma.contract.count({
        where: {
          ...where,
          status: 'ACTIVE',
          endDate: { gte: now, lte: thirtyDaysFromNow },
        },
      }),

      this.prisma.contract.findMany({
        where: {
          ...where,
          status: 'ACTIVE',
          endDate: { gte: now, lte: thirtyDaysFromNow },
          renewalsOld: { none: { status: { in: ['PENDING', 'APPROVED'] } } },
        },
        select: { studentId: true },
      }),

      this.prisma.class.findMany({
        where: { ...where, status: 'ACTIVE' },
        select: {
          id: true,
          capacity: true,
          schedules: { select: { id: true } },
          students: {
            where: { status: 'ACTIVE' },
            select: { studentId: true },
          },
        },
      }),

      this.prisma.studentExamEvent.findMany({
        where: {
          type: 'REAL_EXAM',
          scheduledAt: { gte: trendStart },
          student: where,
        },
        select: { scheduledAt: true, studentId: true },
      }),

      this.prisma.studentExamEvent.findMany({
        where: {
          type: 'MOCK_TEST',
          scheduledAt: { gte: trendStart },
          student: where,
        },
        select: { scheduledAt: true, studentId: true },
      }),

      // Student distribution by center
      this.prisma.center.findMany({
        where: centerWhere,
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: {
              students: { where: { status: 'ACTIVE' } },
              contracts: { where: { status: 'ACTIVE' } },
            },
          },
        },
      }),
    ]);

    const capacityStats = this.calculateCapacityStats(activeClassCapacity);
    const renewalDueStudents = new Set(renewalDueContracts.map((item) => item.studentId)).size;

    return {
      summary: {
        leadsTotal,
        contractsThisMonth,
        cashInThisMonth: Number(cashInThisMonth._sum.amount || 0),
        totalOutstanding: Number(totalOutstanding._sum.remainingAmount || 0),
        activeStudents,
        activeClasses,
        refireStudents,
        renewalCandidates,
        renewalDueStudents,
        centerCapacityRate: capacityStats.centerCapacityRate,
        scheduleFillRate: capacityStats.scheduleFillRate,
        activeClassCapacity: capacityStats.totalClassCapacity,
        activeClassSeatsFilled: capacityStats.totalSeatsFilled,
      },
      leadsByStage: leadsByStageRaw.map((s: any) => ({
        stage: s.status,
        count: s._count.id,
      })),
      centerBreakdown: centerBreakdown.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        activeStudents: c._count.students,
        activeContracts: c._count.contracts,
      })),
      monthlyTrend: this.buildMonthlyTrend(
        trendStart,
        now,
        leadsTrendRaw,
        contractsTrendRaw,
        cashTrendRaw,
      ),
      examMonthlyTrend: this.buildExamMonthlyTrend(
        trendStart,
        now,
        realExamTrendRaw,
        mockExamTrendRaw,
      ),
      receivablesByStatus: this.buildReceivableStatus(receivablesByStatusRaw),
    };
  }

  private getExecutiveScope(user: any, centerIdField: string = 'centerId') {
    const permissions = user.permissions || [];
    const canViewSystemReport =
      user.role === 'SUPER_ADMIN' ||
      permissions.includes('*') ||
      permissions.includes('REPORTING.VIEW');

    if (canViewSystemReport) return {};
    return CenterScope.filter(user, centerIdField);
  }

  private calculateCapacityStats(
    classes: Array<{
      capacity: number;
      schedules: Array<{ id: string }>;
      students: Array<{ studentId: string }>;
    }>,
  ) {
    let totalClassCapacity = 0;
    let totalSeatsFilled = 0;
    let totalScheduleCapacity = 0;
    let totalScheduleSeatsFilled = 0;

    for (const cls of classes) {
      const capacity = Number(cls.capacity || 0);
      const filled = cls.students.length;
      const scheduleCount = Math.max(cls.schedules.length, 1);

      totalClassCapacity += capacity;
      totalSeatsFilled += filled;
      totalScheduleCapacity += capacity * scheduleCount;
      totalScheduleSeatsFilled += filled * scheduleCount;
    }

    return {
      totalClassCapacity,
      totalSeatsFilled,
      centerCapacityRate: totalClassCapacity
        ? Math.round((totalSeatsFilled / totalClassCapacity) * 1000) / 10
        : 0,
      scheduleFillRate: totalScheduleCapacity
        ? Math.round((totalScheduleSeatsFilled / totalScheduleCapacity) * 1000) / 10
        : 0,
    };
  }

  private buildExamMonthlyTrend(
    start: Date,
    end: Date,
    realExams: Array<{ scheduledAt: Date; studentId: string }>,
    mockExams: Array<{ scheduledAt: Date; studentId: string }>,
  ) {
    const buckets = new Map<
      string,
      { month: string; realExamStudents: number; mockTestStudents: number }
    >();

    for (
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      cursor <= end;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      const key = this.monthKey(cursor);
      buckets.set(key, {
        month: `${String(cursor.getMonth() + 1).padStart(2, '0')}/${cursor.getFullYear()}`,
        realExamStudents: 0,
        mockTestStudents: 0,
      });
    }

    const realExamStudentsByMonth = new Map<string, Set<string>>();
    const mockTestStudentsByMonth = new Map<string, Set<string>>();

    for (const exam of realExams) {
      const key = this.monthKey(exam.scheduledAt);
      if (!realExamStudentsByMonth.has(key)) realExamStudentsByMonth.set(key, new Set());
      realExamStudentsByMonth.get(key)?.add(exam.studentId);
    }

    for (const exam of mockExams) {
      const key = this.monthKey(exam.scheduledAt);
      if (!mockTestStudentsByMonth.has(key)) mockTestStudentsByMonth.set(key, new Set());
      mockTestStudentsByMonth.get(key)?.add(exam.studentId);
    }

    for (const [key, bucket] of buckets.entries()) {
      bucket.realExamStudents = realExamStudentsByMonth.get(key)?.size || 0;
      bucket.mockTestStudents = mockTestStudentsByMonth.get(key)?.size || 0;
    }

    return [...buckets.values()];
  }

  private buildMonthlyTrend(
    start: Date,
    end: Date,
    leads: Array<{ createdAt: Date }>,
    contracts: Array<{ createdAt: Date; finalAmount: any }>,
    payments: Array<{ paidAt: Date; amount: any }>,
  ) {
    const buckets = new Map<
      string,
      { month: string; leads: number; contracts: number; contractValue: number; cashIn: number }
    >();

    for (
      let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      cursor <= end;
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    ) {
      const key = this.monthKey(cursor);
      buckets.set(key, {
        month: `${String(cursor.getMonth() + 1).padStart(2, '0')}/${cursor.getFullYear()}`,
        leads: 0,
        contracts: 0,
        contractValue: 0,
        cashIn: 0,
      });
    }

    for (const lead of leads) {
      const bucket = buckets.get(this.monthKey(lead.createdAt));
      if (bucket) bucket.leads += 1;
    }

    for (const contract of contracts) {
      const bucket = buckets.get(this.monthKey(contract.createdAt));
      if (bucket) {
        bucket.contracts += 1;
        bucket.contractValue += Number(contract.finalAmount || 0);
      }
    }

    for (const payment of payments) {
      const bucket = buckets.get(this.monthKey(payment.paidAt));
      if (bucket) bucket.cashIn += Number(payment.amount || 0);
    }

    return [...buckets.values()];
  }

  private buildReceivableStatus(
    schedules: Array<{ status: string; remainingAmount: any }>,
  ) {
    const buckets = new Map<string, { status: string; count: number; amount: number }>();
    for (const schedule of schedules) {
      const bucket = buckets.get(schedule.status) || {
        status: schedule.status,
        count: 0,
        amount: 0,
      };
      bucket.count += 1;
      bucket.amount += Number(schedule.remainingAmount || 0);
      buckets.set(schedule.status, bucket);
    }
    return [...buckets.values()].sort((a, b) => b.amount - a.amount);
  }

  private monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  async getSalesDashboard(user: any) {
    const where = CenterScope.filter(user);
    const myLeadsWhere = {
      ...where,
      ownerId: user.userId,
    };

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const [myLeads, leadsByStageRaw, wonThisMonth, convertedThisMonth] =
      await Promise.all([
        // My open leads (not converted or lost)
        this.prisma.lead.count({
          where: { ...myLeadsWhere, status: { notIn: ['CONVERTED', 'LOST'] } },
        }),

        // My leads by stage
        this.prisma.lead.groupBy({
          by: ['status'],
          where: myLeadsWhere,
          _count: { id: true },
        }),

        // Won (Converted) leads this month
        this.prisma.lead.count({
          where: {
            ...myLeadsWhere,
            status: 'CONVERTED',
            updatedAt: { gte: startOfMonth },
          },
        }),

        // Converted in last 7 days
        this.prisma.lead.count({
          where: {
            ...myLeadsWhere,
            status: 'CONVERTED',
            updatedAt: { gte: sevenDaysAgo },
          },
        }),
      ]);

    return {
      myLeads,
      leadsByStage: leadsByStageRaw.map((s: any) => ({
        stage: s.status,
        count: s._count.id,
      })),
      wonThisMonth,
      convertedThisMonth,
    };
  }

  async getAcademicDashboard(user: any) {
    const where = CenterScope.filter(user);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const [activeClasses, classByStatusRaw, atRiskStudents, recentAttendanceRaw] =
      await Promise.all([
        // Active classes
        this.prisma.class.count({ where: { ...where, status: 'ACTIVE' } }),

        // Classes by status
        this.prisma.class.groupBy({
          by: ['status'],
          where,
          _count: { id: true },
        }),

        // Students on HOLD (at risk)
        this.prisma.student.count({
          where: { ...where, status: 'HOLD' },
        }),

        // Recent attendance (last 7 days) — count absent/late
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: {
            class: { ...where },
            date: { gte: sevenDaysAgo },
          },
          _count: { id: true },
        }),
      ]);

    return {
      activeClasses,
      atRiskStudents,
      classByStatus: classByStatusRaw.map((s: any) => ({
        status: s.status,
        count: s._count.id,
      })),
      recentAttendance: recentAttendanceRaw.map((a: any) => ({
        status: a.status,
        count: a._count.id,
      })),
    };
  }

  async getFamilyInsights(user: any) {
    const where = CenterScope.filter(user);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    // Families with active children in centers the user has access to
    const familiesWithChildren = await this.prisma.family.findMany({
      where: {
        relations: {
          some: {
            student: { ...where, status: 'ACTIVE' },
          },
        },
      },
      include: {
        relations: {
          where: {
            student: { ...where, status: 'ACTIVE' },
          },
          include: {
            student: {
              include: {
                contracts: {
                  where: {
                    ...where,
                    status: 'ACTIVE',
                    endDate: { gte: now, lte: thirtyDaysFromNow },
                  },
                  select: { id: true, endDate: true, code: true },
                },
              },
            },
          },
        },
      },
      take: 20,
    });

    const familyInsights = await Promise.all(
      familiesWithChildren.map(async (family) => {
        const studentIds = family.relations.map((r) => r.studentId);
        const outstanding = await this.prisma.paymentSchedule.aggregate({
          where: {
            contract: { studentId: { in: studentIds }, ...where },
            remainingAmount: { gt: 0 },
            status: { notIn: ['CANCELLED', 'WAIVED'] },
          },
          _sum: { remainingAmount: true },
        });

        const upcomingRenewals = family.relations.flatMap(
          (r) => r.student.contracts,
        );

        return {
          familyId: family.id,
          familyName: family.name,
          activeChildren: family.relations.length,
          totalOutstanding: Number(outstanding._sum.remainingAmount || 0),
          upcomingRenewals: upcomingRenewals.length,
        };
      }),
    );

    familyInsights.sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    return {
      highBalanceFamilies: familyInsights.filter(
        (f) => f.totalOutstanding > 0,
      ),
      multiChildFamilies: familyInsights.filter(
        (f) => f.activeChildren >= 2,
      ),
      upcomingRenewalFamilies: familyInsights.filter(
        (f) => f.upcomingRenewals > 0,
      ),
    };
  }

  async getNotifications(user: any) {
    const where = CenterScope.filter(user);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);

    const [overdueReceivables, courseEndWarnings] = await Promise.all([
      // Overdue receivables
      this.prisma.paymentSchedule.findMany({
        where: {
          contract: { ...where },
          status: 'OVERDUE',
          remainingAmount: { gt: 0 },
        },
        include: {
          contract: {
            include: {
              student: { select: { fullName: true, code: true } },
              center: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),

      // Course ending in 30 days without a pending/approved renewal
      this.prisma.contract.findMany({
        where: {
          ...where,
          status: 'ACTIVE',
          endDate: { gte: now, lte: thirtyDaysFromNow },
          renewalsOld: { none: { status: { in: ['PENDING', 'APPROVED'] } } },
        },
        include: {
          student: { select: { fullName: true, code: true } },
          center: { select: { name: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 20,
      }),
    ]);

    const notifications: any[] = [
      ...overdueReceivables.map((s) => ({
        type: 'OVERDUE_RECEIVABLE',
        priority: 'HIGH',
        title: `Công nợ quá hạn: ${s.contract.student.fullName}`,
        body: `Còn nợ ${Number(s.remainingAmount).toLocaleString()} ₫ — hạn ${new Date(s.dueDate).toLocaleDateString('vi-VN')}`,
        centerId: s.contract.centerId,
        centerName: s.contract.center?.name,
        contractId: s.contractId,
        dueDate: s.dueDate,
      })),
      ...courseEndWarnings.map((c) => ({
        type: 'COURSE_END_WARNING',
        priority: 'MEDIUM',
        title: `Hợp đồng sắp hết hạn: ${c.student.fullName}`,
        body: `Hợp đồng ${c.code} kết thúc ${new Date(c.endDate).toLocaleDateString('vi-VN')}`,
        centerId: c.centerId,
        centerName: c.center?.name,
        contractId: c.id,
        dueDate: c.endDate,
      })),
    ];

    notifications.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    return {
      total: notifications.length,
      items: notifications,
    };
  }
}
