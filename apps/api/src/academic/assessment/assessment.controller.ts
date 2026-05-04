import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { CenterScope } from '../../common/utils/center-scope.utils';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { AcademicResultType } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('academic/assessments')
@RequireModule('CLASS_ACADEMIC')
export class AssessmentController {
  constructor(private prisma: PrismaService) {}

  @Get('student/:studentId')
  @Permissions('CLASS_ACADEMIC.VIEW')
  async findByStudent(@Param('studentId') studentId: string, @Request() req: any) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    const [results, notes] = await Promise.all([
      this.prisma.academicResult.findMany({
        where: { studentId },
        include: { class: { select: { name: true, code: true } } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.progressNote.findMany({
        where: { studentId },
        include: { 
          class: { select: { name: true } },
          teacher: { select: { fullName: true } }
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    return { results, notes };
  }

  @Post('results')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async createResult(
    @Body() data: { 
      studentId: string; 
      classId?: string; 
      type: AcademicResultType; 
      score: number; 
      date: string; 
      comments?: string 
    },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    return this.prisma.academicResult.create({
      data: {
        ...data,
        date: new Date(data.date),
      },
    });
  }

  @Post('notes')
  @Permissions('CLASS_ACADEMIC.UPDATE')
  async createNote(
    @Body() data: { 
      studentId: string; 
      classId?: string; 
      content: string; 
      date?: string 
    },
    @Request() req: any,
  ) {
    const student = await this.prisma.student.findUnique({ where: { id: data.studentId } });
    if (!student) throw new NotFoundException('Student not found');
    CenterScope.validate(req.user, student.centerId);

    return this.prisma.progressNote.create({
      data: {
        ...data,
        teacherId: req.user.id,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
  }
}
