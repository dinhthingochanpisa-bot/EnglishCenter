import { Controller, Get, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ParentService } from './parent.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('parents')
@RequireModule('FAMILY_PARENT')
export class ParentController {
  constructor(private parentService: ParentService) {}

  @Get()
  @Permissions('FAMILY_PARENT.VIEW')
  async findAll(@Request() req: any, @Query('search') search?: string) {
    return this.parentService.findAll(req.user, search);
  }

  @Get(':id')
  @Permissions('FAMILY_PARENT.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.parentService.findOne(id, req.user);
  }

  @Patch(':id')
  @Permissions('FAMILY_PARENT.UPDATE')
  async update(@Param('id') id: string, @Body() data: any, @Request() req: any) {
    return this.parentService.update(id, data, req.user);
  }
}
