import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { CenterScope } from '../common/utils/center-scope.utils';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';

import { CreateStudentDto } from './dto/create-student.dto';
import {
  AcademicResultType,
  AttendanceStatus,
  StudentExamOutcome,
  StudentExamStatus,
  StudentExamType,
  StudentCareEventStatus,
  StudentCareEventType,
  StudentRiskLevel,
  WarrantyCaseStatus,
  CustomerIssueStatus,
  ExamRegistrationStatus,
} from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('students')
@RequireModule('STUDENT')
export class StudentController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Permissions('STUDENT.VIEW')
  async findAll(@Request() req: any) {
    const { user } = req;
    const where = CenterScope.filter(user);
    return this.prisma.student.findMany({
      where,
      include: {
        center: true,
        relations: {
          include: { parent: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  @Permissions('STUDENT.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const { user } = req;
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        center: true,
        relations: {
          include: { parent: true, family: true },
        },
        contracts: {
          include: {
            center: { select: { id: true, name: true, code: true } },
            salesperson: { select: { id: true, fullName: true } },
            details: {
              include: {
                plan: {
                  include: {
                    program: {
                      include: {
                        product: true,
                      },
                    },
                  },
                },
              },
            },
            paymentSchedule: true,
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (student) {
      CenterScope.validate(user, student.centerId);
    }
    return student;
  }

  @Post()
  @Permissions('STUDENT.CREATE')
  async create(@Body() body: CreateStudentDto, @Request() req: any) {
    const { user } = req;
    CenterScope.validate(user, body.centerId);

    const student = await this.prisma.student.create({
      data: {
        fullName: body.fullName,
        code: body.code,
        gender: body.gender,
        birthday: body.birthday ? new Date(body.birthday) : undefined,
        centerId: body.centerId,
        target: body.target,
        status: body.status || 'ACTIVE',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id || user.userId,
        entityType: 'STUDENT',
        entityId: student.id,
        action: 'CREATE',
        afterData: student as any,
        centerId: student.centerId,
      },
    });

    return student;
  }

  @Patch(':id')
  @Permissions('STUDENT.UPDATE')
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, existing.centerId);

    const updated = await this.prisma.student.update({
      where: { id },
      data: {
        fullName: body.fullName !== undefined ? String(body.fullName).trim() : undefined,
        birthday: body.birthday ? new Date(body.birthday) : body.birthday === '' ? null : undefined,
        gender: body.gender || undefined,
        status: body.status || undefined,
        target: body.target !== undefined ? body.target?.trim() || null : undefined,
        studentPhone: body.studentPhone !== undefined ? body.studentPhone?.trim() || null : undefined,
        school: body.school !== undefined ? body.school?.trim() || null : undefined,
        currentGrade: body.currentGrade !== undefined ? body.currentGrade?.trim() || null : undefined,
        address: body.address !== undefined ? body.address?.trim() || null : undefined,
        aim: body.aim !== undefined ? body.aim?.trim() || null : undefined,
        notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
      },
    });

    const parentPayload = body.primaryParent || null;
    if (parentPayload && (parentPayload.fullName || parentPayload.phone || parentPayload.email || parentPayload.relationship)) {
      const relation = await this.prisma.parentStudentRelation.findFirst({
        where: { studentId: id },
        include: { parent: true },
        orderBy: [{ isPrimaryContact: 'desc' }],
      });

      if (relation) {
        await this.prisma.parent.update({
          where: { id: relation.parentId },
          data: {
            fullName: parentPayload.fullName?.trim() || relation.parent.fullName,
            phone: parentPayload.phone?.trim() || relation.parent.phone,
            email: parentPayload.email !== undefined ? parentPayload.email?.trim() || null : undefined,
            address: parentPayload.address !== undefined ? parentPayload.address?.trim() || null : undefined,
          },
        });
        await this.prisma.parentStudentRelation.update({
          where: { id: relation.id },
          data: {
            relationship: parentPayload.relationship?.trim() || relation.relationship,
            isPrimaryContact: true,
          },
        });
      } else if (parentPayload.fullName && parentPayload.phone) {
        const parent = await this.prisma.parent.upsert({
          where: { phone: parentPayload.phone.trim() },
          update: {
            fullName: parentPayload.fullName.trim(),
            email: parentPayload.email?.trim() || null,
            address: parentPayload.address?.trim() || null,
          },
          create: {
            fullName: parentPayload.fullName.trim(),
            phone: parentPayload.phone.trim(),
            email: parentPayload.email?.trim() || null,
            address: parentPayload.address?.trim() || null,
          },
        });
        await this.prisma.parentStudentRelation.create({
          data: {
            parentId: parent.id,
            studentId: id,
            relationship: parentPayload.relationship?.trim() || 'Phụ huynh',
            isPrimaryContact: true,
          },
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'STUDENT',
        entityId: updated.id,
        action: 'UPDATE',
        beforeData: existing as any,
        afterData: updated as any,
        centerId: updated.centerId,
      },
    });

    return updated;
  }

  @Get(':id/care-timeline')
  @Permissions('STUDENT.VIEW')
  async getCareTimeline(@Param('id') id: string, @Request() req: any) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        center: true,
        enrollments: {
          include: {
            class: { select: { id: true, name: true, code: true } },
          },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    const [careEvents, attendance, progressNotes] = await Promise.all([
      this.prisma.studentCareEvent.findMany({
        where: { studentId: id },
        include: {
          class: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.attendance.findMany({
        where: { studentId: id },
        include: { class: { select: { id: true, name: true, code: true } } },
        orderBy: { date: 'desc' },
        take: 30,
      }),
      this.prisma.progressNote.findMany({
        where: { studentId: id },
        include: {
          class: { select: { id: true, name: true, code: true } },
          teacher: { select: { id: true, fullName: true } },
        },
        orderBy: { date: 'desc' },
        take: 30,
      }),
    ]);

    const attendanceRate = attendance.length
      ? Math.round(
          (attendance.filter((item) => item.status === AttendanceStatus.PRESENT).length /
            attendance.length) *
            100,
        )
      : null;
    const absentStatuses: AttendanceStatus[] = [
      AttendanceStatus.ABSENT,
      AttendanceStatus.EXCUSED,
    ];
    const absentCount = attendance.filter((item) =>
      absentStatuses.includes(item.status),
    ).length;
    const lateCount = attendance.filter((item) => item.status === AttendanceStatus.LATE).length;

    const syntheticAttendance = attendance.map((item) => ({
      id: `attendance-${item.id}`,
      source: 'ATTENDANCE',
      type: StudentCareEventType.ATTENDANCE,
      title: `Chuyên cần: ${this.getAttendanceLabel(item.status)}`,
      content: item.notes,
      status: item.status,
      riskLevel:
        item.status === AttendanceStatus.ABSENT
          ? StudentRiskLevel.HIGH
          : item.status === AttendanceStatus.LATE || item.status === AttendanceStatus.EXCUSED
            ? StudentRiskLevel.MEDIUM
            : null,
      occurredAt: item.date,
      class: item.class,
      readonly: true,
    }));

    const syntheticNotes = progressNotes.map((note) => ({
      id: `progress-${note.id}`,
      source: 'TEACHER_COMMENT',
      type: StudentCareEventType.TEACHER_COMMENT,
      title: 'Nhận xét giáo viên',
      content: note.content,
      status: StudentCareEventStatus.RESOLVED,
      riskLevel: null,
      occurredAt: note.date,
      class: note.class,
      actor: note.teacher,
      readonly: true,
    }));

    const timeline = [
      ...careEvents.map((event) => ({
        ...event,
        source: 'CARE_EVENT',
        actor: event.createdBy,
        readonly: false,
      })),
      ...syntheticAttendance,
      ...syntheticNotes,
    ].sort(
      (a: any, b: any) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    const hasFirstLesson = careEvents.some(
      (event) => event.type === StudentCareEventType.FIRST_LESSON,
    );
    const openRisks = careEvents.filter(
      (event) =>
        event.type === StudentCareEventType.RISK_WARNING &&
        event.status === StudentCareEventStatus.OPEN,
    ).length;

    return {
      summary: {
        currentClass: student.enrollments?.[0]?.class || null,
        attendanceRate,
        absentCount,
        lateCount,
        hasFirstLesson,
        openRisks,
      },
      timeline,
    };
  }

  @Post(':id/care-timeline')
  @Permissions('STUDENT.UPDATE')
  async createCareEvent(
    @Param('id') id: string,
    @Body()
    body: {
      type: StudentCareEventType;
      title?: string;
      content?: string;
      actionPlan?: string;
      riskLevel?: StudentRiskLevel;
      classId?: string;
      dueDate?: string;
      occurredAt?: string;
    },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    if (!Object.values(StudentCareEventType).includes(body.type)) {
      throw new BadRequestException('Loại sự kiện chăm sóc không hợp lệ');
    }

    if (body.classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: body.classId } });
      if (!cls) throw new NotFoundException('Class not found');
      if (cls.centerId !== student.centerId) {
        throw new BadRequestException('Lớp và học viên phải thuộc cùng trung tâm');
      }
    }

    const title = body.title?.trim() || this.getCareEventDefaultTitle(body.type);
    const event = await this.prisma.studentCareEvent.create({
      data: {
        studentId: id,
        classId: body.classId || undefined,
        createdById: req.user.id || req.user.userId,
        type: body.type,
        title,
        content: body.content?.trim() || null,
        actionPlan: body.actionPlan?.trim() || null,
        riskLevel: body.riskLevel || undefined,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
        status: StudentCareEventStatus.OPEN,
      },
      include: {
        class: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'STUDENT_CARE_EVENT',
        entityId: event.id,
        action: 'CREATE',
        afterData: event as any,
        centerId: student.centerId,
      },
    });

    return event;
  }

  @Patch(':id/care-timeline/:eventId')
  @Permissions('STUDENT.UPDATE')
  async updateCareEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      title?: string;
      content?: string;
      actionPlan?: string;
      riskLevel?: StudentRiskLevel;
      dueDate?: string | null;
      status?: StudentCareEventStatus;
    },
    @Request() req: any,
  ) {
    const existing = await this.prisma.studentCareEvent.findUnique({
      where: { id: eventId },
      include: { student: true },
    });
    if (!existing || existing.studentId !== id) {
      throw new NotFoundException('Care event not found');
    }
    CenterScope.validate(req.user, existing.student.centerId);

    const updated = await this.prisma.studentCareEvent.update({
      where: { id: eventId },
      data: {
        title: body.title?.trim() || undefined,
        content: body.content !== undefined ? body.content?.trim() || null : undefined,
        actionPlan:
          body.actionPlan !== undefined ? body.actionPlan?.trim() || null : undefined,
        riskLevel: body.riskLevel ?? undefined,
        dueDate:
          body.dueDate === undefined
            ? undefined
            : body.dueDate
              ? new Date(body.dueDate)
              : null,
        status: body.status || undefined,
        resolvedAt:
          body.status === StudentCareEventStatus.RESOLVED
            ? new Date()
            : body.status === StudentCareEventStatus.OPEN
              ? null
              : undefined,
      },
      include: {
        class: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'STUDENT_CARE_EVENT',
        entityId: eventId,
        action: 'UPDATE',
        beforeData: existing as any,
        afterData: updated as any,
        centerId: existing.student.centerId,
      },
    });

    return updated;
  }

  @Get(':id/issues')
  @Permissions('STUDENT.VIEW')
  async getStudentIssues(@Param('id') id: string, @Request() req: any) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    return this.prisma.customerIssue.findMany({
      where: { studentId: id },
      include: {
        owner: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
        parent: { select: { id: true, fullName: true, phone: true } },
        family: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  @Post(':id/issues')
  @Permissions('STUDENT.UPDATE')
  async createStudentIssue(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: {
        relations: { include: { parent: true, family: true } },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    if (!body.title?.trim()) {
      throw new BadRequestException('Vui lòng nhập tiêu đề phản đối/khiếu nại');
    }

    const primaryRelation = student.relations.find((item) => item.isPrimaryContact) || student.relations[0];
    const issue = await this.prisma.customerIssue.create({
      data: {
        type: body.type || 'COMPLAINT',
        category: body.category || 'OTHER',
        priority: body.priority || 'MEDIUM',
        title: body.title.trim(),
        description: body.description?.trim() || null,
        nextAction: body.nextAction?.trim() || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        centerId: student.centerId,
        studentId: id,
        parentId: primaryRelation?.parentId || null,
        familyId: primaryRelation?.familyId || null,
        ownerId: body.ownerId || req.user.id || req.user.userId,
        createdById: req.user.id || req.user.userId,
      },
      include: {
        owner: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
        parent: { select: { id: true, fullName: true, phone: true } },
        family: { select: { id: true, name: true, code: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'CUSTOMER_ISSUE',
        entityId: issue.id,
        action: 'CREATE',
        afterData: issue as any,
        centerId: student.centerId,
      },
    });

    return issue;
  }

  @Patch(':id/issues/:issueId')
  @Permissions('STUDENT.UPDATE')
  async updateStudentIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const issue = await this.prisma.customerIssue.findUnique({
      where: { id: issueId },
    });
    if (!issue || issue.studentId !== id) throw new NotFoundException('Customer issue not found');
    CenterScope.validate(req.user, issue.centerId);

    const updated = await this.prisma.customerIssue.update({
      where: { id: issueId },
      data: {
        status: body.status || undefined,
        priority: body.priority || undefined,
        category: body.category || undefined,
        title: body.title?.trim() || undefined,
        description:
          body.description !== undefined ? body.description?.trim() || null : undefined,
        resolution:
          body.resolution !== undefined ? body.resolution?.trim() || null : undefined,
        nextAction:
          body.nextAction !== undefined ? body.nextAction?.trim() || null : undefined,
        dueDate:
          body.dueDate === undefined
            ? undefined
            : body.dueDate
              ? new Date(body.dueDate)
              : null,
        resolvedAt:
          body.status === CustomerIssueStatus.RESOLVED
            ? new Date()
            : body.status === CustomerIssueStatus.OPEN || body.status === CustomerIssueStatus.IN_PROGRESS
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
        actorId: req.user.id || req.user.userId,
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

  @Get(':id/exam-journey')
  @Permissions('STUDENT.VIEW')
  async getExamJourney(@Param('id') id: string, @Request() req: any) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    const [examEvents, warrantyCases, contracts] = await Promise.all([
      this.prisma.studentExamEvent.findMany({
        where: { studentId: id },
        include: {
          class: { select: { id: true, name: true, code: true } },
          contract: { select: { id: true, code: true, endDate: true, status: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { scheduledAt: 'desc' },
      }),
      this.prisma.warrantyCase.findMany({
        where: { studentId: id },
        include: {
          contract: { select: { id: true, code: true, endDate: true, status: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contract.findMany({
        where: { studentId: id },
        include: {
          renewalsOld: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: { endDate: 'desc' },
      }),
    ]);

    const activeContract = contracts.find((contract) => contract.status === 'ACTIVE') || contracts[0] || null;
    const latestRealExam = examEvents.find((event) => event.type === StudentExamType.REAL_EXAM && event.status === StudentExamStatus.COMPLETED);
    const latestMock = examEvents.find((event) => event.type === StudentExamType.MOCK_TEST && event.status === StudentExamStatus.COMPLETED);

    return {
      summary: {
        activeContract,
        latestMock,
        latestRealExam,
        openWarrantyCount: warrantyCases.filter((item) => {
          const openStatuses: WarrantyCaseStatus[] = [
            WarrantyCaseStatus.OPEN,
            WarrantyCaseStatus.APPROVED,
          ];
          return openStatuses.includes(item.status);
        }).length,
        pendingRenewal: contracts.flatMap((item) => item.renewalsOld).find((renewal) =>
          ['PENDING', 'APPROVED'].includes(renewal.status),
        ) || null,
      },
      examEvents,
      warrantyCases,
      contracts,
    };
  }

  @Post(':id/exam-events')
  @Permissions('STUDENT.UPDATE')
  async createExamEvent(
    @Param('id') id: string,
    @Body()
    body: {
      type: StudentExamType;
      scheduledAt: string;
      classId?: string;
      contractId?: string;
      score?: number;
      targetScore?: number;
      notes?: string;
      actionPlan?: string;
      markCompleted?: boolean;
      registrationStatus?: ExamRegistrationStatus;
      examFeeConfirmed?: boolean;
      documentsChecked?: boolean;
      reminderTMinus7Sent?: boolean;
      reminderTMinus3Sent?: boolean;
      reminderTMinus1Sent?: boolean;
      arrivalConfirmed?: boolean;
      registrationNotes?: string;
    },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    if (!Object.values(StudentExamType).includes(body.type)) {
      throw new BadRequestException('Loại bài thi không hợp lệ');
    }
    if (!body.scheduledAt) {
      throw new BadRequestException('Vui lòng nhập ngày thi');
    }

    if (
      body.registrationStatus &&
      !Object.values(ExamRegistrationStatus).includes(body.registrationStatus)
    ) {
      throw new BadRequestException('Trạng thái đăng ký thi không hợp lệ');
    }

    await this.validateStudentClassAndContract(id, student.centerId, body.classId, body.contractId);

    const score = this.validateExamScoreStep(body.score, 'score');
    const targetScore = this.validateExamScoreStep(body.targetScore, 'targetScore');
    const completed = Boolean(body.markCompleted || score !== undefined);
    const outcome = this.calculateExamOutcome(score, targetScore);

    const event = await this.prisma.studentExamEvent.create({
      data: {
        studentId: id,
        classId: body.classId || null,
        contractId: body.contractId || null,
        createdById: req.user.id || req.user.userId,
        type: body.type,
        scheduledAt: new Date(body.scheduledAt),
        status: completed ? StudentExamStatus.COMPLETED : StudentExamStatus.SCHEDULED,
        completedAt: completed ? new Date() : null,
        score: score ?? null,
        targetScore: targetScore ?? null,
        outcome,
        notes: body.notes?.trim() || null,
        actionPlan: body.actionPlan?.trim() || null,
        registrationStatus: body.registrationStatus || ExamRegistrationStatus.NOT_STARTED,
        examFeeConfirmed: Boolean(body.examFeeConfirmed),
        documentsChecked: Boolean(body.documentsChecked),
        reminderTMinus7Sent: Boolean(body.reminderTMinus7Sent),
        reminderTMinus3Sent: Boolean(body.reminderTMinus3Sent),
        reminderTMinus1Sent: Boolean(body.reminderTMinus1Sent),
        arrivalConfirmed: Boolean(body.arrivalConfirmed),
        registrationNotes: body.registrationNotes?.trim() || null,
      },
      include: {
        class: { select: { id: true, name: true, code: true } },
        contract: { select: { id: true, code: true, endDate: true, status: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    if (completed && score !== undefined) {
      await this.prisma.academicResult.create({
        data: {
          studentId: id,
          classId: body.classId || null,
          type: body.type === StudentExamType.MOCK_TEST ? AcademicResultType.MOCK : AcademicResultType.FINAL,
          score,
          date: new Date(),
          comments: body.notes?.trim() || null,
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'STUDENT_EXAM_EVENT',
        entityId: event.id,
        action: 'CREATE',
        afterData: event as any,
        centerId: student.centerId,
      },
    });

    return event;
  }

  @Patch(':id/exam-events/:eventId')
  @Permissions('STUDENT.UPDATE')
  async updateExamEvent(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body()
    body: {
      status?: StudentExamStatus;
      score?: number;
      targetScore?: number;
      notes?: string;
      actionPlan?: string;
      registrationStatus?: ExamRegistrationStatus;
      examFeeConfirmed?: boolean;
      documentsChecked?: boolean;
      reminderTMinus7Sent?: boolean;
      reminderTMinus3Sent?: boolean;
      reminderTMinus1Sent?: boolean;
      arrivalConfirmed?: boolean;
      registrationNotes?: string | null;
    },
    @Request() req: any,
  ) {
    const existing = await this.prisma.studentExamEvent.findUnique({
      where: { id: eventId },
      include: { student: true },
    });
    if (!existing || existing.studentId !== id) throw new NotFoundException('Exam event not found');
    CenterScope.validate(req.user, existing.student.centerId);

    const nextScore = this.validateExamScoreStep(body.score, 'score');
    const nextTargetScore = this.validateExamScoreStep(body.targetScore, 'targetScore');
    const score = nextScore ?? (existing.score === null ? undefined : Number(existing.score));
    const targetScore = nextTargetScore ?? (existing.targetScore === null ? undefined : Number(existing.targetScore));
    const status = body.status || existing.status;
    const completed = status === StudentExamStatus.COMPLETED;
    if (
      body.registrationStatus &&
      !Object.values(ExamRegistrationStatus).includes(body.registrationStatus)
    ) {
      throw new BadRequestException('Trạng thái đăng ký thi không hợp lệ');
    }
    const updated = await this.prisma.studentExamEvent.update({
      where: { id: eventId },
      data: {
        status,
        score: nextScore ?? undefined,
        targetScore: nextTargetScore ?? undefined,
        outcome: this.calculateExamOutcome(score, targetScore),
        notes: body.notes !== undefined ? body.notes?.trim() || null : undefined,
        actionPlan: body.actionPlan !== undefined ? body.actionPlan?.trim() || null : undefined,
        registrationStatus: body.registrationStatus || undefined,
        examFeeConfirmed:
          typeof body.examFeeConfirmed === 'boolean' ? body.examFeeConfirmed : undefined,
        documentsChecked:
          typeof body.documentsChecked === 'boolean' ? body.documentsChecked : undefined,
        reminderTMinus7Sent:
          typeof body.reminderTMinus7Sent === 'boolean' ? body.reminderTMinus7Sent : undefined,
        reminderTMinus3Sent:
          typeof body.reminderTMinus3Sent === 'boolean' ? body.reminderTMinus3Sent : undefined,
        reminderTMinus1Sent:
          typeof body.reminderTMinus1Sent === 'boolean' ? body.reminderTMinus1Sent : undefined,
        arrivalConfirmed:
          typeof body.arrivalConfirmed === 'boolean' ? body.arrivalConfirmed : undefined,
        registrationNotes:
          body.registrationNotes !== undefined ? body.registrationNotes?.trim() || null : undefined,
        completedAt: completed && !existing.completedAt ? new Date() : undefined,
      },
      include: {
        class: { select: { id: true, name: true, code: true } },
        contract: { select: { id: true, code: true, endDate: true, status: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'STUDENT_EXAM_EVENT',
        entityId: eventId,
        action: 'UPDATE',
        beforeData: existing as any,
        afterData: updated as any,
        centerId: existing.student.centerId,
      },
    });

    return updated;
  }

  @Post(':id/warranty-cases')
  @Permissions('STUDENT.UPDATE')
  async createWarrantyCase(
    @Param('id') id: string,
    @Body()
    body: {
      contractId?: string;
      examEventId?: string;
      reason: string;
      plan?: string;
      dueDate?: string;
    },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);
    if (!body.reason?.trim()) throw new BadRequestException('Vui lòng nhập lý do bảo hành');

    await this.validateStudentClassAndContract(id, student.centerId, undefined, body.contractId);
    if (body.examEventId) {
      const exam = await this.prisma.studentExamEvent.findUnique({ where: { id: body.examEventId } });
      if (!exam || exam.studentId !== id) throw new BadRequestException('Kết quả thi không thuộc học viên này');
    }

    const warranty = await this.prisma.warrantyCase.create({
      data: {
        studentId: id,
        contractId: body.contractId || null,
        examEventId: body.examEventId || null,
        createdById: req.user.id || req.user.userId,
        reason: body.reason.trim(),
        plan: body.plan?.trim() || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
      include: {
        contract: { select: { id: true, code: true, endDate: true, status: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'WARRANTY_CASE',
        entityId: warranty.id,
        action: 'CREATE',
        afterData: warranty as any,
        centerId: student.centerId,
      },
    });

    return warranty;
  }

  @Patch(':id/warranty-cases/:caseId')
  @Permissions('STUDENT.UPDATE')
  async updateWarrantyCase(
    @Param('id') id: string,
    @Param('caseId') caseId: string,
    @Body() body: { status?: WarrantyCaseStatus; plan?: string },
    @Request() req: any,
  ) {
    const existing = await this.prisma.warrantyCase.findUnique({
      where: { id: caseId },
      include: { student: true },
    });
    if (!existing || existing.studentId !== id) throw new NotFoundException('Warranty case not found');
    CenterScope.validate(req.user, existing.student.centerId);

    const updated = await this.prisma.warrantyCase.update({
      where: { id: caseId },
      data: {
        status: body.status || undefined,
        plan: body.plan !== undefined ? body.plan?.trim() || null : undefined,
        resolvedAt:
          body.status === WarrantyCaseStatus.COMPLETED || body.status === WarrantyCaseStatus.CANCELLED
            ? new Date()
            : undefined,
      },
      include: {
        contract: { select: { id: true, code: true, endDate: true, status: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'WARRANTY_CASE',
        entityId: caseId,
        action: 'UPDATE',
        beforeData: existing as any,
        afterData: updated as any,
        centerId: existing.student.centerId,
      },
    });

    return updated;
  }

  @Post(':id/renewals')
  @Permissions('STUDENT.UPDATE')
  async createStudentRenewal(
    @Param('id') id: string,
    @Body() body: { contractId?: string; notes?: string },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    const contract = body.contractId
      ? await this.prisma.contract.findUnique({ where: { id: body.contractId } })
      : await this.prisma.contract.findFirst({
          where: { studentId: id, status: 'ACTIVE' },
          orderBy: { endDate: 'desc' },
        });

    if (!contract || contract.studentId !== id) throw new NotFoundException('Không tìm thấy hợp đồng của học viên');
    if (contract.centerId !== student.centerId) throw new BadRequestException('Hợp đồng khác trung tâm học viên');
    if (contract.status !== 'ACTIVE') throw new BadRequestException('Chỉ tạo gia hạn cho hợp đồng đang hoạt động');

    const existing = await this.prisma.renewal.findFirst({
      where: { oldContractId: contract.id, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (existing) return existing;

    const renewal = await this.prisma.renewal.create({
      data: {
        oldContractId: contract.id,
        status: 'PENDING',
        notes: body.notes?.trim() || `Tạo gia hạn từ hồ sơ học viên ${student.fullName}`,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'RENEWAL',
        entityId: renewal.id,
        action: 'CREATE',
        afterData: renewal as any,
        centerId: student.centerId,
      },
    });

    return renewal;
  }

  @Post(':id/renewals/complete')
  @Permissions('STUDENT.UPDATE')
  async completeStudentRenewal(
    @Param('id') id: string,
    @Body()
    body: {
      contractId?: string;
      planId: string;
      amount?: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
    },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    const oldContract = body.contractId
      ? await this.prisma.contract.findUnique({ where: { id: body.contractId } })
      : await this.prisma.contract.findFirst({
          where: { studentId: id, status: 'ACTIVE' },
          orderBy: { endDate: 'desc' },
        });

    if (!oldContract || oldContract.studentId !== id) throw new NotFoundException('Old contract not found');
    if (oldContract.centerId !== student.centerId) throw new BadRequestException('Contract center mismatch');
    if (oldContract.status !== 'ACTIVE') throw new BadRequestException('Only active contracts can be renewed');

    const plan = await this.prisma.plan.findUnique({ where: { id: body.planId } });
    if (!plan) throw new NotFoundException('Renewal plan not found');

    const amount = Number(body.amount ?? plan.price);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Invalid renewal contract amount');
    }

    const startDate = body.startDate ? new Date(body.startDate) : new Date();
    const endDate = body.endDate
      ? new Date(body.endDate)
      : new Date(
          startDate.getFullYear(),
          startDate.getMonth() + Number(plan.durationMonths || 1),
          startDate.getDate(),
        );

    const result = await this.prisma.$transaction(async (tx) => {
      const newContract = await tx.contract.create({
        data: {
          code: `RN${Date.now().toString().slice(-6)}`,
          studentId: id,
          centerId: student.centerId,
          ownerId: oldContract.ownerId,
          listPrice: amount,
          finalAmount: amount,
          status: 'ACTIVE',
          startDate,
          endDate,
          details: {
            create: {
              planId: plan.id,
              quantity: 1,
              unitPrice: amount,
              discount: 0,
              totalPrice: amount,
            },
          },
          paymentSchedule: {
            create: {
              dueDate: startDate,
              amount,
              paidAmount: 0,
              remainingAmount: amount,
              status: amount === 0 ? 'PAID' : 'UNPAID',
            },
          },
        },
      });

      const existing = await tx.renewal.findFirst({
        where: { oldContractId: oldContract.id, status: { in: ['PENDING', 'APPROVED'] } },
      });

      const renewal = existing
        ? await tx.renewal.update({
            where: { id: existing.id },
            data: {
              newContractId: newContract.id,
              status: 'COMPLETED',
              notes: body.notes?.trim() || `Renewed with plan ${plan.name}`,
            },
          })
        : await tx.renewal.create({
            data: {
              oldContractId: oldContract.id,
              newContractId: newContract.id,
              status: 'COMPLETED',
              notes: body.notes?.trim() || `Renewed with plan ${plan.name}`,
            },
          });

      await tx.auditLog.create({
        data: {
          actorId: req.user.id || req.user.userId,
          entityType: 'RENEWAL',
          entityId: renewal.id,
          action: existing ? 'COMPLETE' : 'CREATE_COMPLETED',
          afterData: { renewal, newContract } as any,
          centerId: student.centerId,
        },
      });

      return { renewal, newContract };
    });

    return result.renewal;
  }

  private async validateStudentClassAndContract(
    studentId: string,
    centerId: string,
    classId?: string,
    contractId?: string,
  ) {
    if (classId) {
      const cls = await this.prisma.class.findUnique({ where: { id: classId } });
      if (!cls) throw new NotFoundException('Class not found');
      if (cls.centerId !== centerId) throw new BadRequestException('Lớp khác trung tâm học viên');

      const membership = await this.prisma.classStudent.findUnique({
        where: { classId_studentId: { classId, studentId } },
      });
      if (!membership) throw new BadRequestException('Học viên chưa thuộc lớp đã chọn');
    }

    if (contractId) {
      const contract = await this.prisma.contract.findUnique({ where: { id: contractId } });
      if (!contract) throw new NotFoundException('Contract not found');
      if (contract.studentId !== studentId) throw new BadRequestException('Hợp đồng không thuộc học viên này');
      if (contract.centerId !== centerId) throw new BadRequestException('Hợp đồng khác trung tâm học viên');
    }
  }

  private calculateExamOutcome(score?: number, targetScore?: number): StudentExamOutcome | null {
    if (score === undefined || targetScore === undefined || score === null || targetScore === null) {
      return null;
    }

    if (score < targetScore) return StudentExamOutcome.BELOW_TARGET;
    if (score === targetScore) return StudentExamOutcome.MEET_TARGET;
    return StudentExamOutcome.EXCEED_TARGET;
  }

  private validateExamScoreStep(value: number | undefined, fieldName: string): number | undefined {
    if (value === undefined || value === null) return undefined;

    const parsedValue = Number(value);
    if (
      !Number.isFinite(parsedValue) ||
      Math.abs(parsedValue * 2 - Math.round(parsedValue * 2)) >= 1e-9
    ) {
      throw new BadRequestException(`${fieldName} must use 0.5 increments`);
    }

    return parsedValue;
  }

  private getAttendanceLabel(status: AttendanceStatus) {
    const labels: Record<AttendanceStatus, string> = {
      PRESENT: 'Có mặt',
      ABSENT: 'Vắng',
      LATE: 'Đi muộn',
      EXCUSED: 'Vắng có phép',
    };
    return labels[status] || status;
  }

  private getCareEventDefaultTitle(type: StudentCareEventType) {
    const labels: Record<StudentCareEventType, string> = {
      FIRST_LESSON: 'Theo dõi buổi học đầu tiên',
      ATTENDANCE: 'Theo dõi chuyên cần',
      TEACHER_COMMENT: 'Nhận xét giáo viên',
      RISK_WARNING: 'Cảnh báo rủi ro',
      GENERAL: 'Ghi chú chăm sóc',
    };
    return labels[type] || 'Ghi chú chăm sóc';
  }
}
