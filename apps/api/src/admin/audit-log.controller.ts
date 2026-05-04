import {
  Controller,
  Get,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/audit-logs')
@RequireModule('AUDIT_LOG')
export class AuditLogController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @Permissions('AUDIT_LOG.VIEW')
  getAuditLogs(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getAuditLogs({
      user: req.user,
      take: limit ? parseInt(limit) : 50,
      skip: skip ? parseInt(skip) : 0,
      entity,
      action,
      actorId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
