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
}
