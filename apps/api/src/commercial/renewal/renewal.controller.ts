import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CenterScope } from '../../common/utils/center-scope.utils';
import { RenewalService } from './renewal.service';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('commercial/renewals')
@RequireModule('RENEWAL_RETENTION')
export class RenewalController {
  constructor(private renewalService: RenewalService) {}

  @Get('candidates')
  @Permissions('RENEWAL_RETENTION.VIEW')
  async findCandidates(@Request() req: any, @Query('days') days?: string) {
    const where = CenterScope.filter(req.user);
    return this.renewalService.findRenewalCandidates(where, days ? parseInt(days) : 30);
  }

  @Post(':contractId')
  @Permissions('RENEWAL_RETENTION.CREATE')
  async createRenewal(@Param('contractId') contractId: string, @Request() req: any) {
    // Pass user object for scope validation in service
    return this.renewalService.createRenewal(contractId, req.user.userId, req.user);
  }
}
