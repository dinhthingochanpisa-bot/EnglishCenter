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

  async findClassesForOpportunity(id: string, user: any) {
    const opp = await this.prisma.opportunity.findUnique({
      where: { id },
      include: { lead: true },
    });

    if (!opp) throw new NotFoundException('Opportunity not found');
    CenterScope.validate(user, opp.lead.centerId);

    return this.prisma.class.findMany({
      where: { centerId: opp.lead.centerId },
      include: {
        program: true,
        center: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { students: true } },
      },
      orderBy: { code: 'asc' },
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
        throw new BadRequestException('Chỉ cập nhật bàn giao sau khi cơ hội đã chốt thành công');
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
      throw new BadRequestException('Vui lòng dùng luồng chốt thành công để chọn lớp và tạo hợp đồng');
    }

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: { status },
    });

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
        throw new BadRequestException('Chỉ nhập kết quả khi cơ hội ở trạng thái Đã kiểm tra');
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
          notes: [opp.notes, `Kết quả kiểm tra: ${result}`, notes ? `Nhận xét: ${notes}` : null]
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
          scoreOverall: placementScore == null ? undefined : new Prisma.Decimal(placementScore),
        },
      });

      const student = await this.findStudentForOpportunity(tx, opp);
      if (student) {
        await this.syncPlacementResultFromTestEvent(tx, student.id, testEvent);
      }

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

      if (opp.status !== OpportunityStatus.TRIAL_DONE) {
        throw new BadRequestException('Chỉ xếp lớp học thử khi cơ hội ở trạng thái Đã học thử');
      }

      const student = await this.ensureStudentFromOpportunity(tx, opp, payload.student || {}, StudentStatus.TRIAL);
      await this.syncLatestPlacementResult(tx, opp.leadId, student.id);
      await this.assignStudentToClass(tx, student.id, payload.classId, opp.lead.centerId, 'ENROLLED');

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
        throw new BadRequestException('Chỉ nhập hồ sơ học sinh sau khi cơ hội ở trạng thái Đã check-in');
      }

      const parentPayload = payload.parent || {};
      const studentPayload = payload.student || {};
      const parentName = parentPayload.fullName?.trim() || opp.lead.parent.fullName;
      const parentPhone = parentPayload.phone?.trim() || opp.lead.parent.phone;
      const studentName =
        studentPayload.fullName?.trim() ||
        opp.lead.prospectiveStudentName?.trim() ||
        parentName;

      if (!parentName || !parentPhone || !studentName) {
        throw new BadRequestException('Vui lòng nhập đầy đủ tên phụ huynh, số điện thoại và tên học sinh');
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
        birthday: studentPayload.birthday ? new Date(studentPayload.birthday) : null,
        gender: studentPayload.gender || 'OTHER',
        centerId: opp.lead.centerId,
        target: studentPayload.target?.trim() || opp.lead.target || null,
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
              relations: {
                create: {
                  parentId,
                  familyId,
                  relationship: parentPayload.relationship || 'Phụ huynh',
                  isPrimaryContact: true,
                  isPrimaryPayer: true,
                },
              },
            },
          });

      if (existingRelation) {
        await tx.parentStudentRelation.update({
          where: { id: existingRelation.id },
          data: {
            familyId,
            relationship: parentPayload.relationship || existingRelation.relationship || 'Phụ huynh',
            isPrimaryContact: true,
            isPrimaryPayer: true,
          },
        });
      }

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
          centerId: opp.lead.centerId,
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
      birthday: studentPayload.birthday ? new Date(studentPayload.birthday) : undefined,
      gender: studentPayload.gender || undefined,
      centerId: opp.lead.centerId,
      target: studentPayload.target?.trim() || opp.lead.target || undefined,
      notes: studentPayload.notes?.trim() || undefined,
      status,
    };

    if (existingRelation) {
      return tx.student.update({
        where: { id: existingRelation.studentId },
        data: studentData,
      });
    }

    return tx.student.create({
      data: {
        ...studentData,
        code: `HV${Date.now().toString().slice(-6)}`,
        relations: {
          create: {
            parentId,
            familyId,
            relationship: 'Phụ huynh',
            isPrimaryContact: true,
            isPrimaryPayer: true,
          },
        },
      },
    });
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

  private async syncLatestPlacementResult(tx: any, leadId: string, studentId: string) {
    const latestTestEvent = await tx.testEvent.findFirst({
      where: { leadId, status: 'COMPLETED', result: { not: null } },
      orderBy: { scheduledAt: 'desc' },
    });

    if (!latestTestEvent) return null;
    return this.syncPlacementResultFromTestEvent(tx, studentId, latestTestEvent);
  }

  private async syncPlacementResultFromTestEvent(tx: any, studentId: string, testEvent: any) {
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
      throw new BadRequestException('Lớp và học sinh phải thuộc cùng trung tâm');
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
      const waitForClass = Boolean(payload.waitForClass || !payload.classId);
      if (!payload.classId && !waitForClass) {
        throw new BadRequestException('Vui lòng chọn lớp trước khi chốt thành công');
      }

      const configListPrice =
        Number(payload.unitPrice || 0) * Number(payload.contractedSessions || 0);
      const listPrice = Number(payload.amount ?? (configListPrice || opp.value || 0));
      if (!Number.isFinite(listPrice) || listPrice < 0) {
        throw new BadRequestException('Giá trị hợp đồng không hợp lệ');
      }

      const useConfigPricing =
        payload.pricingMode === 'CONFIG' ||
        Boolean(payload.discountSegmentCode) ||
        Boolean(payload.promotionCodes?.length) ||
        Boolean(payload.productName && payload.productRank && payload.feePackage);

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
      if (!planId && payload.productName && payload.productRank && payload.feePackage) {
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

      const student = await this.ensureStudentFromOpportunity(
        tx,
        opp,
        { fullName: payload.studentName },
        waitForClass ? StudentStatus.PENDING : StudentStatus.ACTIVE,
      );
      await this.syncLatestPlacementResult(tx, opp.leadId, student.id);
      const cls = waitForClass
        ? null
        : await this.assignStudentToClass(
            tx,
            student.id,
            payload.classId,
            opp.lead.centerId,
            'ACTIVE',
          );

      // --- 2. Create Contract ---
      const contractCode = await this.contractService.generateContractCode(opp.lead.centerId, tx);
      const contract = await tx.contract.create({
        data: {
          code: contractCode,
          studentId: student.id,
          centerId: opp.lead.centerId,
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
        data: { status: 'CONVERTED' },
      });

      const handover = await tx.salesHandover.upsert({
        where: { opportunityId: id },
        create: {
          opportunityId: id,
          leadId: opp.leadId,
          studentId: student.id,
          contractId: contract.id,
          classId: cls?.id || null,
          centerId: opp.lead.centerId,
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

      return { opportunity: updatedOpp, student, contract, class: cls, waitForClass };
    });
  }
}
