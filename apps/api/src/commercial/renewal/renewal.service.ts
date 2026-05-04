import { Injectable, NotImplementedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CenterScope } from '../../common/utils/center-scope.utils';

@Injectable()
export class RenewalService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findRenewalCandidates(where: any, days: number = 30) {
    const today = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(today.getDate() + days);

    return this.prisma.contract.findMany({
      where: {
        ...where,
        status: 'ACTIVE',
        endDate: {
          gte: today,
          lte: thresholdDate,
        },
      },
      include: {
        student: { select: { id: true, fullName: true, code: true } },
        center: { select: { id: true, name: true } },
      },
      orderBy: { endDate: 'asc' },
    });
  }

  async createRenewal(contractId: string, userId: string, user: any) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) throw new NotFoundException('Hợp đồng không tồn tại');
    
    // Check center scope
    CenterScope.validate(user, contract.centerId);

    if (contract.status !== 'ACTIVE') throw new BadRequestException('Chỉ có thể gia hạn hợp đồng đang hoạt động');

    // Check if already has a pending renewal
    const existingRenewal = await this.prisma.renewal.findFirst({
      where: { oldContractId: contractId, status: { in: ['PENDING', 'APPROVED'] } }
    });
    if (existingRenewal) throw new BadRequestException('Hợp đồng này đã có bản ghi gia hạn đang xử lý');

    return this.prisma.$transaction(async (tx) => {
      const renewal = await tx.renewal.create({
        data: {
          oldContractId: contractId,
          status: 'PENDING',
          notes: `Tạo gia hạn tự động từ hợp đồng ${contract.code}`,
        }
      });

      // Audit
      await this.auditService.trackChange(userId, 'Renewal', renewal.id, 'CREATE', renewal, null, contract.centerId);

      return renewal;
    });
  }
}
