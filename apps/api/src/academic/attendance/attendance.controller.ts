import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { CenterScope } from '../../common/utils/center-scope.utils';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { AttendanceStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('academic/attendance')
@RequireModule('CLASS_ACADEMIC')
export class AttendanceController {
  constructor(private prisma: PrismaService) {}

  @Get('class/:classId')
  @Permissions('CLASS_ACADEMIC.VIEW')
  async findByClass(
    @Param('classId') classId: string,
    @Query('date') dateStr: string,
    @Request() req: any,
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    const date = dateStr ? new Date(dateStr) : new Date();
    date.setHours(0, 0, 0, 0);

    return this.prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: date,
          lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: { student: { select: { id: true, fullName: true } } },
    });
  }

  @Post('batch')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async batchRecord(
    @Body()
    body: {
      classId: string;
      date: string;
      records: {
        studentId: string;
        status: AttendanceStatus;
        notes?: string;
      }[];
    },
    @Request() req: any,
  ) {
    // 1. Basic Payload Validation
    if (
      !body.classId ||
      !body.date ||
      !body.records ||
      body.records.length === 0
    ) {
      throw new BadRequestException(
        'Invalid payload: classId, date, and non-empty records are required',
      );
    }

    const date = new Date(body.date);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }
    date.setHours(0, 0, 0, 0);

    // Check for duplicate studentIds in the same request
    const studentIdsInRequest = body.records.map((r) => r.studentId);
    if (new Set(studentIdsInRequest).size !== studentIdsInRequest.length) {
      throw new BadRequestException('Duplicate studentId in records');
    }

    // 2. Validate Class existence and Center Scope
    const cls = await this.prisma.class.findUnique({
      where: { id: body.classId },
      include: { students: { select: { studentId: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    // 3. Validate Roster Membership
    const rosterStudentIds = new Set(cls.students.map((s) => s.studentId));
    const invalidStudents = body.records.filter(
      (r) => !rosterStudentIds.has(r.studentId),
    );

    if (invalidStudents.length > 0) {
      throw new BadRequestException(
        `Some students are not members of this class: ${invalidStudents.map((s) => s.studentId).join(', ')}`,
      );
    }

    // 4. Execute Batch Upsert in Transaction
    return this.prisma.$transaction(async (tx) => {
      const savedRecords = [];
      const dateKey = date.toISOString().split('T')[0];
      const assigneeId = await this.findOperationalAssignee(
        tx,
        cls.centerId,
        cls.teacherId,
        req.user.userId || req.user.id,
      );

      for (const r of body.records) {
        const saved = await tx.attendance.upsert({
          where: {
            classId_studentId_date: {
              classId: body.classId,
              studentId: r.studentId,
              date,
            },
          },
          create: {
            classId: body.classId,
            studentId: r.studentId,
            date,
            status: r.status,
            notes: r.notes,
          },
          update: {
            status: r.status,
            notes: r.notes,
          },
        });

        if (r.status === 'ABSENT' || r.status === 'EXCUSED') {
          await this.ensureAttendanceTask(tx, {
            title: `Theo dõi học sinh vắng buổi ${dateKey}`,
            description: `Học sinh vắng/ nghỉ có phép trong lớp ${cls.name} ngày ${dateKey}. Cần liên hệ phụ huynh và cập nhật lý do.`,
            dueDate: this.daysFromNow(1),
            priority: r.status === 'ABSENT' ? 'HIGH' : 'MEDIUM',
            assigneeId,
            studentId: r.studentId,
            classId: body.classId,
          });
        } else {
          await tx.task.updateMany({
            where: {
              studentId: r.studentId,
              classId: body.classId,
              title: `Theo dõi học sinh vắng buổi ${dateKey}`,
              status: { in: ['TODO', 'IN_PROGRESS'] },
            },
            data: { status: 'CANCELLED' },
          });
        }

        savedRecords.push(saved);
      }

      return savedRecords;
    });
  }

  private daysFromNow(days: number) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  private async findOperationalAssignee(
    tx: any,
    centerId: string,
    preferredUserId?: string | null,
    fallbackUserId?: string,
  ) {
    if (preferredUserId) return preferredUserId;

    const user = await tx.user.findFirst({
      where: {
        isActive: true,
        OR: [
          {
            role: { code: { in: ['ACADEMIC', 'MANAGER', 'SUPER_ADMIN'] } },
            centers: { some: { centerId } },
          },
          {
            userRoles: {
              some: {
                isActive: true,
                role: { code: { in: ['ACADEMIC', 'MANAGER', 'SUPER_ADMIN'] } },
                centers: { some: { centerId } },
              },
            },
          },
          { role: { code: 'SUPER_ADMIN' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    return user?.id || fallbackUserId;
  }

  private async ensureAttendanceTask(
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
}
