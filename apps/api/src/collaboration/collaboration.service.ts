import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CenterScope } from '../common/utils/center-scope.utils';

type ConversationEntityType =
  | 'LEAD'
  | 'STUDENT'
  | 'PARENT'
  | 'TASK'
  | 'CONTRACT'
  | 'CLASS';

const supportedEntityTypes = new Set<ConversationEntityType>([
  'LEAD',
  'STUDENT',
  'PARENT',
  'TASK',
  'CONTRACT',
  'CLASS',
]);

@Injectable()
export class CollaborationService {
  constructor(private prisma: PrismaService) {}

  async getThread(entityType: string, entityId: string, user: any) {
    const entity = await this.resolveEntity(entityType, entityId, user);
    const conversation = await this.ensureConversation(entity);

    const messages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id, deletedAt: null },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    return {
      conversation,
      messages,
    };
  }

  async createMessage(
    entityType: string,
    entityId: string,
    content: string,
    user: any,
  ) {
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Vui lòng nhập nội dung trao đổi');
    }
    if (trimmedContent.length > 4000) {
      throw new BadRequestException('Nội dung trao đổi tối đa 4.000 ký tự');
    }

    const entity = await this.resolveEntity(entityType, entityId, user);

    return this.prisma.$transaction(async (tx) => {
      const conversation = await this.ensureConversation(entity, tx);
      const message = await tx.message.create({
        data: {
          conversationId: conversation.id,
          authorId: user.userId || user.id,
          content: trimmedContent,
        },
        include: {
          author: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: { select: { code: true, name: true } },
            },
          },
        },
      });

      await this.ensureFollowUpTask(tx, entity, user, trimmedContent);

      await tx.auditLog.create({
        data: {
          actorId: user.userId || user.id,
          entityType: 'CONVERSATION',
          entityId: conversation.id,
          action: 'CREATE_MESSAGE',
          afterData: {
            messageId: message.id,
            linkedEntityType: entity.entityType,
            linkedEntityId: entity.entityId,
          },
          centerId: entity.centerId,
        },
      });

      return message;
    });
  }

  async updateMessage(messageId: string, content: string, user: any) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }
    if (message.authorId !== (user.userId || user.id)) {
      throw new ForbiddenException('Bạn chỉ có thể sửa tin nhắn của mình');
    }
    CenterScope.validate(user, message.conversation.centerId);

    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) {
      throw new BadRequestException('Vui lòng nhập nội dung trao đổi');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: trimmedContent, editedAt: new Date() },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, user: any) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });
    if (!message || message.deletedAt) {
      throw new NotFoundException('Không tìm thấy tin nhắn');
    }
    if (message.authorId !== (user.userId || user.id)) {
      throw new ForbiddenException('Bạn chỉ có thể xóa tin nhắn của mình');
    }
    CenterScope.validate(user, message.conversation.centerId);

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  private async resolveEntity(entityTypeInput: string, entityId: string, user: any) {
    const entityType = String(entityTypeInput || '').toUpperCase() as ConversationEntityType;
    if (!supportedEntityTypes.has(entityType)) {
      throw new BadRequestException('Loại hồ sơ trao đổi không hợp lệ');
    }

    if (!entityId?.trim()) {
      throw new BadRequestException('Thiếu mã hồ sơ trao đổi');
    }

    if (entityType === 'LEAD') {
      const lead = await this.prisma.lead.findUnique({
        where: { id: entityId },
        select: { id: true, centerId: true, prospectiveStudentName: true, parent: { select: { fullName: true } } },
      });
      if (!lead) throw new NotFoundException('Không tìm thấy lead');
      CenterScope.validate(user, lead.centerId);
      return {
        entityType,
        entityId,
        centerId: lead.centerId,
        title: lead.prospectiveStudentName || lead.parent?.fullName || 'Trao đổi lead',
        leadId: lead.id,
      };
    }

    if (entityType === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { id: entityId },
        select: { id: true, centerId: true, fullName: true, code: true },
      });
      if (!student) throw new NotFoundException('Không tìm thấy học sinh');
      CenterScope.validate(user, student.centerId);
      return {
        entityType,
        entityId,
        centerId: student.centerId,
        title: `${student.fullName} (${student.code})`,
        studentId: student.id,
      };
    }

    if (entityType === 'PARENT') {
      const parent = await this.prisma.parent.findUnique({
        where: { id: entityId },
        include: {
          relations: {
            include: { student: { select: { centerId: true } } },
            take: 1,
          },
          leads: { select: { centerId: true }, take: 1 },
        },
      });
      if (!parent) throw new NotFoundException('Không tìm thấy phụ huynh');
      const centerId = parent.relations[0]?.student.centerId || parent.leads[0]?.centerId;
      if (!centerId) {
        throw new BadRequestException('Phụ huynh chưa gắn trung tâm để trao đổi nội bộ');
      }
      CenterScope.validate(user, centerId);
      return {
        entityType,
        entityId,
        centerId,
        title: parent.fullName,
        parentId: parent.id,
      };
    }

    if (entityType === 'TASK') {
      const task = await this.prisma.task.findUnique({
        where: { id: entityId },
        include: {
          lead: { select: { centerId: true } },
          opportunity: { include: { lead: { select: { centerId: true } } } },
          student: { select: { centerId: true } },
          contract: { select: { centerId: true } },
          class: { select: { centerId: true } },
        },
      });
      if (!task) throw new NotFoundException('Không tìm thấy task');
      const centerId =
        task.lead?.centerId ||
        task.opportunity?.lead.centerId ||
        task.student?.centerId ||
        task.contract?.centerId ||
        task.class?.centerId;
      if (!centerId) throw new BadRequestException('Task chưa gắn trung tâm');
      CenterScope.validate(user, centerId);
      return {
        entityType,
        entityId,
        centerId,
        title: task.title,
        taskId: task.id,
      };
    }

    if (entityType === 'CONTRACT') {
      const contract = await this.prisma.contract.findUnique({
        where: { id: entityId },
        include: { student: { select: { fullName: true } } },
      });
      if (!contract) throw new NotFoundException('Không tìm thấy hợp đồng');
      CenterScope.validate(user, contract.centerId);
      return {
        entityType,
        entityId,
        centerId: contract.centerId,
        title: `${contract.code} - ${contract.student.fullName}`,
        contractId: contract.id,
      };
    }

    const cls = await this.prisma.class.findUnique({
      where: { id: entityId },
      select: { id: true, centerId: true, name: true, code: true },
    });
    if (!cls) throw new NotFoundException('Không tìm thấy lớp');
    CenterScope.validate(user, cls.centerId);
    return {
      entityType,
      entityId,
      centerId: cls.centerId,
      title: `${cls.name} (${cls.code})`,
      classId: cls.id,
    };
  }

  private async ensureConversation(entity: any, tx: any = this.prisma) {
    return tx.conversation.upsert({
      where: {
        entityType_entityId: {
          entityType: entity.entityType,
          entityId: entity.entityId,
        },
      },
      update: { title: entity.title, centerId: entity.centerId },
      create: {
        entityType: entity.entityType,
        entityId: entity.entityId,
        title: entity.title,
        centerId: entity.centerId,
        leadId: entity.leadId,
        studentId: entity.studentId,
        parentId: entity.parentId,
        taskId: entity.taskId,
        contractId: entity.contractId,
        classId: entity.classId,
      },
    });
  }

  private async ensureFollowUpTask(tx: any, entity: any, user: any, content: string) {
    if (!entity.leadId && !entity.studentId && !entity.contractId && !entity.classId) {
      return;
    }

    const title = `Trao đổi nội bộ cần theo dõi: ${entity.title}`;
    const existing = await tx.task.findFirst({
      where: {
        title,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        OR: [
          entity.leadId ? { leadId: entity.leadId } : undefined,
          entity.studentId ? { studentId: entity.studentId } : undefined,
          entity.contractId ? { contractId: entity.contractId } : undefined,
          entity.classId ? { classId: entity.classId } : undefined,
        ].filter(Boolean),
      },
      select: { id: true },
    });
    if (existing) return existing;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    return tx.task.create({
      data: {
        title,
        description: `Có trao đổi nội bộ mới cần theo dõi: ${content.slice(0, 240)}`,
        dueDate,
        priority: 'MEDIUM',
        assigneeId: user.userId || user.id,
        leadId: entity.leadId,
        studentId: entity.studentId,
        contractId: entity.contractId,
        classId: entity.classId,
      },
    });
  }
}
