import { Injectable, NotImplementedException, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
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
          include: { student: { select: { fullName: true } } }
        },
        center: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
    });
  }

  async create(data: CreatePaymentDto, userId: string, user: any) {
    const { contractId, amount, method, type, notes } = data;

    // 1. Chặn amount <= 0
    if (Number(amount) <= 0) {
      throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0');
    }

    // 2. Fetch Contract and validate center scope
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        paymentSchedule: {
          where: { remainingAmount: { gt: 0 } },
          orderBy: { dueDate: 'asc' },
        }
      }
    });

    if (!contract) throw new NotFoundException('Hợp đồng không tồn tại');
    
    // Check center scope
    CenterScope.validate(user, contract.centerId);

    // 3. Tính tổng nợ còn lại
    const totalRemaining = contract.paymentSchedule.reduce((sum, s) => sum + Number(s.remainingAmount), 0);
    
    // Nếu hết nợ, không cho tạo payment
    if (totalRemaining <= 0) {
      throw new BadRequestException('Hợp đồng này đã hoàn thành thanh toán, không còn nợ');
    }

    // Chặn payment vượt outstanding
    if (Number(amount) > totalRemaining) {
      throw new BadRequestException(`Số tiền thanh toán (${Number(amount).toLocaleString()} ₫) vượt quá tổng nợ còn lại (${totalRemaining.toLocaleString()} ₫)`);
    }

    // 4. Execute Transaction for FIFO Allocation
    return this.prisma.$transaction(async (tx) => {
      // Create the payment record
      const payment = await tx.payment.create({
        data: {
          contractId,
          centerId: contract.centerId,
          amount,
          method: method || 'TRANSFER',
          type: type || 'TUITION',
          status: 'COMPLETED',
          notes,
        }
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
              status: 'PAID'
            }
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
              status: 'PARTIAL'
            }
          });
          remainingPayment = 0;
          allocatedCount++;
        }
      }

      // Đảm bảo có ít nhất một schedule được allocate
      if (allocatedCount === 0) {
        throw new BadRequestException('Không thể phân bổ thanh toán vào bất kỳ đợt thu nào');
      }

      // 5. Audit
      await this.auditService.trackChange(userId, 'Payment', payment.id, 'CREATE', payment, null, contract.centerId);

      return payment;
    });
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
            center: { select: { name: true } },
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
      select: { studentId: true }
    });

    if (relations.length === 0) return { familyId, totalOutstanding: 0 };

    const studentIds = relations.map(r => r.studentId);

    // 2. Fetch all unpaid schedules for these students
    // We apply center scope here implicitly by filtering the contracts these students have
    const receivables = await this.prisma.paymentSchedule.findMany({
      where: {
        contract: { 
          studentId: { in: studentIds },
          // Apply center scope if not SUPER_ADMIN
          ...(user.role !== 'SUPER_ADMIN' ? { centerId: { in: user.allowedCenterIds || [] } } : {})
        },
        remainingAmount: { gt: 0 },
      },
      select: { remainingAmount: true }
    });

    const totalOutstanding = receivables.reduce((sum, r) => sum + Number(r.remainingAmount), 0);
    return { familyId, totalOutstanding };
  }
}
