import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Gender, StudentStatus } from '@prisma/client';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên học sinh không được để trống' })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã học sinh không được để trống' })
  code: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsDateString({}, { message: 'Ngày sinh không hợp lệ' })
  @IsOptional()
  birthday?: string;

  @IsString()
  @IsNotEmpty({ message: 'ID trung tâm không được để trống' })
  centerId: string;

  @IsString()
  @IsOptional()
  target?: string;

  @IsEnum(StudentStatus)
  @IsOptional()
  status?: StudentStatus;
}
