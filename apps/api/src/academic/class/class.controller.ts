import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { CenterScope } from '../../common/utils/center-scope.utils';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('academic/classes')
@RequireModule('CLASS_ACADEMIC')
export class ClassController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Permissions('CLASS_ACADEMIC.VIEW')
  async findAll(@Request() req: any, @Query('centerId') centerId?: string) {
    const where = CenterScope.filter(req.user, 'centerId', centerId);
    return this.prisma.class.findMany({
      where,
      include: {
        program: true,
        center: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { code: 'asc' },
    });
  }

  @Get(':id')
  @Permissions('CLASS_ACADEMIC.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        program: true,
        center: true,
        teacher: { select: { id: true, fullName: true, email: true } },
        schedules: true,
        students: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: {
                id: true,
                fullName: true,
                code: true,
                status: true,
              },
            },
          },
          orderBy: { student: { fullName: 'asc' } },
        },
        _count: { select: { students: { where: { status: 'ACTIVE' } } } },
      },
    });

    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    return cls;
  }

  @Post()
  @Permissions('CLASS_ACADEMIC.CREATE')
  async create(@Body() data: any, @Request() req: any) {
    CenterScope.validate(req.user, data.centerId);

    if (!data.programId) throw new BadRequestException('Program is required');
    if (!data.centerId) throw new BadRequestException('Center is required');
    if (!data.name?.trim())
      throw new BadRequestException('Class name is required');

    // Auto-generate code if missing
    if (!data.code) {
      data.code = `CLS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    }

    const schedules = Array.isArray(data.schedules)
      ? data.schedules
          .filter(
            (item: any) => item.dayOfWeek && item.startTime && item.endTime,
          )
          .map((item: any) => ({
            centerId: data.centerId,
            dayOfWeek: Number(item.dayOfWeek),
            startTime: item.startTime,
            endTime: item.endTime,
            room: item.room || null,
          }))
      : [];

    return this.prisma.class.create({
      data: {
        programId: data.programId,
        centerId: data.centerId,
        name: data.name.trim(),
        code: data.code.trim(),
        status: data.status || 'PLANNING',
        capacity: Number(data.capacity || 20),
        teacherId: data.teacherId || null,
        schedules: schedules.length ? { create: schedules } : undefined,
      },
    });
  }

  @Patch(':id')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    return this.prisma.class.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        status: data.status,
        capacity:
          data.capacity !== undefined ? Number(data.capacity) : undefined,
        teacherId: data.teacherId || undefined,
        programId: data.programId,
        schedules: data.schedules
          ? {
              deleteMany: {},
              create: data.schedules
                .filter(
                  (item: any) =>
                    item.dayOfWeek && item.startTime && item.endTime,
                )
                .map((item: any) => ({
                  centerId: cls.centerId,
                  dayOfWeek: Number(item.dayOfWeek),
                  startTime: item.startTime,
                  endTime: item.endTime,
                  room: item.room || null,
                })),
            }
          : undefined,
      },
    });
  }

  @Get(':id/available-students')
  @Permissions('CLASS_ACADEMIC.VIEW')
  async findAvailableStudents(
    @Param('id') id: string,
    @Request() req: any,
    @Query('keyword') keyword?: string,
  ) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          where: { status: 'ACTIVE' },
          select: { studentId: true },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    const enrolledIds = cls.students.map((item) => item.studentId);
    const searchKeyword = keyword?.trim();

    const where: any = {
      centerId: cls.centerId,
      id: enrolledIds.length ? { notIn: enrolledIds } : undefined,
    };

    if (searchKeyword) {
      where.OR = [
        { fullName: { contains: searchKeyword, mode: 'insensitive' } },
        { studentPhone: { contains: searchKeyword, mode: 'insensitive' } },
        { code: { contains: searchKeyword, mode: 'insensitive' } },
      ];
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        classStudent: {
          where: { status: 'ACTIVE' },
          include: { class: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
      take: searchKeyword ? 100 : 20,
    });

    return students
      .sort((a, b) => {
        const getPriority = (student: (typeof students)[number]) => {
          if (student.status === 'PENDING') return 0;
          if (student.classStudent.length > 0) return 1;
          return 2;
        };

        const priorityDiff = getPriority(a) - getPriority(b);
        if (priorityDiff !== 0) return priorityDiff;

        return a.fullName.localeCompare(b.fullName);
      })
      .slice(0, 20);
  }

  @Post(':id/enroll')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async enroll(
    @Param('id') id: string,
    @Body() body: { studentId: string },
    @Request() req: any,
  ) {
    // 1. Validate Class existence and Center Scope
    const cls = await this.prisma.class.findUnique({
      where: { id },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    // 2. Check Capacity
    const activeStudentCount = await this.prisma.classStudent.count({
      where: { classId: id, status: 'ACTIVE' },
    });
    if (activeStudentCount >= cls.capacity) {
      throw new BadRequestException('Class is full');
    }

    // 3. Validate Student existence and Center consistency
    const student = await this.prisma.student.findUnique({
      where: { id: body.studentId },
    });
    if (!student) throw new NotFoundException('Student not found');

    if (student.centerId !== cls.centerId) {
      throw new BadRequestException(
        'Student and Class must be in the same center',
      );
    }

    // 4. Check duplicate active enrollment in THIS class
    const existingClassStudent = await this.prisma.classStudent.findUnique({
      where: { classId_studentId: { classId: id, studentId: body.studentId } },
    });
    if (existingClassStudent?.status === 'ACTIVE')
      throw new BadRequestException('Student already enrolled in this class');

    // 5. Execute Transaction
    return this.prisma.$transaction(async (tx) => {
      // Transfer Logic: deactivate previous active class links and keep history.
      await tx.classStudent.updateMany({
        where: {
          studentId: body.studentId,
          classId: { not: id },
          status: 'ACTIVE',
        },
        data: { status: 'DROPPED' },
      });

      // Create or reactivate ClassStudent link
      const classStudent = await tx.classStudent.upsert({
        where: {
          classId_studentId: { classId: id, studentId: body.studentId },
        },
        update: { status: 'ACTIVE' },
        create: {
          classId: id,
          studentId: body.studentId,
          status: 'ACTIVE',
        },
      });

      const existingEnrollment = await tx.enrollment.findFirst({
        where: { studentId: body.studentId, programId: cls.programId },
        select: { id: true },
      });

      if (existingEnrollment) {
        await tx.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { classId: id, status: 'ACTIVE', endDate: null },
        });
      } else {
        await tx.enrollment.create({
          data: {
            studentId: body.studentId,
            programId: cls.programId,
            classId: id,
            status: 'ACTIVE',
            startDate: new Date(),
          },
        });
      }

      // Update Student Status
      await tx.student.update({
        where: { id: body.studentId },
        data: { status: 'ACTIVE' },
      });

      await this.ensureClassTask(tx, {
        title: 'Onboarding học sinh vào lớp mới',
        description: `Học sinh vừa được xếp vào lớp ${cls.name}. Cần rà soát lịch học, giáo trình, nhóm liên lạc phụ huynh và buổi học đầu tiên.`,
        dueDate: this.daysFromNow(1),
        priority: 'MEDIUM',
        assigneeId: cls.teacherId || req.user.userId || req.user.id,
        studentId: body.studentId,
        classId: id,
      });

      return classStudent;
    });
  }

  @Delete(':id/unenroll/:studentId')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async unenroll(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @Request() req: any,
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete ClassStudent link
      await tx.classStudent.delete({
        where: { classId_studentId: { classId: id, studentId } },
      });

      // 2. Update Enrollment status (unlinking from class)
      await tx.enrollment.updateMany({
        where: { studentId, classId: id },
        data: {
          classId: null,
          status: 'SUSPENDED', // Marking as suspended as they are out of class
        },
      });

      // 3. Optional: Check if student has other active classes
      const otherClasses = await tx.classStudent.count({
        where: { studentId, status: 'ACTIVE' },
      });
      if (otherClasses === 0) {
        await tx.student.update({
          where: { id: studentId },
          data: { status: 'HOLD' }, // Move to HOLD if no active classes
        });
      }

      return { success: true };
    });
  }

  private daysFromNow(days: number) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private async ensureClassTask(
    tx: any,
    data: {
      title: string;
      description: string;
      dueDate: Date;
      priority: string;
      assigneeId: string;
      studentId: string;
      classId: string;
    },
  ) {
    const existing = await tx.task.findFirst({
      where: {
        title: data.title,
        studentId: data.studentId,
        classId: data.classId,
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      select: { id: true },
    });

    if (existing) return existing;

    return tx.task.create({ data });
  }

  @Get(':id/periodic-comments')
  @Permissions('CLASS_ACADEMIC.VIEW')
  async getPeriodicComments(
    @Param('id') id: string,
    @Request() req: any,
    @Query('periodType') periodType: string,
    @Query('periodKey') periodKey: string,
    @Query('teacherId') teacherId?: string,
    @Query('search') search?: string,
  ) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      select: { centerId: true },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);
    if (!['WEEKLY', 'MONTHLY'].includes(periodType)) {
      throw new BadRequestException('Invalid period type');
    }
    if (!periodKey?.trim()) {
      throw new BadRequestException('Missing period key');
    }

    const students = await this.prisma.classStudent.findMany({
      where: {
        classId: id,
        status: 'ACTIVE',
        student: search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : undefined,
      },
      include: {
        student: {
          include: {
            contracts: {
              where: { status: 'ACTIVE' },
              select: { productName: true, productRank: true, feePackage: true },
            },
            progressNotes: {
              where: {
                classId: id,
                periodType,
                periodKey: periodKey.trim(),
                teacherId: teacherId || undefined,
              },
              include: { teacher: { select: { id: true, fullName: true } } },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    return students.map((cs) => ({
      studentId: cs.student.id,
      fullName: cs.student.fullName,
      code: cs.student.code,
      status: cs.student.status,
      contracts: cs.student.contracts,
      comment: cs.student.progressNotes[0] || null,
    }));
  }

  @Post(':id/periodic-comments')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async upsertPeriodicComment(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      select: { centerId: true },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    const {
      studentId,
      teacherId,
      periodType,
      periodKey,
      content,
      strengths,
      improvements,
      nextSteps,
    } = data;

    if (!studentId || !teacherId || !periodType || !periodKey || !content) {
      throw new BadRequestException('Missing required fields');
    }
    if (!['WEEKLY', 'MONTHLY'].includes(periodType)) {
      throw new BadRequestException('Invalid period type');
    }

    const isMember = await this.prisma.classStudent.findUnique({
      where: { classId_studentId: { classId: id, studentId } },
    });
    if (!isMember) throw new BadRequestException('Student not in this class');

    const teacher = await this.prisma.user.findFirst({
      where: {
        id: teacherId,
        isActive: true,
        centers: { some: { centerId: cls.centerId } },
      },
      select: { id: true },
    });
    if (!teacher) throw new BadRequestException('Invalid teacher');

    const existing = await this.prisma.progressNote.findFirst({
      where: {
        classId: id,
        studentId,
        periodType,
        periodKey: String(periodKey).trim(),
        teacherId,
      },
    });

    let savedNote;
    if (existing) {
      savedNote = await this.prisma.progressNote.update({
        where: { id: existing.id },
        data: {
          teacherId,
          strengths,
          improvements,
          nextSteps,
          content: String(content).trim(),
          date: new Date(),
        },
      });
    } else {
      savedNote = await this.prisma.progressNote.create({
        data: {
          studentId,
          classId: id,
          teacherId,
          periodType,
          periodKey: String(periodKey).trim(),
          content: String(content).trim(),
          strengths,
          improvements,
          nextSteps,
          date: new Date(),
        },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId: req.user.id || req.user.userId,
        entityType: 'PROGRESS_NOTE',
        entityId: savedNote.id,
        action: existing ? 'UPDATE_PERIODIC_COMMENT' : 'CREATE_PERIODIC_COMMENT',
        beforeData: existing as any,
        afterData: savedNote as any,
        centerId: cls.centerId,
      },
    });

    return savedNote;
  }

  @Get(':id/teachers')
  @Permissions('CLASS_ACADEMIC.VIEW')
  async getTeachers(@Param('id') id: string, @Request() req: any) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      select: { centerId: true },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    // Fetch users who are teachers in this center
    return this.prisma.user.findMany({
      where: {
        centers: { some: { centerId: cls.centerId } },
        isActive: true,
        OR: [
          { role: { code: { in: ['ACADEMIC', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'] } } },
          { taughtClasses: { some: { centerId: cls.centerId } } },
        ],
      },
      select: { id: true, fullName: true },
      orderBy: { fullName: 'asc' },
    });
  }
}
