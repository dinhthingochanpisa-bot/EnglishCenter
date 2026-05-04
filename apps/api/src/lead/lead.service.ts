import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  LeadStatus,
  OpportunityStatus,
  InteractionLog,
  Task,
  Prisma,
  CustomerIssueStatus,
} from '@prisma/client';
import { CenterScope } from '../common/utils/center-scope.utils';
import { PhoneUtility } from '../common/utils/phone.utils';

@Injectable()
export class LeadService {
  constructor(private prisma: PrismaService) {}

  async findAll(user: any) {
    try {
      const where = CenterScope.filter(user);
      return await this.prisma.lead.findMany({
        where,
        include: {
          parent: true,
          source: true,
          owner: { select: { id: true, fullName: true, email: true } },
          center: { select: { id: true, name: true, code: true } },
          opportunities: {
            select: {
              id: true,
              status: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('[API ERROR] LeadService.findAll:', error);
      throw error;
    }
  }

  async findOne(id: string, user: any) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        parent: true,
        source: true,
        owner: { select: { id: true, fullName: true, email: true } },
        center: true,
        opportunities: {
          include: { program: true },
          orderBy: { updatedAt: 'desc' },
        },
        interactions: {
          include: { actor: { select: { fullName: true } } },
          orderBy: { timestamp: 'desc' },
        },
        tasks: {
          include: { assignee: { select: { fullName: true } } },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!lead) throw new NotFoundException('Lead not found');
    CenterScope.validate(user, lead.centerId);
    return lead;
  }

  async checkDedupe(phone: string) {
    const normalized = PhoneUtility.normalize(phone);
    // Search globally across the company
    const parents = await this.prisma.parent.findMany();
    return parents.filter(
      (p) => PhoneUtility.normalize(p.phone) === normalized,
    );
  }

  async createLead(data: any, user: any) {
    // Determine if data is legacy shape or flat DTO
    const isLegacy = data.parentData || data.leadData;
    
    const parentName = isLegacy ? data.parentData?.fullName : data.parentName;
    const phone = isLegacy ? data.parentData?.phone : data.phone;
    const email = isLegacy ? data.parentData?.email : data.email;
    
    const studentName = isLegacy ? data.leadData?.prospectiveStudentName : data.studentName;
    const centerId = isLegacy ? data.leadData?.centerId : data.centerId;
    const campaign = isLegacy ? data.leadData?.campaign : data.campaign;
    const source = isLegacy ? data.leadData?.sourceId : data.source;
    const notes = isLegacy ? data.leadData?.notes : data.notes;
    
    let targetCenterId = centerId || user.allowedCenterIds?.[0];
    if (!targetCenterId && user.role === 'SUPER_ADMIN') {
      const defaultCenter = await this.prisma.center.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      targetCenterId = defaultCenter?.id;
    }

    if (!targetCenterId) {
      throw new BadRequestException('Vui lòng chọn trung tâm trước khi tạo lead');
    }

    CenterScope.validate(user, targetCenterId);

    let parentId = data.linkParentId;

    if (!parentId) {
      // Check dedupe again for safety
      const matches = await this.checkDedupe(phone);
      if (matches.length > 0) {
        const normalizedName = parentName?.trim().toLowerCase();
        const matchedParent =
          matches.find((parent) => parent.fullName?.trim().toLowerCase() === normalizedName) ||
          matches[0];
        parentId = matchedParent.id;
      }
    }

    if (!parentId) {
      const parent = await this.prisma.parent.create({
        data: {
          fullName: parentName,
          phone: phone,
          email: email,
        },
      });
      parentId = parent.id;
    }

    const sourceId = source ? await this.resolveLeadSourceId(source) : null;

    const lead = await this.prisma.lead.create({
      data: {
        parent: { connect: { id: parentId } },
        center: { connect: { id: targetCenterId } },
        owner: { connect: { id: user.id || user.userId } },
        ...(sourceId ? { source: { connect: { id: sourceId } } } : {}),
        status: LeadStatus.NEW,
        campaign: campaign,
        prospectiveStudentName: studentName,
        target: data.target,
        grade: data.grade,
        school: data.school,
        address: data.address,
        productInterest: data.productInterest,
        demand: data.demand,
        fatherName: data.fatherName,
        fatherPhone: data.fatherPhone,
        motherName: data.motherName,
        motherPhone: data.motherPhone,
        studentPhone: data.studentPhone,
        studentBirthday: data.studentBirthday ? new Date(data.studentBirthday) : undefined,
        notes: notes,
      },
    });

    // Initial Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: lead.id,
        action: 'CREATE',
        afterData: lead as any,
        centerId: lead.centerId,
      },
    });

    return lead;
  }

  private async resolveLeadSourceId(source: string) {
    const trimmedSource = source.trim();
    if (!trimmedSource) return null;

    const byId = await this.prisma.leadSource.findUnique({
      where: { id: trimmedSource },
      select: { id: true },
    }).catch(() => null);
    if (byId) return byId.id;

    const existing = await this.prisma.leadSource.findFirst({
      where: { name: { equals: trimmedSource, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.leadSource.create({
      data: { name: trimmedSource },
      select: { id: true },
    });
    return created.id;
  }

  async convert(id: string, payload: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id } });
      if (!lead) throw new NotFoundException('Lead not found');
      if (lead.status === LeadStatus.CONVERTED)
        throw new ConflictException('Lead already converted');

      CenterScope.validate(user, lead.centerId);

      // 1. Update Lead Status
      const updatedLead = await tx.lead.update({
        where: { id },
        data: { status: LeadStatus.CONVERTED },
      });

      // 2. Create Opportunity
      const opportunity = await tx.opportunity.create({
        data: {
          leadId: id,
          programId: payload.programId,
          status: OpportunityStatus.OPEN,
          value: payload.value,
          notes: payload.notes,
        },
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entityType: 'LEAD',
          entityId: id,
          action: 'CONVERT',
          beforeData: { status: lead.status },
          afterData: {
            status: LeadStatus.CONVERTED,
            opportunityId: opportunity.id,
          },
          centerId: lead.centerId,
        },
      });

      return { lead: updatedLead, opportunity };
    });
  }

  async assign(id: string, ownerId: string, user: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    CenterScope.validate(user, lead.centerId);

    if (!ownerId) {
      throw new BadRequestException('Vui lòng chọn nhân viên phụ trách');
    }

    const assignee = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: {
        role: { select: { code: true } },
        centers: { select: { centerId: true } },
      },
    });

    if (!assignee || !assignee.isActive) {
      throw new BadRequestException('Nhân viên phụ trách không hợp lệ');
    }

    const canOwnLead =
      assignee.role?.code === 'SUPER_ADMIN' ||
      assignee.centers.some((center) => center.centerId === lead.centerId);

    if (!canOwnLead) {
      throw new ForbiddenException('Nhân viên được gán không thuộc trung tâm của lead');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { ownerId },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        parent: true,
        source: true,
        center: { select: { id: true, name: true, code: true } },
        opportunities: {
          select: {
            id: true,
            status: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: id,
        action: 'ASSIGN',
        beforeData: { ownerId: lead.ownerId },
        afterData: { ownerId },
        centerId: lead.centerId,
      },
    });

    return updated;
  }

  async getAssignableUsers(user: any, centerId?: string) {
    const allowedCenterIds = user.allowedCenterIds || [];
    const targetCenterIds =
      user.role === 'SUPER_ADMIN'
        ? centerId
          ? [centerId]
          : undefined
        : centerId
          ? [centerId]
          : allowedCenterIds;

    if (user.role !== 'SUPER_ADMIN' && centerId) {
      CenterScope.validate(user, centerId);
    }

    return this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(targetCenterIds
          ? { centers: { some: { centerId: { in: targetCenterIds } } } }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: { select: { code: true, name: true } },
        centers: {
          select: {
            centerId: true,
            center: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async createInteraction(id: string, payload: any, user: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    CenterScope.validate(user, lead.centerId);

    const interaction = await this.prisma.interactionLog.create({
      data: {
        leadId: id,
        actorId: user.id || user.userId,
        type: payload.type || 'NOTE',
        content: payload.content,
      },
      include: {
        actor: { select: { fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: id,
        action: 'CREATE_INTERACTION',
        afterData: interaction as any,
        centerId: lead.centerId,
      },
    });

    return interaction;
  }

  async updateInteraction(
    id: string,
    interactionId: string,
    payload: any,
    user: any,
  ) {
    const interaction = await this.prisma.interactionLog.findUnique({
      where: { id: interactionId },
      include: { lead: true },
    });

    if (!interaction || interaction.leadId !== id || !interaction.lead) {
      throw new NotFoundException('Interaction not found');
    }

    CenterScope.validate(user, interaction.lead.centerId);

    const updated = await this.prisma.interactionLog.update({
      where: { id: interactionId },
      data: {
        type: payload.type || interaction.type,
        content: payload.content ?? interaction.content,
      },
      include: {
        actor: { select: { fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: id,
        action: 'UPDATE_INTERACTION',
        beforeData: interaction as any,
        afterData: updated as any,
        centerId: interaction.lead.centerId,
      },
    });

    return updated;
  }

  async createTask(id: string, payload: any, user: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    CenterScope.validate(user, lead.centerId);

    const task = await this.prisma.task.create({
      data: {
        leadId: id,
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        priority: payload.priority || 'MEDIUM',
        assigneeId: payload.assigneeId || user.id || user.userId,
      },
      include: {
        assignee: { select: { fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: id,
        action: 'CREATE_TASK',
        afterData: task as any,
        centerId: lead.centerId,
      },
    });

    return task;
  }

  async updateTask(id: string, taskId: string, payload: any, user: any) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { lead: true },
    });

    if (!task || task.leadId !== id || !task.lead) {
      throw new NotFoundException('Task not found');
    }

    CenterScope.validate(user, task.lead.centerId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        title: payload.title ?? task.title,
        description: payload.description ?? task.description,
        dueDate:
          payload.dueDate === undefined
            ? task.dueDate
            : payload.dueDate
              ? new Date(payload.dueDate)
              : null,
        priority: payload.priority ?? task.priority,
        status: payload.status ?? task.status,
      },
      include: {
        assignee: { select: { fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: id,
        action: 'UPDATE_TASK',
        beforeData: task as any,
        afterData: updated as any,
        centerId: task.lead.centerId,
      },
    });

    return updated;
  }

  async getIssues(id: string, user: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    CenterScope.validate(user, lead.centerId);

    return this.prisma.customerIssue.findMany({
      where: { leadId: id },
      include: {
        owner: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createIssue(id: string, payload: any, user: any) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    CenterScope.validate(user, lead.centerId);

    if (!payload.title?.trim()) {
      throw new BadRequestException('Vui lòng nhập tiêu đề phản đối/khiếu nại');
    }

    const issue = await this.prisma.customerIssue.create({
      data: {
        type: payload.type || 'OBJECTION',
        category: payload.category || 'OTHER',
        priority: payload.priority || 'MEDIUM',
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        nextAction: payload.nextAction?.trim() || null,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        centerId: lead.centerId,
        leadId: id,
        parentId: lead.parentId,
        ownerId: payload.ownerId || lead.ownerId,
        createdById: user.id || user.userId,
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'CUSTOMER_ISSUE',
        entityId: issue.id,
        action: 'CREATE',
        afterData: issue as any,
        centerId: lead.centerId,
      },
    });

    return issue;
  }

  async updateIssue(id: string, issueId: string, payload: any, user: any) {
    const issue = await this.prisma.customerIssue.findUnique({
      where: { id: issueId },
    });
    if (!issue || issue.leadId !== id) throw new NotFoundException('Customer issue not found');
    CenterScope.validate(user, issue.centerId);

    const updated = await this.prisma.customerIssue.update({
      where: { id: issueId },
      data: {
        status: payload.status || undefined,
        priority: payload.priority || undefined,
        category: payload.category || undefined,
        title: payload.title?.trim() || undefined,
        description:
          payload.description !== undefined ? payload.description?.trim() || null : undefined,
        resolution:
          payload.resolution !== undefined ? payload.resolution?.trim() || null : undefined,
        nextAction:
          payload.nextAction !== undefined ? payload.nextAction?.trim() || null : undefined,
        dueDate:
          payload.dueDate === undefined
            ? undefined
            : payload.dueDate
              ? new Date(payload.dueDate)
              : null,
        resolvedAt:
          payload.status === CustomerIssueStatus.RESOLVED
            ? new Date()
            : payload.status === CustomerIssueStatus.OPEN || payload.status === CustomerIssueStatus.IN_PROGRESS
              ? null
              : undefined,
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'CUSTOMER_ISSUE',
        entityId: issueId,
        action: 'UPDATE',
        beforeData: issue as any,
        afterData: updated as any,
        centerId: issue.centerId,
      },
    });

    return updated;
  }

  async updateStatus(id: string, status: LeadStatus, user: any) {
    const allowedManualStatuses: LeadStatus[] = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.LOST,
    ];
    if (!allowedManualStatuses.includes(status)) {
      throw new BadRequestException('Trạng thái lead không hợp lệ trong pipeline hiện tại');
    }

    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    CenterScope.validate(user, lead.centerId);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { status },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'LEAD',
        entityId: id,
        action: 'UPDATE_STATUS',
        beforeData: { status: lead.status },
        afterData: { status },
        centerId: lead.centerId,
      },
    });

    return updated;
  }
}
