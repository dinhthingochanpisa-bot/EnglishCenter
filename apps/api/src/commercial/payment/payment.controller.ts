import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CenterScope } from '../../common/utils/center-scope.utils';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './payment.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('commercial/payments')
@RequireModule('PAYMENT_RECEIVABLE')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Get()
  @Permissions('PAYMENT_RECEIVABLE.VIEW')
  async findAll(@Request() req: any) {
    const where = CenterScope.filter(req.user);
    return this.paymentService.findAll(where);
  }

  @Post()
  @Permissions('PAYMENT_RECEIVABLE.CREATE')
  async create(@Body() data: CreatePaymentDto, @Request() req: any) {
    // Service handles center scope validation and userId for audit
    return this.paymentService.create(data, req.user.userId, req.user);
  }

  @Get('receivables')
  @Permissions('PAYMENT_RECEIVABLE.VIEW')
  async getReceivables(@Request() req: any) {
    // Fix: CenterScope.filter with 'contract.centerId' doesn't work for nested relations in Prisma
    // We must manually construct the nested filter
    let where: any = {};
    if (req.user.role !== 'SUPER_ADMIN') {
      where = {
        contract: {
          centerId: { in: req.user.allowedCenterIds || [] }
        }
      };
    }
    return this.paymentService.getReceivables(where);
  }

  @Get('receivables/family/:familyId')
  @Permissions('PAYMENT_RECEIVABLE.VIEW')
  async getFamilyReceivables(@Param('familyId') familyId: string, @Request() req: any) {
    return this.paymentService.getFamilyReceivables(familyId, req.user);
  }
}
