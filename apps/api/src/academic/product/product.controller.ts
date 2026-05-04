import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/auth.guards';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ModuleGuard } from '../../common/guards/module.guard';
import { Permissions } from '../../common/decorators/rbac.decorator';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard, ModuleGuard)
@Controller('academic')
@RequireModule('PROGRAM_PRODUCT')
export class ProductController {
  constructor(private prisma: PrismaService) {}

  // Products
  @Get('products')
  @Permissions('PROGRAM_PRODUCT.VIEW')
  async findAllProducts() {
    return this.prisma.product.findMany({
      include: { programs: true },
      orderBy: { name: 'asc' },
    });
  }

  @Post('products')
  @Permissions('PROGRAM_PRODUCT.CREATE')
  async createProduct(@Body() data: any) {
    return this.prisma.product.create({ data });
  }

  @Patch('products/:id')
  @Permissions('PROGRAM_PRODUCT.UPDATE')
  async updateProduct(@Param('id') id: string, @Body() data: any) {
    return this.prisma.product.update({ where: { id }, data });
  }

  // Programs
  @Get('programs')
  @Permissions('PROGRAM_PRODUCT.VIEW')
  async findAllPrograms() {
    return this.prisma.program.findMany({
      include: { 
        product: true, 
        levels: { orderBy: { order: 'asc' } }, 
        plans: true 
      },
      orderBy: { code: 'asc' },
    });
  }

  @Post('programs')
  @Permissions('PROGRAM_PRODUCT.CREATE')
  async createProgram(@Body() data: any) {
    return this.prisma.program.create({ data });
  }

  @Get('programs/:id')
  @Permissions('PROGRAM_PRODUCT.VIEW')
  async findOneProgram(@Param('id') id: string) {
    return this.prisma.program.findUnique({
      where: { id },
      include: { product: true, levels: true, plans: true },
    });
  }

  // Levels
  @Post('levels')
  @Permissions('PROGRAM_PRODUCT.CREATE')
  async createLevel(@Body() data: any) {
    return this.prisma.level.create({ data });
  }

  // Plans
  @Post('plans')
  @Permissions('PROGRAM_PRODUCT.CREATE')
  async createPlan(@Body() data: any) {
    return this.prisma.plan.create({ data });
  }
}
