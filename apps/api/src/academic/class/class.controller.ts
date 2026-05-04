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
  async findAll(@Request() req: any) {
    const where = CenterScope.filter(req.user);
    return this.prisma.class.findMany({
      where,
      include: {
        program: true,
        center: { select: { id: true, name: true, code: true } },
        teacher: { select: { id: true, fullName: true } },
        _count: { select: { students: true } },
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
    
    // Auto-generate code if missing
    if (!data.code) {
       data.code = `CLS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    }

    return this.prisma.class.create({
      data: {
        ...data,
        schedules: data.schedules ? { create: data.schedules } : undefined,
      },
    });
  }

  @Patch(':id')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    return this.prisma.class.update({
      where: { id },
      data: {
        ...data,
        schedules: data.schedules ? {
          deleteMany: {},
          create: data.schedules
        } : undefined
      },
    });
  }

  @Post(':id/enroll')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async enroll(@Param('id') id: string, @Body() body: { studentId: string }, @Request() req: any) {
    // 1. Validate Class existence and Center Scope
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    // 2. Check Capacity
    if (cls._count.students >= cls.capacity) {
      throw new BadRequestException('Class is full');
    }

    // 3. Validate Student existence and Center consistency
    const student = await this.prisma.student.findUnique({ where: { id: body.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    
    if (student.centerId !== cls.centerId) {
      throw new BadRequestException('Student and Class must be in the same center');
    }

    // 4. Check duplicate active enrollment in THIS class
    const existingClassStudent = await this.prisma.classStudent.findUnique({
      where: { classId_studentId: { classId: id, studentId: body.studentId } }
    });
    if (existingClassStudent) throw new BadRequestException('Student already enrolled in this class');

    // 5. Execute Transaction
    return this.prisma.$transaction(async (tx) => {
      // Create ClassStudent link
      const classStudent = await tx.classStudent.create({
        data: {
          classId: id,
          studentId: body.studentId,
          status: 'ACTIVE'
        }
      });

      // Upsert Enrollment record for the program
      await tx.enrollment.upsert({
        where: {
          // Note: In a real system, you might need a unique constraint on (studentId, programId)
          // For now, we search for existing enrollment or create a new one
          id: (await tx.enrollment.findFirst({
            where: { studentId: body.studentId, programId: cls.programId }
          }))?.id || 'new-uuid' 
        },
        create: {
          studentId: body.studentId,
          programId: cls.programId,
          classId: id,
          status: 'ACTIVE',
          startDate: new Date(),
        },
        update: {
          classId: id,
          status: 'ACTIVE',
        }
      });

      // Update Student Status
      await tx.student.update({
        where: { id: body.studentId },
        data: { status: 'ACTIVE' }
      });

      return classStudent;
    });
  }

  @Delete(':id/unenroll/:studentId')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async unenroll(@Param('id') id: string, @Param('studentId') studentId: string, @Request() req: any) {
    const cls = await this.prisma.class.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found');
    CenterScope.validate(req.user, cls.centerId);

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete ClassStudent link
      await tx.classStudent.delete({
        where: { classId_studentId: { classId: id, studentId } }
      });

      // 2. Update Enrollment status (unlinking from class)
      await tx.enrollment.updateMany({
        where: { studentId, classId: id },
        data: { 
          classId: null,
          status: 'SUSPENDED' // Marking as suspended as they are out of class
        }
      });

      // 3. Optional: Check if student has other active classes
      const otherClasses = await tx.classStudent.count({
        where: { studentId, status: 'ACTIVE' }
      });
      if (otherClasses === 0) {
        await tx.student.update({
          where: { id: studentId },
          data: { status: 'HOLD' } // Move to HOLD if no active classes
        });
      }

      return { success: true };
    });
  }
}
