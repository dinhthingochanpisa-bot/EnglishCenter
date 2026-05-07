import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CollaborationService } from './collaboration.service';

@UseGuards(JwtAuthGuard)
@Controller('collaboration')
export class CollaborationController {
  constructor(private collaborationService: CollaborationService) {}

  @Get(':entityType/:entityId/messages')
  async getThread(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Request() req: any,
  ) {
    return this.collaborationService.getThread(entityType, entityId, req.user);
  }

  @Post(':entityType/:entityId/messages')
  async createMessage(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.collaborationService.createMessage(
      entityType,
      entityId,
      body.content,
      req.user,
    );
  }

  @Patch('messages/:messageId')
  async updateMessage(
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.collaborationService.updateMessage(
      messageId,
      body.content,
      req.user,
    );
  }

  @Delete('messages/:messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Request() req: any,
  ) {
    return this.collaborationService.deleteMessage(messageId, req.user);
  }
}
