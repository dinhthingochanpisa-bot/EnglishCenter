import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { LeadService } from './lead.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { ModuleGuard } from '../common/guards/module.guard';
import { Permissions } from '../common/decorators/rbac.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';

import { LeadStatus } from '@prisma/client';
import { CreateLeadDto } from './dto/create-lead.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('leads')
@RequireModule('CRM_LEADS')
export class LeadController {
  constructor(private leadService: LeadService) {}

  @Get()
  @Permissions('CRM_LEADS.VIEW')
  async findAll(@Request() req: any) {
    return this.leadService.findAll(req.user);
  }

  @Get('check-dedupe')
  @Permissions('CRM_LEADS.CREATE')
  async checkDedupe(@Query('phone') phone: string) {
    return this.leadService.checkDedupe(phone);
  }

  @Get('assignees')
  @Permissions('CRM_LEADS.ASSIGN')
  async getAssignableUsers(
    @Query('centerId') centerId: string | undefined,
    @Request() req: any,
  ) {
    return this.leadService.getAssignableUsers(req.user, centerId);
  }

  @Get(':id')
  @Permissions('CRM_LEADS.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.leadService.findOne(id, req.user);
  }

  @Post()
  @Permissions('CRM_LEADS.CREATE')
  async create(@Body() body: CreateLeadDto, @Request() req: any) {
    return this.leadService.createLead(body, req.user);
  }

  @Post(':id/convert')
  @Permissions('CRM_LEADS.CONVERT')
  async convert(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.convert(id, body, req.user);
  }

  @Post(':id/interactions')
  @Permissions('CRM_LEADS.UPDATE')
  async createInteraction(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.createInteraction(id, body, req.user);
  }

  @Patch(':id/interactions/:interactionId')
  @Permissions('CRM_LEADS.UPDATE')
  async updateInteraction(
    @Param('id') id: string,
    @Param('interactionId') interactionId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.updateInteraction(id, interactionId, body, req.user);
  }

  @Post(':id/tasks')
  @Permissions('CRM_LEADS.UPDATE')
  async createTask(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.createTask(id, body, req.user);
  }

  @Get(':id/issues')
  @Permissions('CRM_LEADS.VIEW')
  async getIssues(@Param('id') id: string, @Request() req: any) {
    return this.leadService.getIssues(id, req.user);
  }

  @Post(':id/issues')
  @Permissions('CRM_LEADS.UPDATE')
  async createIssue(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.createIssue(id, body, req.user);
  }

  @Patch(':id/issues/:issueId')
  @Permissions('CRM_LEADS.UPDATE')
  async updateIssue(
    @Param('id') id: string,
    @Param('issueId') issueId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.updateIssue(id, issueId, body, req.user);
  }

  @Patch(':id/tasks/:taskId')
  @Permissions('CRM_LEADS.UPDATE')
  async updateTask(
    @Param('id') id: string,
    @Param('taskId') taskId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.leadService.updateTask(id, taskId, body, req.user);
  }

  @Post(':id/assign')
  @Permissions('CRM_LEADS.ASSIGN')
  async assign(
    @Param('id') id: string,
    @Body('ownerId') ownerId: string,
    @Request() req: any,
  ) {
    return this.leadService.assign(id, ownerId, req.user);
  }

  @Patch(':id/status')
  @Permissions('CRM_LEADS.UPDATE')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: LeadStatus,
    @Request() req: any,
  ) {
    return this.leadService.updateStatus(id, status, req.user);
  }
}
