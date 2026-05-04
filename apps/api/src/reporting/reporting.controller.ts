import { Controller, Get, UseGuards, Request } from '@nestjs/common';
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
  getExecutive(@Request() req: any) {
    return this.reportingService.getExecutiveDashboard(req.user);
  }

  @Get('sales')
  @Permissions('REPORTING.VIEW')
  getSales(@Request() req: any) {
    return this.reportingService.getSalesDashboard(req.user);
  }

  @Get('academic')
  @Permissions('REPORTING.VIEW')
  getAcademic(@Request() req: any) {
    return this.reportingService.getAcademicDashboard(req.user);
  }

  @Get('family-insights')
  @Permissions('REPORTING.VIEW')
  getFamilyInsights(@Request() req: any) {
    return this.reportingService.getFamilyInsights(req.user);
  }

  @Get('notifications')
  @Permissions('REPORTING.VIEW')
  getNotifications(@Request() req: any) {
    return this.reportingService.getNotifications(req.user);
  }
}
