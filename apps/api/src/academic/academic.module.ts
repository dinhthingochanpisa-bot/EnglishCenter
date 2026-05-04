import { Module } from '@nestjs/common';
import { ProductController } from './product/product.controller';
import { ClassController } from './class/class.controller';
import { AttendanceController } from './attendance/attendance.controller';
import { AssessmentController } from './assessment/assessment.controller';

@Module({
  controllers: [
    ProductController,
    ClassController,
    AttendanceController,
    AssessmentController,
  ],
})
export class AcademicModule {}
