import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/auth.guards';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { PrismaService } from './prisma/prisma.service';
import { CenterScope } from './common/utils/center-scope.utils';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('security/deny-default-probe')
  denyByDefaultProbe() {
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('centers')
  async getCenters(@Request() req: any) {
    const where = CenterScope.filter(req.user);
    return this.prisma.center.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('config/monbay-crm')
  async getMonbayCrmConfig() {
    const [config, pricing, discountSegments, promotions] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { key: 'MONBAY_CRM_CONFIG' },
        select: { value: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'MONBAY_CRM_PRICING' },
        select: { value: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'MONBAY_CRM_DISCOUNT_SEGMENTS' },
        select: { value: true },
      }),
      this.prisma.systemConfig.findUnique({
        where: { key: 'MONBAY_CRM_PROMOTIONS' },
        select: { value: true },
      }),
    ]);

    const parseJson = (value?: string | null, fallback: any = {}) => {
      if (!value) return fallback;
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    };

    const parsed = parseJson(config?.value, {});
    return {
      ...parsed,
      pricingMatrix: parsed.pricingMatrix?.length
        ? parsed.pricingMatrix
        : parseJson(pricing?.value, []),
      discountSegments: parsed.discountSegments?.length
        ? parsed.discountSegments
        : parseJson(discountSegments?.value, []),
      promotions: parsed.promotions?.length
        ? parsed.promotions
        : parseJson(promotions?.value, []),
    };
  }
}
