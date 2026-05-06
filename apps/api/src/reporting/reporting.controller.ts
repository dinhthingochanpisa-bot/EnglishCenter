import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { ReportingService } from './reporting.service';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('reporting')
@RequireModule('REPORTING')
export class ReportingController {
  constructor(private reportingService: ReportingService) {}

  @Get('executive')
  @Permissions('REPORTING.VIEW')
  getExecutive(@Request() req: any, @Query('centerId') centerId?: string) {
    return this.reportingService.getExecutiveDashboard(req.user, centerId);
  }

  @Get('sales')
  @Permissions('REPORTING.VIEW')
  getSales(@Request() req: any, @Query('centerId') centerId?: string) {
    return this.reportingService.getSalesDashboard(req.user, centerId);
  }

  @Get('academic')
  @Permissions('REPORTING.VIEW')
  getAcademic(@Request() req: any, @Query('centerId') centerId?: string) {
    return this.reportingService.getAcademicDashboard(req.user, centerId);
  }

  @Get('family-insights')
  @Permissions('REPORTING.VIEW')
  getFamilyInsights(@Request() req: any, @Query('centerId') centerId?: string) {
    return this.reportingService.getFamilyInsights(req.user, centerId);
  }

  @Get('notifications')
  @Permissions('REPORTING.VIEW')
  getNotifications(@Request() req: any, @Query('centerId') centerId?: string) {
    return this.reportingService.getNotifications(req.user, centerId);
  }
}
