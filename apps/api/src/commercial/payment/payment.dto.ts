import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { PaymentMethod, PaymentType } from '@prisma/client';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;

  @IsString()
  @IsOptional()
  notes?: string;
}
