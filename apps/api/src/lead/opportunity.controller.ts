import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { OpportunityService } from './opportunity.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { OpportunityStatus } from '@prisma/client';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('opportunities')
@RequireModule('SALES_PIPELINE')
export class OpportunityController {
  constructor(private opportunityService: OpportunityService) {}

  @Post('pricing-quote')
  @Permissions('SALES_PIPELINE.VIEW')
  async quoteContract(@Body() body: any) {
    return this.opportunityService.quoteContract(body);
  }

  @Get(':id')
  @Permissions('SALES_PIPELINE.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.opportunityService.findOne(id, req.user);
  }

  @Get(':id/handover')
  @Permissions('SALES_PIPELINE.VIEW')
  async getSalesHandover(@Param('id') id: string, @Request() req: any) {
    return this.opportunityService.getSalesHandover(id, req.user);
  }

  @Patch(':id/handover')
  @Permissions('SALES_PIPELINE.UPDATE')
  async updateSalesHandover(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.opportunityService.updateSalesHandover(id, body, req.user);
  }

  @Patch(':id/status')
  @Permissions('SALES_PIPELINE.UPDATE')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: OpportunityStatus,
    @Request() req: any,
  ) {
    return this.opportunityService.updateStatus(id, status, req.user);
  }

  @Post(':id/checkin-profile')
  @Permissions('SALES_PIPELINE.UPDATE')
  async saveCheckinProfile(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.opportunityService.saveCheckinProfile(id, body, req.user);
  }

  @Post(':id/test-result')
  @Permissions('SALES_PIPELINE.UPDATE')
  async saveTestResult(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.opportunityService.saveTestResult(id, body, req.user);
  }

  @Post(':id/trial-class')
  @Permissions('SALES_PIPELINE.UPDATE')
  async assignTrialClass(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.opportunityService.assignTrialClass(id, body, req.user);
  }

  @Post(':id/won')
  @Permissions('SALES_PIPELINE.WON')
  async markWon(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.opportunityService.markWon(id, body, req.user);
  }
}
