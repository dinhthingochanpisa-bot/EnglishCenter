import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CenterScope } from '../../common/utils/center-scope.utils';
import { ContractService } from './contract.service';
import { CreateContractDto, UpdateContractDto } from './contract.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('commercial/contracts')
@RequireModule('CONTRACT')
export class ContractController {
  constructor(private contractService: ContractService) {}

  @Get()
  @Permissions('CONTRACT.VIEW')
  async findAll(@Request() req: any, @Query('centerId') centerId?: string) {
    const where = CenterScope.filter(req.user, 'centerId', centerId);
    return this.contractService.findAll(where);
  }

  @Get(':id')
  @Permissions('CONTRACT.VIEW')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const contract = await this.contractService.findOne(id);
    if (contract) {
      CenterScope.validate(req.user, contract.centerId);
    }
    return contract;
  }

  @Post('quote')
  @Permissions('CONTRACT.VIEW')
  async quote(@Body() data: any) {
    return this.contractService.quote(data);
  }

  @Post()
  @Permissions('CONTRACT.CREATE')
  async create(@Body() data: CreateContractDto, @Request() req: any) {
    return this.contractService.create(data, req.user.userId, req.user);
  }

  @Patch(':id')
  @Permissions('CONTRACT.UPDATE')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateContractDto,
    @Request() req: any,
  ) {
    return this.contractService.update(id, data, req.user.userId, req.user);
  }
}
