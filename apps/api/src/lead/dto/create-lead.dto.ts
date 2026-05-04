import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên phụ huynh không được để trống' })
  parentName: string;

  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  phone: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty({ message: 'Tên học sinh không được để trống' })
  studentName: string;

  @IsString()
  @IsOptional()
  studentBirthday?: string;

  @IsString()
  @IsOptional()
  campaign?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  centerId?: string;

  @IsString()
  @IsOptional()
  target?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  school?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  productInterest?: string;

  @IsString()
  @IsOptional()
  demand?: string;

  @IsString()
  @IsOptional()
  fatherName?: string;

  @IsString()
  @IsOptional()
  fatherPhone?: string;

  @IsString()
  @IsOptional()
  motherName?: string;

  @IsString()
  @IsOptional()
  motherPhone?: string;

  @IsString()
  @IsOptional()
  studentPhone?: string;

  @IsString()
  @IsOptional()
  linkParentId?: string;

  @IsBoolean()
  @IsOptional()
  forceCreate?: boolean;
}
