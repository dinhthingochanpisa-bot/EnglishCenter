import { Controller, Get, Patch, Body, UseGuards, Param } from '@nestjs/common';
import { ModulesService } from './modules.service';
import { JwtAuthGuard } from './auth/guards/auth.guards';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { Permissions } from './common/decorators/rbac.decorator';
import { Public } from './common/decorators/public.decorator';

@Controller('modules')
export class ModulesController {
  constructor(private readonly modulesService: ModulesService) {}

  @Public()
  @Get()
  listModules() {
    return this.modulesService.listModules();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('SETTINGS_ADMIN.UPDATE')
  @Patch(':code/toggle')
  toggleModule(
    @Param('code') code: string,
    @Body('isEnabled') isEnabled: boolean,
  ) {
    return this.modulesService.toggleModule(code, isEnabled);
  }
}
