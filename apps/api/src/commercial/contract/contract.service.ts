import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto, UpdateContractDto } from './contract.dto';
import { AuditService } from '../../common/audit/audit.service';
import { CenterScope } from '../../common/utils/center-scope.utils';

type ConfigDiscountSegment = {
  code: string;
  name: string;
  mode?: string | null;
  percent?: number | string | null;
  amount?: number | string | null;
  minSessions?: number | string | null;
};

type ConfigPromotion = {
  code: string;
  name: string;
  mode?: string | null;
  percent?: number | string | null;
  amount?: number | string | null;
  active?: boolean;
};

type ContractQuote = {
  listPrice: number;
  discountPercent: number;
  discountAmount: number;
  totalDiscount: number;
  finalAmount: number;
  segment: ConfigDiscountSegment | null;
  promotions: ConfigPromotion[];
  breakdown: Array<{
    code: string;
    name: string;
    mode: string;
    amount: number;
    percent?: number | null;
  }>;
};

type ContractCodeConfig = {
  template?: string;
  startNumber?: number | string;
  padding?: number | string;
};

@Injectable()
export class ContractService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  private parseJson(value?: string | null, fallback: any = {}) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  private normalizeCode(value: string) {
    return (value || 'NA')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .toUpperCase() || 'NA';
  }

  private sessionCountFromPackage(value?: string | null) {
    const match = String(value || '').match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  private optionalNumber(value: any) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizePercent(value: any) {
    if (value === '' || value == null) return null;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      return value >= 1 ? value / 100 : value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const parsed = Number(raw.replace(',', '.').replace('%', ''));
    if (!Number.isFinite(parsed)) return null;
    return raw.includes('%') || parsed >= 1 ? parsed / 100 : parsed;
  }

  private roundMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async getMonbayConfig() {
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

    const parsed = this.parseJson(config?.value, {});
    const pricingMatrix = parsed.pricingMatrix?.length
      ? parsed.pricingMatrix
      : this.parseJson(pricing?.value, []);
    const segmentItems = parsed.discountSegments?.length
      ? parsed.discountSegments
      : this.parseJson(discountSegments?.value, []);
    const promotionItems = parsed.promotions?.length
      ? parsed.promotions
      : this.parseJson(promotions?.value, []);

    return {
      ...parsed,
      pricingMatrix,
      discountSegments: segmentItems,
      promotions: promotionItems,
    };
  }

  async generateContractCode(centerId: string, tx: any = this.prisma) {
    const config = await this.getMonbayConfig();
    const codeConfig: ContractCodeConfig = config.contractCode || {};
    const template = String(codeConfig.template || '{seq}/{year}/HDDV-PISA/{centerCode}').trim();
    const startNumber = Math.max(1, Number(codeConfig.startNumber || 1));
    const padding = Math.max(0, Number(codeConfig.padding || 0));
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const center = await tx.center.findUnique({
      where: { id: centerId },
      select: { code: true, name: true },
    });
    const centerCode = String(center?.code || centerId.slice(0, 4)).toUpperCase();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const contractCount = await tx.contract.count({
        where: {
          centerId,
          createdAt: {
            gte: new Date(now.getFullYear(), 0, 1),
            lt: new Date(now.getFullYear() + 1, 0, 1),
          },
        },
      });
      const seq = String(startNumber + contractCount + attempt).padStart(padding, '0');
      const candidate = template
        .replaceAll('{seq}', seq)
        .replaceAll('{year}', year)
        .replaceAll('{month}', month)
        .replaceAll('{day}', day)
        .replaceAll('{centerCode}', centerCode)
        .replaceAll('{center}', centerCode);

      const existing = await tx.contract.findUnique({ where: { code: candidate } });
      if (!existing) return candidate;
    }

    return `CON-${centerCode}-${Date.now().toString().slice(-6)}`;
  }

  private ensureValidAmount(name: string, value: number) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${name} must be a non-negative number`);
    }
  }

  private async ensurePlanForContract(data: CreateContractDto) {
    if (data.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: data.planId },
      });
      if (!plan) throw new BadRequestException('Plan not found');
      return plan;
    }

    const productName = data.productName?.trim();
    const productRank = data.productRank?.trim();
    const feePackage = data.feePackage?.trim();

    if (!productName || !productRank || !feePackage) {
      throw new BadRequestException(
        'planId or productName/productRank/feePackage is required',
      );
    }

    const product =
      (await this.prisma.product.findFirst({
        where: { name: { equals: productName, mode: 'insensitive' } },
      })) ||
      (await this.prisma.product.create({
        data: {
          name: productName,
          description: `Created from contract pricing config: ${productName}`,
        },
      }));

    const programCode = this.normalizeCode(productName);
    const program = await this.prisma.program.upsert({
      where: { code: programCode },
      update: { name: productName, productId: product.id },
      create: { code: programCode, name: productName, productId: product.id },
    });

    const planName = `${productRank} - ${feePackage}`;
    const planPrice = Number(data.unitPrice ?? data.listPrice);
    const planData = {
      programId: program.id,
      name: planName,
      price: planPrice,
      durationMonths: 1,
      sessionCount:
        this.sessionCountFromPackage(feePackage) ??
        this.optionalNumber(data.contractedSessions),
    };

    const existing = await this.prisma.plan.findFirst({
      where: { programId: program.id, name: planName },
    });

    if (existing) {
      return this.prisma.plan.update({
        where: { id: existing.id },
        data: planData,
      });
    }

    return this.prisma.plan.create({ data: planData });
  }

  private calculateConfiguredQuote(input: {
    listPrice: number;
    discountPercent?: number | string;
    discountAmount?: number | string;
    discountSegmentCode?: string;
    promotionCodes?: string[];
    contractedSessions?: number;
    config: any;
  }): ContractQuote {
    const listPrice = Number(input.listPrice);
    this.ensureValidAmount('listPrice', listPrice);

    const segments: ConfigDiscountSegment[] = input.config.discountSegments || [];
    const promotions: ConfigPromotion[] = input.config.promotions || [];
    const requestedPromotionCodes = new Set(
      (input.promotionCodes || [])
        .map((code) => String(code || '').trim())
        .filter(Boolean),
    );
    const breakdown: ContractQuote['breakdown'] = [];

    let basePercent = 0;
    let baseAmount = 0;
    let extraAmount = 0;

    const configuredPercent = this.normalizePercent(input.discountPercent);
    if (configuredPercent) {
      basePercent += configuredPercent;
      breakdown.push({
        code: 'CONFIG_CK',
        name: 'Configured discount percent',
        mode: 'BASE',
        amount: this.roundMoney(listPrice * configuredPercent),
        percent: configuredPercent,
      });
    }

    const configuredAmount = this.optionalNumber(input.discountAmount);
    if (configuredAmount) {
      baseAmount += configuredAmount;
      breakdown.push({
        code: 'CONFIG_AMOUNT',
        name: 'Configured discount amount',
        mode: 'BASE_VND',
        amount: configuredAmount,
        percent: null,
      });
    }

    const segmentCode = input.discountSegmentCode?.trim();
    const segment = segmentCode
      ? segments.find((item) => item.code === segmentCode) || null
      : null;

    if (segmentCode && !segment) {
      throw new BadRequestException(`Discount segment ${segmentCode} not found`);
    }

    if (segment) {
      const minSessions = this.optionalNumber(segment.minSessions);
      const contractedSessions = this.optionalNumber(input.contractedSessions);
      if (
        minSessions !== null &&
        contractedSessions !== null &&
        contractedSessions < minSessions
      ) {
        throw new BadRequestException(
          `Discount segment ${segment.code} requires at least ${minSessions} sessions`,
        );
      }

      const mode = String(segment.mode || 'BASE').toUpperCase();
      const percent = this.normalizePercent(segment.percent);
      const amount = this.optionalNumber(segment.amount);

      if (mode.includes('VND') || amount) {
        const appliedAmount = amount || 0;
        baseAmount += appliedAmount;
        breakdown.push({
          code: segment.code,
          name: segment.name,
          mode,
          amount: appliedAmount,
          percent,
        });
      } else if (percent) {
        basePercent += percent;
        breakdown.push({
          code: segment.code,
          name: segment.name,
          mode,
          amount: this.roundMoney(listPrice * percent),
          percent,
        });
      }
    }

    const appliedPromotions: ConfigPromotion[] = [];
    for (const code of requestedPromotionCodes) {
      const promotion = promotions.find((item) => item.code === code);
      if (!promotion) {
        throw new BadRequestException(`Promotion ${code} not found`);
      }
      if (promotion.active === false) continue;

      appliedPromotions.push(promotion);
      const mode = String(promotion.mode || 'ADD_PCT').toUpperCase();
      const percent = this.normalizePercent(promotion.percent);
      const amount = this.optionalNumber(promotion.amount);

      if (mode.includes('VND')) {
        const appliedAmount = amount || 0;
        extraAmount += appliedAmount;
        breakdown.push({
          code: promotion.code,
          name: promotion.name,
          mode,
          amount: appliedAmount,
          percent,
        });
        continue;
      }

      if (!percent) continue;

      if (mode === 'EXTRA_AFTER_PCT') {
        const subtotalAfterBase = Math.max(
          0,
          listPrice - listPrice * basePercent - baseAmount,
        );
        const appliedAmount = this.roundMoney(subtotalAfterBase * percent);
        extraAmount += appliedAmount;
        breakdown.push({
          code: promotion.code,
          name: promotion.name,
          mode,
          amount: appliedAmount,
          percent,
        });
      } else {
        basePercent += percent;
        breakdown.push({
          code: promotion.code,
          name: promotion.name,
          mode,
          amount: this.roundMoney(listPrice * percent),
          percent,
        });
      }
    }

    const percentDiscount = listPrice * basePercent;
    const discountAmount = this.roundMoney(baseAmount + extraAmount);
    const totalDiscount = Math.min(
      listPrice,
      this.roundMoney(percentDiscount + discountAmount),
    );
    const finalAmount = this.roundMoney(Math.max(0, listPrice - totalDiscount));

    return {
      listPrice,
      discountPercent: this.roundMoney(basePercent * 100),
      discountAmount,
      totalDiscount,
      finalAmount,
      segment,
      promotions: appliedPromotions,
      breakdown,
    };
  }

  private calculateManualQuote(data: {
    listPrice: number;
    discountPercent?: number;
    discountAmount?: number;
  }) {
    const listPrice = Number(data.listPrice);
    const discountPercent = Number(data.discountPercent || 0);
    const discountAmount = Number(data.discountAmount || 0);

    this.ensureValidAmount('listPrice', listPrice);
    if (discountPercent < 0 || discountPercent > 100) {
      throw new BadRequestException('discountPercent must be between 0 and 100');
    }
    this.ensureValidAmount('discountAmount', discountAmount);

    const discountFromPercent = listPrice * (discountPercent / 100);
    const totalDiscount = discountFromPercent + discountAmount;

    if (totalDiscount > listPrice) {
      throw new BadRequestException(
        `Total discount (${totalDiscount.toLocaleString()}) cannot exceed list price (${listPrice.toLocaleString()})`,
      );
    }

    return {
      listPrice,
      discountPercent,
      discountAmount,
      totalDiscount,
      finalAmount: Math.max(0, listPrice - totalDiscount),
    };
  }

  async quote(data: {
    listPrice: number;
    discountPercent?: number | string;
    discountAmount?: number | string;
    discountSegmentCode?: string;
    promotionCodes?: string[];
    contractedSessions?: number;
  }) {
    const config = await this.getMonbayConfig();
    return this.calculateConfiguredQuote({
      listPrice: Number(data.listPrice),
      discountPercent: data.discountPercent,
      discountAmount: data.discountAmount,
      discountSegmentCode: data.discountSegmentCode,
      promotionCodes: data.promotionCodes,
      contractedSessions: data.contractedSessions
        ? Number(data.contractedSessions)
        : undefined,
      config,
    });
  }

  async findAll(where: any) {
    return this.prisma.contract.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, code: true } },
        center: { select: { id: true, name: true } },
        salesperson: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.contract.findUnique({
      where: { id },
      include: {
        student: true,
        center: true,
        salesperson: true,
        details: { include: { plan: true } },
        paymentSchedule: true,
        payments: true,
      },
    });
  }

  async create(data: CreateContractDto, userId: string, user: any) {
    const { studentId, centerId } = data;

    CenterScope.validate(user, centerId);

    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new BadRequestException('Student not found');
    if (student.centerId !== centerId) {
      throw new BadRequestException(
        'Student and contract must belong to the same center',
      );
    }

    const useConfigPricing =
      data.pricingMode === 'CONFIG' ||
      Boolean(data.discountSegmentCode) ||
      Boolean(data.promotionCodes?.length);

    const quote = useConfigPricing
      ? await this.quote({
          listPrice: Number(data.listPrice),
          discountPercent: data.discountPercent,
          discountAmount: data.discountAmount,
          discountSegmentCode: data.discountSegmentCode,
          promotionCodes: data.promotionCodes,
          contractedSessions: data.contractedSessions,
        })
      : this.calculateManualQuote({
          listPrice: Number(data.listPrice),
          discountPercent: data.discountPercent,
          discountAmount: data.discountAmount,
        });

    const plan = await this.ensurePlanForContract(data);

    const detailUnitPrice = Number(data.unitPrice || quote.listPrice);

    return this.prisma.$transaction(async (tx) => {
      const code = await this.generateContractCode(centerId, tx);
      const contract = await tx.contract.create({
        data: {
          code,
          studentId,
          centerId,
          ownerId: userId,
          listPrice: quote.listPrice,
          discountPercent: quote.discountPercent,
          discountAmount: quote.discountAmount,
          finalAmount: quote.finalAmount,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          status: 'ACTIVE',
          contractType: useConfigPricing ? 'CONFIG_PRICING' : undefined,
          productName: data.productName || undefined,
          productRank: data.productRank || undefined,
          feePackage: data.feePackage || undefined,
          contractedSessions: data.contractedSessions
            ? Number(data.contractedSessions)
            : undefined,
          details: {
            create: {
              planId: plan.id,
              quantity: 1,
              unitPrice: detailUnitPrice,
              discount: quote.totalDiscount,
              totalPrice: quote.finalAmount,
            },
          },
          paymentSchedule: {
            create: {
              dueDate: new Date(data.startDate),
              amount: quote.finalAmount,
              paidAmount: 0,
              remainingAmount: quote.finalAmount,
              status: quote.finalAmount === 0 ? 'PAID' : 'UNPAID',
            },
          },
        },
      });

      await this.auditService.trackChange(
        userId,
        'Contract',
        contract.id,
        'CREATE',
        contract,
        null,
        centerId,
      );

      return contract;
    });
  }

  async update(id: string, data: UpdateContractDto, userId: string, user: any) {
    const existing = await this.prisma.contract.findUnique({
      where: { id },
      include: { paymentSchedule: true },
    });
    if (!existing) throw new NotFoundException('Contract not found');

    CenterScope.validate(user, existing.centerId);

    const quote = this.calculateManualQuote({
      listPrice: Number(existing.listPrice),
      discountPercent:
        data.discountPercent !== undefined
          ? Number(data.discountPercent)
          : Number(existing.discountPercent),
      discountAmount:
        data.discountAmount !== undefined
          ? Number(data.discountAmount)
          : Number(existing.discountAmount),
    });

    const isPriceChanging = quote.finalAmount !== Number(existing.finalAmount);

    if (isPriceChanging) {
      const hasPayments = existing.paymentSchedule.some(
        (item) => Number(item.paidAmount) > 0,
      );
      if (hasPayments) {
        throw new BadRequestException(
          'Cannot change contract amount after payments exist',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: {
          ...data,
          finalAmount: quote.finalAmount,
        },
      });

      if (isPriceChanging) {
        await tx.paymentSchedule.deleteMany({ where: { contractId: id } });
        await tx.paymentSchedule.create({
          data: {
            contractId: id,
            dueDate: existing.startDate,
            amount: quote.finalAmount,
            paidAmount: 0,
            remainingAmount: quote.finalAmount,
            status: quote.finalAmount === 0 ? 'PAID' : 'UNPAID',
          },
        });
      }

      await this.auditService.trackChange(
        userId,
        'Contract',
        id,
        'UPDATE',
        updated,
        existing,
        existing.centerId,
      );

      return updated;
    });
  }
}
