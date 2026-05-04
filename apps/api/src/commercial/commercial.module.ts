import { Module } from '@nestjs/common';
import { ContractController } from './contract/contract.controller';
import { ContractService } from './contract/contract.service';
import { PaymentController } from './payment/payment.controller';
import { PaymentService } from './payment/payment.service';
import { RenewalController } from './renewal/renewal.controller';
import { RenewalService } from './renewal/renewal.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    ContractController,
    PaymentController,
    RenewalController,
  ],
  providers: [
    ContractService,
    PaymentService,
    RenewalService,
  ],
  exports: [
    ContractService,
    PaymentService,
    RenewalService,
  ],
})
export class CommercialModule {}
