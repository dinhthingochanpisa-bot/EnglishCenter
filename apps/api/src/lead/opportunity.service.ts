import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OpportunityStatus,
  StudentStatus,
  ContractStatus,
  ContractDetail,
  Prisma,
  SalesHandoverStatus,
  AcademicResultType,
} from '@prisma/client';
import { CenterScope } from '../common/utils/center-scope.utils';
import { PhoneUtility } from '../common/utils/phone.utils';
import { ContractService } from '../commercial/contract/contract.service';

@Injectable()
export class OpportunityService {
  constructor(
    private prisma: PrismaService,
    private contractService: ContractService,
  ) {}

  async quoteContract(payload: any) {
    return this.contractService.quote({
      listPrice: Number(payload.listPrice ?? payload.amount ?? 0),
      discountPercent: payload.discountPercent,
      discountAmount: payload.discountAmount,
      discountSegmentCode: payload.discountSegmentCode,
      promotionCodes: payload.promotionCodes || [],
      contractedSessions: payload.contractedSessions
        ? Number(payload.contractedSessions)
        : undefined,
    });
  }

  async findClassesForOpportunity(id: string, user: any, centerId?: string) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { lead: true },
    });

    if (!opp) throw new NotFoundException('Opportunity not found');
    CenterScope.validate(user, opp.lead.centerId);
    const targetCenterId = centerId || opp.lead.centerId;
    CenterScope.validate(user, targetCenterId);

    return this.prisma.class.findMany({
      where: {
        centerId: targetCenterId,
        status: { in: ['ACTIVE', 'PLANNING'] },
      },
      include: {
        program: true,
        center: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { students: true } },
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  async findOne(id: string, user: any) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: {
        lead: {
          include: {
            parent: true,
            center: true,
          },
        },
        program: {
          include: { plans: true },
        },
        interactions: true,
        tasks: true,
      },
    });

    if (!opp) throw new NotFoundException('Opportunity not found');
    CenterScope.validate(user, opp.lead.centerId);
    return opp;
  }

  async getSalesHandover(id: string, user: any) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!opp) throw new NotFoundException('Opportunity not found');

    CenterScope.validate(user, opp.lead.centerId);

    let handover = await this.prisma.salesHandover.findUnique({
      where: { opportunityId: id },
    });

    if (!handover && opp.status === OpportunityStatus.WON) {
      handover = await this.prisma.salesHandover.create({
        data: {
          opportunityId: id,
          leadId: opp.leadId,
          centerId: opp.lead.centerId,
          ownerId: opp.lead.ownerId,
          status: SalesHandoverStatus.PENDING,
        },
      });
    }

    return handover;
  }

  async updateSalesHandover(id: string, payload: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({
        where: { id },
        include: { lead: true },
      });
      if (!opp) throw new NotFoundException('Opportunity not found');

      CenterScope.validate(user, opp.lead.centerId);

      if (opp.status !== OpportunityStatus.WON) {
        throw new BadRequestException(
          'Chỉ cập nhật bàn giao sau khi cơ hội đã chốt thành công',
        );
      }

      const existing = await tx.salesHandover.findUnique({
        where: { opportunityId: id },
      });

      const data = this.buildSalesHandoverData(payload);
      const completed = this.isSalesHandoverCompleted({
        ...(existing || {}),
        ...data,
      });

      const updated = await tx.salesHandover.upsert({
        where: { opportunityId: id },
        create: {
          opportunityId: id,
          leadId: opp.leadId,
          centerId: opp.lead.centerId,
          ownerId: opp.lead.ownerId,
          ...data,
          status: completed
            ? SalesHandoverStatus.COMPLETED
            : SalesHandoverStatus.IN_PROGRESS,
          completedAt: completed ? new Date() : null,
        },
        update: {
          ...data,
          status: completed
            ? SalesHandoverStatus.COMPLETED
            : SalesHandoverStatus.IN_PROGRESS,
          completedAt: completed ? new Date() : null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id || user.userId,
          entityType: 'SALES_HANDOVER',
          entityId: updated.id,
          action: existing ? 'UPDATE' : 'CREATE',
          beforeData: existing as any,
          afterData: updated as any,
          centerId: opp.lead.centerId,
        },
      });

      return updated;
    });
  }

  private buildSalesHandoverData(payload: any) {
    const boolFields = [
      'profileConfirmed',
      'paymentGuideSent',
      'paymentReceiptConfirmed',
      'scheduleRequested',
      'scheduleConfirmed',
      'academicHandoverSent',
      'welcomeSent',
      'groupsAdded',
      'zaloGroupCreated',
      'parentConfirmed',
    ];
    const stringFields = [
      'profileNotes',
      'paymentNotes',
      'schedulePreference',
      'scheduleNotes',
      'academicNotes',
      'welcomeNotes',
    ];

    const data: Record<string, any> = {};
    for (const field of boolFields) {
      if (typeof payload[field] === 'boolean') data[field] = payload[field];
    }
    for (const field of stringFields) {
      if (payload[field] !== undefined) {
        const value = payload[field]?.toString().trim();
        data[field] = value || null;
      }
    }

    return data;
  }

  private isSalesHandoverCompleted(handover: any) {
    return Boolean(
      handover.profileConfirmed &&
      handover.paymentGuideSent &&
      handover.paymentReceiptConfirmed &&
      handover.scheduleRequested &&
      handover.scheduleConfirmed &&
      handover.academicHandoverSent &&
      handover.welcomeSent &&
      handover.groupsAdded &&
      handover.zaloGroupCreated &&
      handover.parentConfirmed,
    );
  }

  async updateStatus(id: string, status: OpportunityStatus, user: any) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { lead: true },
    });
    if (!opp) throw new NotFoundException('Opportunity not found');

    CenterScope.validate(user, opp.lead.centerId);
    if (status === OpportunityStatus.WON) {
      throw new BadRequestException(
        'Vui lòng dùng luồng chốt thành công để chọn lớp và tạo hợp đồng',
      );
    }

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: { status },
    });

    if (status === OpportunityStatus.CHECKIN_DONE) {
      const assigneeId = await this.findOperationalAssignee(
        this.prisma,
        opp.lead.centerId,
        ['ACADEMIC', 'MANAGER', 'SUPER_ADMIN'],
        opp.lead.ownerId,
      );
      await this.ensureOperationalTask(this.prisma, {
        leadId: opp.leadId,
        opportunityId: id,
        assigneeId,
        title: 'Chấm/nhập kết quả test đầu vào',
        description:
          'Lead đã check-in. Giáo vụ/giáo viên cần chấm hoặc nhập kết quả test đầu vào để chuyển sang bước xếp lớp.',
        dueDate: this.daysFromNow(1),
        priority: 'HIGH',
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        entityType: 'OPPORTUNITY',
        entityId: id,
        action: 'UPDATE_STATUS',
        beforeData: { status: opp.status },
        afterData: { status },
        centerId: opp.lead.centerId,
      },
    });

    return updated;
  }

  async saveTestResult(id: string, payload: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({
        where: { id },
        include: { lead: true },
      });
      if (!opp) throw new NotFoundException('Opportunity not found');
      CenterScope.validate(user, opp.lead.centerId);

      if (opp.status !== OpportunityStatus.TEST_DONE) {
        throw new BadRequestException(
          'Chỉ nhập kết quả khi cơ hội ở trạng thái Đã kiểm tra',
        );
      }

      const result = payload.result?.toString().trim();
      const notes = payload.notes?.toString().trim();
      if (!result) {
        throw new BadRequestException('Vui lòng nhập kết quả kiểm tra');
      }

      const existing = await tx.testEvent.findFirst({
        where: { leadId: opp.leadId, status: 'COMPLETED' },
        orderBy: { scheduledAt: 'desc' },
      });

      const testEvent = existing
        ? await tx.testEvent.update({
            where: { id: existing.id },
            data: { result, notes, status: 'COMPLETED' },
          })
        : await tx.testEvent.create({
            data: {
              leadId: opp.leadId,
              centerId: opp.lead.centerId,
              scheduledAt: new Date(),
              result,
              notes,
              status: 'COMPLETED',
            },
          });

      const updatedOpp = await tx.opportunity.update({
        where: { id },
        data: {
          status: OpportunityStatus.TRIAL_DONE,
          notes: [
            opp.notes,
            `Kết quả kiểm tra: ${result}`,
            notes ? `Nhận xét: ${notes}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id || user.userId,
          entityType: 'OPPORTUNITY',
          entityId: id,
          action: 'SAVE_TEST_RESULT',
          afterData: { testEvent, status: updatedOpp.status } as any,
          centerId: opp.lead.centerId,
        },
      });

      const placementScore = this.parsePlacementScore(result);
      await tx.lead.update({
        where: { id: opp.leadId },
        data: {
          testDone: true,
          testDate: testEvent.scheduledAt,
          resultReturned: true,
          resultReturnedAt: new Date(),
          scoreOverall:
            placementScore == null
              ? undefined
              : new Prisma.Decimal(placementScore),
        },
      });

      const student = await this.findStudentForOpportunity(tx, opp);
      if (student) {
        await this.syncPlacementResultFromTestEvent(tx, student.id, testEvent);
      }

      const assigneeId = await this.findOperationalAssignee(
        tx,
        opp.lead.centerId,
        ['ACADEMIC', 'MANAGER', 'SUPER_ADMIN'],
        opp.lead.ownerId,
      );
      await this.ensureOperationalTask(tx, {
        leadId: opp.leadId,
        opportunityId: id,
        assigneeId,
        title: 'Đề xuất lớp sau test đầu vào',
        description:
          'Đã có kết quả test đầu vào. Giáo vụ cần đề xuất lớp học thử hoặc lớp phù hợp cho học sinh.',
        dueDate: this.daysFromNow(1),
        priority: 'HIGH',
      });

      return testEvent;
    });
  }

  async assignTrialClass(id: string, payload: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({
        where: { id },
        include: { lead: { include: { parent: true } } },
      });
      if (!opp) throw new NotFoundException('Opportunity not found');
      CenterScope.validate(user, opp.lead.centerId);
      this.validateCheckinInfo(opp.lead);

      if (opp.status !== OpportunityStatus.TRIAL_DONE) {
        throw new BadRequestException(
          'Chỉ xếp lớp học thử khi cơ hội ở trạng thái Đã học thử',
        );
      }

      const student = await this.ensureStudentFromOpportunity(
        tx,
        opp,
        payload.student || {},
        StudentStatus.TRIAL,
      );
      await this.syncLatestPlacementResult(tx, opp.leadId, student.id);
      await this.assignStudentToClass(
        tx,
        student.id,
        payload.classId,
        opp.lead.centerId,
        'ENROLLED',
      );

      await tx.auditLog.create({
        data: {
          actorId: user.id || user.userId,
          entityType: 'OPPORTUNITY',
          entityId: id,
          action: 'ASSIGN_TRIAL_CLASS',
          afterData: { studentId: student.id, classId: payload.classId },
          centerId: opp.lead.centerId,
        },
      });

      await this.ensureOperationalTask(tx, {
        leadId: opp.leadId,
        opportunityId: id,
        assigneeId: opp.lead.ownerId,
        title: 'Follow-up phụ huynh sau học thử',
        description:
          'Học sinh đã được xếp lớp học thử. Sales/CS cần theo dõi buổi học thử và follow-up phụ huynh để chốt lộ trình.',
        dueDate: this.daysFromNow(1),
        priority: 'MEDIUM',
      });

      return { student };
    });
  }

  async saveCheckinProfile(id: string, payload: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({
        where: { id },
        include: {
          lead: {
            include: {
              parent: true,
            },
          },
        },
      });

      if (!opp) throw new NotFoundException('Opportunity not found');
      CenterScope.validate(user, opp.lead.centerId);

      if (opp.status !== OpportunityStatus.CHECKIN_DONE) {
        throw new BadRequestException(
          'Chỉ nhập hồ sơ học sinh sau khi cơ hội ở trạng thái Đã check-in',
        );
      }

      const parentPayload = payload.parent || {};
      const studentPayload = payload.student || {};
      const parentName =
        parentPayload.fullName?.trim() || opp.lead.parent.fullName;
      const parentPhone = parentPayload.phone?.trim() || opp.lead.parent.phone;
      const studentName =
        studentPayload.fullName?.trim() ||
        opp.lead.prospectiveStudentName?.trim() ||
        parentName;

      if (!parentName || !parentPhone || !studentName) {
        throw new BadRequestException(
          'Vui lòng nhập đầy đủ tên phụ huynh, số điện thoại và tên học sinh',
        );
      }

      let parentId = opp.lead.parentId;
      const normalizedPhone = PhoneUtility.normalize(parentPhone);
      const parentByPhoneCandidates = await tx.parent.findMany({
        select: { id: true, phone: true },
      });
      const matchedParent = parentByPhoneCandidates.find(
        (parent) => PhoneUtility.normalize(parent.phone) === normalizedPhone,
      );

      if (matchedParent && matchedParent.id !== opp.lead.parentId) {
        parentId = matchedParent.id;
      }

      const parent = await tx.parent.update({
        where: { id: parentId },
        data: {
          fullName: parentName,
          phone: parentPhone,
          email: parentPayload.email?.trim() || null,
          address: parentPayload.address?.trim() || null,
          preferredCommunicationChannel:
            parentPayload.preferredCommunicationChannel?.trim() || undefined,
        },
      });

      if (parentId !== opp.lead.parentId) {
        await tx.lead.update({
          where: { id: opp.leadId },
          data: { parentId },
        });
      }

      const existingRelation = await tx.parentStudentRelation.findFirst({
        where: {
          parentId,
          student: {
            centerId: opp.lead.centerId,
            fullName: { equals: studentName, mode: 'insensitive' },
          },
        },
        include: {
          student: true,
          family: true,
        },
      });

      let familyId = existingRelation?.familyId || null;
      if (!familyId) {
        const existingFamily = await tx.parentStudentRelation.findFirst({
          where: { parentId, familyId: { not: null } },
          select: { familyId: true },
        });
        familyId = existingFamily?.familyId || null;
      }

      if (!familyId) {
        const family = await tx.family.create({
          data: {
            code: `FAM-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
            name: `${parentName} - Gia đình`,
          },
        });
        familyId = family.id;
      }

      const studentData = {
        fullName: studentName,
        birthday: studentPayload.birthday
          ? new Date(studentPayload.birthday)
          : null,
        gender: studentPayload.gender || 'OTHER',
        centerId: opp.lead.centerId,
        target: studentPayload.target?.trim() || opp.lead.target || null,
        studentPhone:
          studentPayload.studentPhone?.trim() || opp.lead.studentPhone || null,
        school: studentPayload.school?.trim() || opp.lead.school || null,
        currentGrade:
          studentPayload.currentGrade?.trim() ||
          studentPayload.grade?.trim() ||
          opp.lead.grade ||
          null,
        address:
          studentPayload.address?.trim() ||
          opp.lead.address ||
          parent.address ||
          null,
        fatherName:
          studentPayload.fatherName?.trim() || opp.lead.fatherName || null,
        fatherPhone:
          studentPayload.fatherPhone?.trim() || opp.lead.fatherPhone || null,
        motherName:
          studentPayload.motherName?.trim() || opp.lead.motherName || null,
        motherPhone:
          studentPayload.motherPhone?.trim() || opp.lead.motherPhone || null,
        aim:
          studentPayload.aim?.trim() || opp.lead.aim || opp.lead.target || null,
        expectedExamTime:
          studentPayload.expectedExamTime?.trim() ||
          opp.lead.expectedExamTime ||
          null,
        productName:
          studentPayload.productName?.trim() ||
          opp.lead.productInterest ||
          null,
        placementTestDate: opp.lead.testDate || null,
        placementListening: opp.lead.scoreListening || null,
        placementReading: opp.lead.scoreReading || null,
        placementWriting: opp.lead.scoreWriting || null,
        placementSpeaking: opp.lead.scoreSpeaking || null,
        placementOverall: opp.lead.scoreOverall || null,
        scoreReportUrl: opp.lead.scoreReportUrl || null,
        notes: studentPayload.notes?.trim() || null,
        status: StudentStatus.PENDING,
      };

      const student = existingRelation
        ? await tx.student.update({
            where: { id: existingRelation.studentId },
            data: studentData,
          })
        : await tx.student.create({
            data: {
              ...studentData,
              code: `HV${Date.now().toString().slice(-6)}`,
            },
          });

      await this.upsertSingleParentRelation(
        tx,
        student.id,
        parentId,
        parentPayload.relationship ||
          existingRelation?.relationship ||
          'Ph\u1ee5 huynh',
        familyId,
        { isPrimaryContact: true, isPrimaryPayer: true },
      );
      await this.upsertLeadFamilyRelations(tx, student.id, opp.lead, familyId);

      const lead = await tx.lead.update({
        where: { id: opp.leadId },
        data: {
          parentId,
          prospectiveStudentName: student.fullName,
          target: student.target,
          school: studentPayload.school?.trim() || opp.lead.school,
          grade: studentPayload.grade?.trim() || opp.lead.grade,
        },
        include: {
          parent: true,
          source: true,
          owner: { select: { id: true, fullName: true, email: true } },
          center: true,
          opportunities: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id || user.userId,
          entityType: 'OPPORTUNITY',
          entityId: id,
          action: 'SAVE_CHECKIN_PROFILE',
          afterData: {
            parentId,
            studentId: student.id,
            familyId,
          },
          centerId: opp.lead.centerId,
        },
      });

      const assigneeId = await this.findOperationalAssignee(
        tx,
        opp.lead.centerId,
        ['ACADEMIC', 'MANAGER', 'SUPER_ADMIN'],
        opp.lead.ownerId,
      );
      await this.ensureOperationalTask(tx, {
        leadId: opp.leadId,
        opportunityId: id,
        assigneeId,
        title: 'Chấm/nhập kết quả test đầu vào',
        description:
          'Hồ sơ sau check-in đã được cập nhật. Giáo vụ/giáo viên cần chấm hoặc nhập kết quả test đầu vào.',
        dueDate: this.daysFromNow(1),
        priority: 'HIGH',
      });

      return { parent, student, familyId, lead };
    });
  }

  private async ensureStudentFromOpportunity(
    tx: any,
    opp: any,
    studentPayload: any,
    status: StudentStatus,
  ) {
    const parentId = opp.lead.parentId;
    const studentName =
      studentPayload.fullName?.trim() ||
      opp.lead.prospectiveStudentName?.trim() ||
      opp.lead.parent.fullName;

    if (!studentName) {
      throw new BadRequestException('Vui lòng nhập tên học sinh');
    }

    const existingRelation = await tx.parentStudentRelation.findFirst({
      where: {
        parentId,
        student: {
          centerId: studentPayload.centerId || opp.lead.centerId,
          fullName: { equals: studentName, mode: 'insensitive' },
        },
      },
      include: { student: true },
    });

    let familyId = existingRelation?.familyId || null;
    if (!familyId) {
      const existingFamily = await tx.parentStudentRelation.findFirst({
        where: { parentId, familyId: { not: null } },
        select: { familyId: true },
      });
      familyId = existingFamily?.familyId || null;
    }

    if (!familyId) {
      const family = await tx.family.create({
        data: {
          code: `FAM-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
          name: `${opp.lead.parent.fullName} - Gia đình`,
        },
      });
      familyId = family.id;
    }

    const studentData = {
      fullName: studentName,
      birthday: studentPayload.birthday
        ? new Date(studentPayload.birthday)
        : undefined,
      gender: studentPayload.gender || undefined,
      centerId: studentPayload.centerId || opp.lead.centerId,
      target: studentPayload.target?.trim() || opp.lead.target || undefined,
      studentPhone:
        studentPayload.studentPhone?.trim() ||
        opp.lead.studentPhone ||
        undefined,
      school: studentPayload.school?.trim() || opp.lead.school || undefined,
      currentGrade:
        studentPayload.currentGrade?.trim() ||
        studentPayload.grade?.trim() ||
        opp.lead.grade ||
        undefined,
      address:
        studentPayload.address?.trim() ||
        opp.lead.address ||
        opp.lead.parent?.address ||
        undefined,
      fatherName:
        studentPayload.fatherName?.trim() || opp.lead.fatherName || undefined,
      fatherPhone:
        studentPayload.fatherPhone?.trim() || opp.lead.fatherPhone || undefined,
      motherName:
        studentPayload.motherName?.trim() || opp.lead.motherName || undefined,
      motherPhone:
        studentPayload.motherPhone?.trim() || opp.lead.motherPhone || undefined,
      aim:
        studentPayload.aim?.trim() ||
        opp.lead.aim ||
        opp.lead.target ||
        undefined,
      expectedExamTime:
        studentPayload.expectedExamTime?.trim() ||
        opp.lead.expectedExamTime ||
        undefined,
      productName:
        studentPayload.productName?.trim() ||
        opp.lead.productInterest ||
        undefined,
      productRank: studentPayload.productRank?.trim() || undefined,
      feePackage: studentPayload.feePackage?.trim() || undefined,
      placementTestDate: opp.lead.testDate || undefined,
      placementListening: opp.lead.scoreListening || undefined,
      placementReading: opp.lead.scoreReading || undefined,
      placementWriting: opp.lead.scoreWriting || undefined,
      placementSpeaking: opp.lead.scoreSpeaking || undefined,
      placementOverall: opp.lead.scoreOverall || undefined,
      scoreReportUrl: opp.lead.scoreReportUrl || undefined,
      notes: studentPayload.notes?.trim() || undefined,
      status,
    };

    if (existingRelation) {
      const student = await tx.student.update({
        where: { id: existingRelation.studentId },
        data: studentData,
      });
      await this.upsertSingleParentRelation(
        tx,
        student.id,
        parentId,
        existingRelation.relationship || 'Ph\u1ee5 huynh',
        familyId,
        {
          isPrimaryContact: true,
          isPrimaryPayer: true,
        },
      );
      await this.upsertLeadFamilyRelations(tx, student.id, opp.lead, familyId);
      return student;
    }

    const student = await tx.student.create({
      data: {
        ...studentData,
        code: `HV${Date.now().toString().slice(-6)}`,
      },
    });
    await this.upsertSingleParentRelation(
      tx,
      student.id,
      parentId,
      'Ph\u1ee5 huynh',
      familyId,
      {
        isPrimaryContact: true,
        isPrimaryPayer: true,
      },
    );
    await this.upsertLeadFamilyRelations(tx, student.id, opp.lead, familyId);
    return student;
  }

  private async upsertLeadFamilyRelations(
    tx: any,
    studentId: string,
    lead: any,
    familyId?: string | null,
  ) {
    const relationInputs = [
      {
        fullName: lead.fatherName,
        phone: lead.fatherPhone,
        relationship: 'B\u1ed1',
      },
      {
        fullName: lead.motherName,
        phone: lead.motherPhone,
        relationship: 'M\u1eb9',
      },
    ].filter((item) => item.fullName?.trim() && item.phone?.trim());

    for (const item of relationInputs) {
      const parent = await tx.parent.upsert({
        where: { phone: item.phone.trim() },
        update: { fullName: item.fullName.trim() },
        create: {
          fullName: item.fullName.trim(),
          phone: item.phone.trim(),
        },
      });
      await this.upsertSingleParentRelation(
        tx,
        studentId,
        parent.id,
        item.relationship,
        familyId,
        { isPrimaryContact: false, isPrimaryPayer: false },
      );
    }
  }

  private normalizeParentRelationship(value?: string | null) {
    const normalized = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    if (['bo', 'cha', 'father', 'dad'].includes(normalized)) return 'B\u1ed1';
    if (['me', 'ma', 'mother', 'mom'].includes(normalized)) return 'M\u1eb9';
    return 'Ph\u1ee5 huynh';
  }

  private async upsertSingleParentRelation(
    tx: any,
    studentId: string,
    parentId: string,
    relationshipValue?: string | null,
    familyId?: string | null,
    flags: { isPrimaryContact?: boolean; isPrimaryPayer?: boolean } = {},
  ) {
    const relationship = this.normalizeParentRelationship(relationshipValue);
    const relations = await tx.parentStudentRelation.findMany({
      where: { studentId },
    });
    const relationWithSameParent = relations.find(
      (item: any) => item.parentId === parentId,
    );
    const relationWithSameRole = relations.find(
      (item: any) =>
        this.normalizeParentRelationship(item.relationship) === relationship,
    );
    const targetRelation = relationWithSameParent || relationWithSameRole;

    const data = {
      parentId,
      familyId: familyId || targetRelation?.familyId || undefined,
      relationship,
      isPrimaryContact: Boolean(flags.isPrimaryContact),
      isPrimaryPayer: Boolean(flags.isPrimaryPayer),
    };

    const savedRelation = targetRelation
      ? await tx.parentStudentRelation.update({
          where: { id: targetRelation.id },
          data,
        })
      : await tx.parentStudentRelation.create({
          data: {
            studentId,
            ...data,
          },
        });

    const duplicateIds = relations
      .filter((item: any) => item.id !== savedRelation.id)
      .filter(
        (item: any) =>
          this.normalizeParentRelationship(item.relationship) === relationship,
      )
      .map((item: any) => item.id);

    if (duplicateIds.length) {
      await tx.parentStudentRelation.deleteMany({
        where: { id: { in: duplicateIds } },
      });
    }

    return savedRelation;
  }

  private async findStudentForOpportunity(tx: any, opp: any) {
    const studentName =
      opp.lead.prospectiveStudentName?.trim() ||
      opp.lead.parent?.fullName?.trim();

    if (!opp.lead.parentId || !studentName) return null;

    const relation = await tx.parentStudentRelation.findFirst({
      where: {
        parentId: opp.lead.parentId,
        student: {
          centerId: opp.lead.centerId,
          fullName: { equals: studentName, mode: 'insensitive' },
        },
      },
      include: { student: true },
    });

    return relation?.student || null;
  }

  private parsePlacementScore(result: string | null | undefined) {
    const normalized = result?.toString().replace(',', '.').trim();
    if (!normalized) return null;

    const matched = normalized.match(/\d+(?:\.\d+)?/);
    if (!matched) return null;

    const score = Number(matched[0]);
    return Number.isFinite(score) ? score : null;
  }

  private async syncLatestPlacementResult(
    tx: any,
    leadId: string,
    studentId: string,
  ) {
    const latestTestEvent = await tx.testEvent.findFirst({
      where: { leadId, status: 'COMPLETED', result: { not: null } },
      orderBy: { scheduledAt: 'desc' },
    });

    if (!latestTestEvent) return null;
    return this.syncPlacementResultFromTestEvent(
      tx,
      studentId,
      latestTestEvent,
    );
  }

  private async syncPlacementResultFromTestEvent(
    tx: any,
    studentId: string,
    testEvent: any,
  ) {
    const score = this.parsePlacementScore(testEvent.result);
    if (score == null) return null;

    const comments = [
      `Ket qua test dau vao: ${testEvent.result}`,
      testEvent.notes ? `Nhan xet: ${testEvent.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const existingResult = await tx.academicResult.findFirst({
      where: { studentId, type: AcademicResultType.PLACEMENT },
      orderBy: { date: 'desc' },
    });

    const data = {
      score: new Prisma.Decimal(score),
      date: testEvent.scheduledAt || new Date(),
      comments,
    };

    if (existingResult) {
      return tx.academicResult.update({
        where: { id: existingResult.id },
        data,
      });
    }

    return tx.academicResult.create({
      data: {
        studentId,
        type: AcademicResultType.PLACEMENT,
        ...data,
      },
    });
  }

  private async assignStudentToClass(
    tx: any,
    studentId: string,
    classId: string,
    centerId: string,
    enrollmentStatus: 'ENROLLED' | 'ACTIVE',
  ) {
    if (!classId) {
      throw new BadRequestException('Vui lòng chọn lớp');
    }

    const cls = await tx.class.findUnique({
      where: { id: classId },
      include: { _count: { select: { students: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.centerId !== centerId) {
      throw new BadRequestException(
        'Lớp và học sinh phải thuộc cùng trung tâm',
      );
    }
    if (cls._count.students >= cls.capacity) {
      throw new BadRequestException('Lớp đã đủ sĩ số');
    }

    await tx.classStudent.upsert({
      where: { classId_studentId: { classId, studentId } },
      update: { status: 'ACTIVE' },
      create: { classId, studentId, status: 'ACTIVE' },
    });

    const existingEnrollment = await tx.enrollment.findFirst({
      where: { studentId, programId: cls.programId },
      select: { id: true },
    });

    if (existingEnrollment) {
      await tx.enrollment.update({
        where: { id: existingEnrollment.id },
        data: { classId, status: enrollmentStatus },
      });
    } else {
      await tx.enrollment.create({
        data: {
          studentId,
          programId: cls.programId,
          classId,
          status: enrollmentStatus,
          startDate: new Date(),
        },
      });
    }

    return cls;
  }

  /**
   * markOpportunityWon: Transactional and Idempotent.
   * Creates Student and Contract.
   */
  async markWon(id: string, payload: any, user: any) {
    return this.prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.findUnique({
        where: { id },
        include: {
          lead: { include: { parent: true } },
        },
      });

      if (!opp) throw new NotFoundException('Opportunity not found');
      if (opp.status === OpportunityStatus.WON)
        throw new ConflictException('Opportunity already WON');

      CenterScope.validate(user, opp.lead.centerId);
      const targetCenterId = payload.centerId || opp.lead.centerId;
      CenterScope.validate(user, targetCenterId);

      this.validateCheckinInfo(opp.lead);

      const waitForClass = Boolean(payload.waitForClass || !payload.classId);
      if (!payload.classId && !waitForClass) {
        throw new BadRequestException(
          'Vui lòng chọn lớp trước khi chốt thành công',
        );
      }

      const configListPrice =
        Number(payload.unitPrice || 0) *
        Number(payload.contractedSessions || 0);
      const listPrice = Number(
        payload.amount ?? (configListPrice || opp.value || 0),
      );
      if (!Number.isFinite(listPrice) || listPrice < 0) {
        throw new BadRequestException('Giá trị hợp đồng không hợp lệ');
      }

      const useConfigPricing =
        payload.pricingMode === 'CONFIG' ||
        Boolean(payload.discountSegmentCode) ||
        Boolean(payload.promotionCodes?.length) ||
        Boolean(
          payload.productName && payload.productRank && payload.feePackage,
        );

      const quote = useConfigPricing
        ? await this.contractService.quote({
            listPrice,
            discountPercent: payload.discountPercent,
            discountAmount: payload.discountAmount,
            discountSegmentCode: payload.discountSegmentCode,
            promotionCodes: payload.promotionCodes || [],
            contractedSessions: payload.contractedSessions
              ? Number(payload.contractedSessions)
              : undefined,
          })
        : {
            listPrice,
            discountPercent: 0,
            discountAmount: 0,
            totalDiscount: 0,
            finalAmount: listPrice,
          };

      let planId = payload.planId || null;
      if (
        !planId &&
        payload.productName &&
        payload.productRank &&
        payload.feePackage
      ) {
        const plan = await tx.plan.findFirst({
          where: {
            name: `${payload.productRank} - ${payload.feePackage}`,
            program: {
              product: {
                name: { equals: payload.productName, mode: 'insensitive' },
              },
            },
          },
        });
        planId = plan?.id || null;
      }

      const selectedClass = payload.classId
        ? await tx.class.findUnique({
            where: { id: payload.classId },
            include: { _count: { select: { students: true } } },
          })
        : null;
      if (payload.classId && !selectedClass)
        throw new NotFoundException('Class not found');
      if (selectedClass && selectedClass.centerId !== targetCenterId) {
        throw new BadRequestException(
          'Lớp chính thức không thuộc trung tâm đã chọn',
        );
      }
      if (
        selectedClass &&
        !['ACTIVE', 'PLANNING'].includes(selectedClass.status)
      ) {
        throw new BadRequestException('Lớp đã chọn không còn nhận học sinh');
      }
      if (
        selectedClass &&
        selectedClass._count.students >= selectedClass.capacity
      ) {
        throw new BadRequestException('Lớp đã đủ sĩ số');
      }

      const student = await this.ensureStudentFromOpportunity(
        tx,
        opp,
        {
          fullName: payload.studentName,
          centerId: targetCenterId,
          productName: payload.productName,
          productRank: payload.productRank,
          feePackage: payload.feePackage,
        },
        waitForClass ? StudentStatus.PENDING : StudentStatus.ACTIVE,
      );
      await this.syncLatestPlacementResult(tx, opp.leadId, student.id);
      const cls = waitForClass
        ? null
        : await this.assignStudentToClass(
            tx,
            student.id,
            payload.classId,
            targetCenterId,
            'ACTIVE',
          );

      // --- 2. Create Contract ---
      const contractCode = await this.contractService.generateContractCode(
        targetCenterId,
        tx,
      );
      const contract = await tx.contract.create({
        data: {
          code: contractCode,
          studentId: student.id,
          centerId: targetCenterId,
          ownerId: opp.lead.ownerId,
          listPrice: quote.listPrice,
          discountPercent: quote.discountPercent,
          discountAmount: quote.discountAmount,
          finalAmount: quote.finalAmount,
          contractType: useConfigPricing ? 'CONFIG_PRICING' : undefined,
          productName: payload.productName || undefined,
          productRank: payload.productRank || undefined,
          feePackage: payload.feePackage || undefined,
          contractedSessions: payload.contractedSessions
            ? Number(payload.contractedSessions)
            : undefined,
          status: ContractStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          details: planId
            ? {
                create: {
                  planId,
                  quantity: 1,
                  unitPrice: Number(payload.unitPrice || quote.listPrice),
                  discount: quote.totalDiscount,
                  totalPrice: quote.finalAmount,
                },
              }
            : undefined,
          paymentSchedule: {
            create: {
              dueDate: new Date(),
              amount: quote.finalAmount,
              paidAmount: 0,
              remainingAmount: quote.finalAmount,
              status: quote.finalAmount === 0 ? 'PAID' : 'UNPAID',
            },
          },
        },
      });

      // --- 3. Update Opportunity ---
      const updatedOpp = await tx.opportunity.update({
        where: { id },
        data: {
          status: OpportunityStatus.WON,
          value: quote.finalAmount,
          notes: payload.notes,
        },
      });
      await tx.lead.update({
        where: { id: opp.leadId },
        data: { status: 'CONVERTED', centerId: targetCenterId },
      });

      const handover = await tx.salesHandover.upsert({
        where: { opportunityId: id },
        create: {
          opportunityId: id,
          leadId: opp.leadId,
          studentId: student.id,
          contractId: contract.id,
          classId: cls?.id || null,
          centerId: targetCenterId,
          ownerId: opp.lead.ownerId,
          profileConfirmed: true,
          scheduleConfirmed: Boolean(cls),
          status: SalesHandoverStatus.IN_PROGRESS,
          profileNotes: 'Tự động xác nhận hồ sơ khi chốt thành công.',
          scheduleNotes: cls
            ? `Đã xếp lớp chính thức: ${cls.code} - ${cls.name}`
            : 'Chờ xếp lớp chính thức.',
        },
        update: {
          studentId: student.id,
          contractId: contract.id,
          classId: cls?.id || null,
          profileConfirmed: true,
          scheduleConfirmed: Boolean(cls),
          status: SalesHandoverStatus.IN_PROGRESS,
          profileNotes: 'Tự động xác nhận hồ sơ khi chốt thành công.',
          scheduleNotes: cls
            ? `Đã xếp lớp chính thức: ${cls.code} - ${cls.name}`
            : 'Chờ xếp lớp chính thức.',
        },
      });

      await this.ensureOperationalTask(tx, {
        leadId: opp.leadId,
        opportunityId: id,
        assigneeId: opp.lead.ownerId,
        title: 'Hoàn tất checklist bàn giao sau chốt',
        description:
          'Lead đã chốt thành công. Cần hoàn tất hồ sơ, hướng dẫn thanh toán, bàn giao giáo vụ và add nhóm phụ huynh.',
        dueDate: this.daysFromNow(2),
        priority: 'HIGH',
      });

      // --- 4. Audit Log ---
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          entityType: 'OPPORTUNITY',
          entityId: id,
          action: 'WON',
          afterData: {
            studentId: student.id,
            contractId: contract.id,
            classId: cls?.id || null,
            handoverId: handover.id,
          },
          centerId: opp.lead.centerId,
        },
      });

      return {
        opportunity: updatedOpp,
        student,
        contract,
        class: cls,
        waitForClass,
      };
    });
  }

  private validateCheckinInfo(lead: any) {
    const missingFields: string[] = [];

    if (!lead.parent?.fullName?.trim())
      missingFields.push('Họ tên phụ huynh/người liên hệ');
    if (!lead.parent?.phone?.trim())
      missingFields.push('Số điện thoại phụ huynh/người liên hệ');
    if (
      lead.parent?.phone?.trim() &&
      !/^0\d{9,10}$/.test(PhoneUtility.normalize(lead.parent.phone))
    ) {
      missingFields.push('Số điện thoại phụ huynh không hợp lệ');
    }
    if (!lead.prospectiveStudentName?.trim())
      missingFields.push('Họ tên học sinh');
    if (!lead.centerId) missingFields.push('Trung tâm');

    if (lead.fatherName?.trim() && !lead.fatherPhone?.trim()) {
      missingFields.push('Số điện thoại của bố');
    }
    if (
      lead.fatherPhone?.trim() &&
      !/^0\d{9,10}$/.test(PhoneUtility.normalize(lead.fatherPhone))
    ) {
      missingFields.push('Số điện thoại của bố không hợp lệ');
    }
    if (lead.motherName?.trim() && !lead.motherPhone?.trim()) {
      missingFields.push('Số điện thoại của mẹ');
    }
    if (
      lead.motherPhone?.trim() &&
      !/^0\d{9,10}$/.test(PhoneUtility.normalize(lead.motherPhone))
    ) {
      missingFields.push('Số điện thoại của mẹ không hợp lệ');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Vui lòng hoàn thiện thông tin check-in trước khi chuyển bước: ${missingFields.join(', ')}`,
      );
    }
  }

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private async findOperationalAssignee(
    tx: any,
    centerId: string,
    roleCodes: string[],
    fallbackUserId: string,
  ) {
    const user = await tx.user.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            role: { code: { in: roleCodes } },
            centers: { some: { centerId } },
          },
          {
            userRoles: {
              some: {
                isActive: true,
                role: { code: { in: roleCodes } },
                centers: { some: { centerId } },
              },
            },
          },
          {
            role: { code: 'SUPER_ADMIN' },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    return user?.id || fallbackUserId;
  }

  private async ensureOperationalTask(
    tx: any,
    data: {
      leadId: string;
      opportunityId: string;
      assigneeId: string;
      title: string;
      description: string;
      dueDate: Date;
      priority: string;
    },
  ) {
    const existing = await tx.task.findFirst({
      where: {
        leadId: data.leadId,
        opportunityId: data.opportunityId,
        title: data.title,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { id: true },
    });

    if (existing) return existing;

    return tx.task.create({
      data,
    });
  }
}
