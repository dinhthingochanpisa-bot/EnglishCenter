import {
  Injectable,
  NotImplementedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './payment.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CenterScope } from '../../common/utils/center-scope.utils';

@Injectable()
export class PaymentService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(where: any) {
    return this.prisma.payment.findMany({
      where,
      include: {
        contract: {
          include: { student: { select: { fullName: true } } },
        },
        center: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async getContracts(where: any) {
    return this.prisma.contract.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, code: true } },
        center: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: CreatePaymentDto, userId: string, user: any) {
    const { contractId, amount, method, type, notes } = data;
    const contractLookup = String(contractId || '').trim();

    // 1. Chặn amount <= 0
    if (Number(amount) <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    // 2. Fetch Contract and validate center scope
    const contract = await this.prisma.contract.findFirst({
      where: {
        OR: [{ id: contractLookup }, { code: contractLookup }],
      },
      include: {
        student: { select: { id: true, fullName: true, code: true } },
        paymentSchedule: {
          where: { remainingAmount: { gt: 0 } },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!contract) throw new NotFoundException('Hợp đồng không tồn tại');

    // Check center scope
    CenterScope.validate(user, contract.centerId);

    // 3. Tính tổng nợ còn lại
    const totalRemaining = contract.paymentSchedule.reduce(
      (sum, s) => sum + Number(s.remainingAmount),
      0,
    );

    // Nếu hết nợ, không cho tạo payment
    if (totalRemaining <= 0) {
      throw new BadRequestException(
        'Hợp đồng này đã hoàn thành thanh toán, không còn nợ',
      );
    }

    // Chặn payment vượt outstanding
    if (Number(amount) > totalRemaining) {
      throw new BadRequestException(
        `Số tiền thanh toán (${Number(amount).toLocaleString()} ₫) vượt quá tổng nợ còn lại (${totalRemaining.toLocaleString()} ₫)`,
      );
    }

    // 4. Execute Transaction for FIFO Allocation
    return this.prisma.$transaction(async (tx) => {
      // Create the payment record
      const payment = await tx.payment.create({
        data: {
          contractId: contract.id,
          centerId: contract.centerId,
          amount,
          method: method || 'TRANSFER',
          type: type || 'TUITION',
          status: 'COMPLETED',
          notes,
        },
      });

      // FIFO Allocation
      let remainingPayment = Number(amount);
      let allocatedCount = 0;

      for (const schedule of contract.paymentSchedule) {
        if (remainingPayment <= 0) break;

        const currentRemaining = Number(schedule.remainingAmount);
        const currentPaid = Number(schedule.paidAmount);

        if (remainingPayment >= currentRemaining) {
          // Pay off this schedule entirely
          await tx.paymentSchedule.update({
            where: { id: schedule.id },
            data: {
              paidAmount: currentPaid + currentRemaining,
              remainingAmount: 0,
              status: 'PAID',
            },
          });
          remainingPayment -= currentRemaining;
          allocatedCount++;
        } else {
          // Partially pay this schedule
          await tx.paymentSchedule.update({
            where: { id: schedule.id },
            data: {
              paidAmount: currentPaid + remainingPayment,
              remainingAmount: currentRemaining - remainingPayment,
              status: 'PARTIAL',
            },
          });
          remainingPayment = 0;
          allocatedCount++;
        }
      }

      // Đảm bảo có ít nhất một schedule được allocate
      if (allocatedCount === 0) {
        throw new BadRequestException(
          'Không thể phân bổ thanh toán vào bất kỳ đợt thu nào',
        );
      }

      // 5. Audit
      await this.auditService.trackChange(
        userId,
        'Payment',
        payment.id,
        'CREATE',
        payment,
        null,
        contract.centerId,
      );

      const remainingAfterPayment = totalRemaining - Number(amount);
      const debtTaskTitle = 'Theo dõi công nợ còn lại của hợp đồng';

      if (remainingAfterPayment > 0) {
        const nextDueSchedule = await tx.paymentSchedule.findFirst({
          where: {
            contractId: contract.id,
            remainingAmount: { gt: 0 },
            status: { notIn: ['PAID', 'CANCELLED', 'WAIVED'] },
          },
          orderBy: { dueDate: 'asc' },
          select: { dueDate: true, remainingAmount: true },
        });

        await this.ensureContractTask(tx, {
          title: debtTaskTitle,
          description: `Hợp đồng ${contract.code} của ${contract.student.fullName} còn công nợ ${remainingAfterPayment.toLocaleString()} đ. Cần theo dõi đợt thu tiếp theo.`,
          dueDate: nextDueSchedule?.dueDate || this.daysFromNow(3),
          priority: 'HIGH',
          assigneeId: contract.ownerId || userId,
          studentId: contract.studentId,
          contractId: contract.id,
        });
      } else {
        await tx.task.updateMany({
          where: {
            contractId: contract.id,
            title: debtTaskTitle,
            status: { in: ['TODO', 'IN_PROGRESS'] },
          },
          data: { status: 'DONE' },
        });
      }

      return payment;
    });
  }

  private daysFromNow(days: number) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private async ensureContractTask(
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

    if (existing) {
      return tx.task.update({
        where: { id: existing.id },
        data: {
          description: data.description,
          dueDate: data.dueDate,
          priority: data.priority,
          assigneeId: data.assigneeId,
        },
      });
    }

    return tx.task.create({ data });
  }

  async getReceivables(where: any) {
    return this.prisma.paymentSchedule.findMany({
      where: {
        ...where,
        remainingAmount: { gt: 0 },
      },
      include: {
        contract: {
          include: {
            student: { select: { id: true, fullName: true, code: true } },
            center: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getFamilyReceivables(familyId: string, user: any) {
    // 1. Get all students in this family
    const relations = await this.prisma.parentStudentRelation.findMany({
      where: { familyId },
      select: { studentId: true },
    });

    if (relations.length === 0) return { familyId, totalOutstanding: 0 };

    const studentIds = relations.map((r) => r.studentId);

    // 2. Fetch all unpaid schedules for these students
    // We apply center scope here implicitly by filtering the contracts these students have
    const receivables = await this.prisma.paymentSchedule.findMany({
      where: {
        contract: {
          studentId: { in: studentIds },
          // Apply center scope if not SUPER_ADMIN
          ...(user.role !== 'SUPER_ADMIN'
            ? { centerId: { in: user.allowedCenterIds || [] } }
            : {}),
        },
        remainingAmount: { gt: 0 },
      },
      select: { remainingAmount: true },
    });

    const totalOutstanding = receivables.reduce(
      (sum, r) => sum + Number(r.remainingAmount),
      0,
    );
    return { familyId, totalOutstanding };
  }
}
