import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FamilyService } from './family.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('families')
@RequireModule('FAMILY_PARENT')
export class FamilyController {
  constructor(private familyService: FamilyService) {}

  @Get()
  @Permissions('FAMILY_PARENT.VIEW')
  async findAll(@Request() req: any, @Query('search') search?: string) {
    return this.familyService.findAll(req.user, search);
  }

  @Get(':id')
  @Permissions('FAMILY_PARENT.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.familyService.findOne(id, req.user);
  }
}
