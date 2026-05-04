import { Controller, Get, Patch, Param, Body, Request, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { OpportunityService } from './opportunity.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { OpportunityStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('crm')
@RequireModule('CRM_LEADS')
export class CrmController {
  constructor(
    private crmService: CrmService,
    private opportunityService: OpportunityService,
  ) {}

  @Get('pipeline')
  @RequireModule('SALES_PIPELINE')
  @Permissions('CRM_LEADS.VIEW')
  async getPipeline(@Request() req: any) {
    return this.crmService.getPipeline(req.user);
  }

  @Patch('opportunities/:id/status')
  @RequireModule('SALES_PIPELINE')
  @Permissions('CRM_LEADS.UPDATE')
  async updateOpportunityStatus(
    @Param('id') id: string,
    @Body('status') status: OpportunityStatus,
    @Request() req: any,
  ) {
    return this.opportunityService.updateStatus(id, status, req.user);
  }
}
