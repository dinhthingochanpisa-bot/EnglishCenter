import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ContractStatus } from '@prisma/client';

export class CreateContractDto {
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @IsString()
  @IsNotEmpty()
  centerId: string;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsIn(['MANUAL', 'CONFIG'])
  @IsOptional()
  pricingMode?: 'MANUAL' | 'CONFIG';

  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  productRank?: string;

  @IsString()
  @IsOptional()
  feePackage?: string;

  @IsNumber()
  @IsOptional()
  unitPrice?: number;

  @IsNumber()
  @IsOptional()
  contractedSessions?: number;

  @IsString()
  @IsOptional()
  discountSegmentCode?: string;

  @IsArray()
  @IsOptional()
  promotionCodes?: string[];

  @IsNumber()
  listPrice: number;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}

export class UpdateContractDto {
  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsEnum(ContractStatus)
  @IsOptional()
  status?: ContractStatus;
}
