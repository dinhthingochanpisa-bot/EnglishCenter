import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    actorId: string,
    entityType: string,
    entityId: string,
    action: string,
    afterData: any,
    beforeData?: any,
    centerId?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        entityType,
        entityId,
        action,
        ...(beforeData !== undefined ? { beforeData } : {}),
        ...(afterData !== undefined ? { afterData } : {}),
        ...(centerId ? { centerId } : {}),
      },
    });
  }

  // Helper for tracking changes specifically
  async trackChange(
    actorId: string,
    entityType: string,
    entityId: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    afterData: any,
    beforeData?: any,
    centerId?: string,
  ) {
    return this.log(
      actorId,
      entityType,
      entityId,
      action,
      afterData,
      beforeData,
      centerId,
    );
  }
}
