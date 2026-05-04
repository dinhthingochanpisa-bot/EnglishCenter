import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles, Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';

@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin')
@RequireModule('SETTINGS_ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Users ---
  @Get('users')
  @Permissions('SETTINGS_ADMIN.VIEW')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Post('users')
  @Permissions('SETTINGS_ADMIN.CREATE')
  createUser(@Body() data: any) {
    return this.adminService.createUser(data);
  }

  @Patch('users/:id')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  updateUser(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateUser(id, data);
  }

  @Delete('users/:id')
  @Permissions('SETTINGS_ADMIN.DELETE')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // --- Roles & Permissions ---
  @Get('roles')
  @Permissions('SETTINGS_ADMIN.VIEW')
  listRoles() {
    return this.adminService.listRoles();
  }

  @Post('roles')
  @Permissions('SETTINGS_ADMIN.CREATE')
  createRole(@Body() data: any) {
    return this.adminService.createRole(data);
  }

  @Patch('roles/:id')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  updateRole(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateRole(id, data);
  }

  @Delete('roles/:id')
  @Permissions('SETTINGS_ADMIN.DELETE')
  deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  @Get('permissions')
  @Permissions('SETTINGS_ADMIN.VIEW')
  listPermissions() {
    return this.adminService.listPermissions();
  }

  // --- Business Configuration from CRM CONFIG sheet ---
  @Get('business-config')
  @Permissions('SETTINGS_ADMIN.VIEW')
  getBusinessConfig() {
    return this.adminService.getBusinessConfig();
  }

  @Patch('business-config/:section')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  updateBusinessConfigSection(
    @Param('section') section: string,
    @Body() data: any,
  ) {
    return this.adminService.updateBusinessConfigSection(section, data);
  }

  @Post('lead-sources')
  @Permissions('SETTINGS_ADMIN.CREATE')
  createLeadSource(@Body() data: any) {
    return this.adminService.createLeadSource(data);
  }

  @Patch('lead-sources/:id')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  updateLeadSource(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateLeadSource(id, data);
  }

  @Delete('lead-sources/:id')
  @Permissions('SETTINGS_ADMIN.DELETE')
  deleteLeadSource(@Param('id') id: string) {
    return this.adminService.deleteLeadSource(id);
  }

  // --- Centers ---
  @Get('centers')
  @Permissions('SETTINGS_ADMIN.VIEW')
  listCenters() {
    return this.adminService.listCenters();
  }

  @Post('centers')
  @Permissions('SETTINGS_ADMIN.CREATE')
  createCenter(@Body() data: any) {
    return this.adminService.createCenter(data);
  }

  @Patch('centers/:id')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  updateCenter(@Param('id') id: string, @Body() data: any) {
    return this.adminService.updateCenter(id, data);
  }

  @Delete('centers/:id')
  @Permissions('SETTINGS_ADMIN.DELETE')
  deleteCenter(@Param('id') id: string) {
    return this.adminService.deleteCenter(id);
  }

  @Post('centers/:centerId/users/:userId')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  assignUser(
    @Param('centerId') centerId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.assignUserToCenter(userId, centerId);
  }

  @Delete('centers/:centerId/users/:userId')
  @Permissions('SETTINGS_ADMIN.UPDATE')
  removeUser(
    @Param('centerId') centerId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.removeUserFromCenter(userId, centerId);
  }

}
