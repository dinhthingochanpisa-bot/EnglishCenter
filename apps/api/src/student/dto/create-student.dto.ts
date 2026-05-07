import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ và tên học sinh' })
  fullName: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  @IsOptional()
  birthday?: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn trung tâm' })
  centerId: string;

  @IsString()
  @IsOptional()
  target?: string;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;
}
