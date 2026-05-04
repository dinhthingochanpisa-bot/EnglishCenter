import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const MONBAY_CONFIG_KEY = 'MONBAY_CRM_CONFIG';
const MONBAY_PRICING_KEY = 'MONBAY_CRM_PRICING';

const DEFAULT_MONBAY_CONFIG = {
  products: [] as string[],
  leadSources: [] as string[],
  officialStudentStatuses: [] as string[],
  consultShifts: [] as string[],
  consultSlots: [] as Array<{ code: string; time: string }>,
  ranks: {
    ielts: [] as string[],
    sat: [] as string[],
    junior: [] as string[],
    all: [] as string[],
  },
  feePackages: {
    ielts: [] as string[],
    sat: [] as string[],
    junior: [] as string[],
    all: [] as string[],
  },
  pricingMatrix: [] as Array<{
    product: string;
    rank: string;
    feePackage: string;
    unitPrice: number;
    discountPercent?: string | null;
    discountAmount?: number | null;
    priceKey?: string | null;
  }>,
  discountSegments: [] as Array<{
    code: string;
    name: string;
    mode: string;
    percent: number | null;
    amount: number | null;
    minSessions: number | null;
  }>,
  promotions: [] as Array<{
    code: string;
    name: string;
    mode: string;
    percent: number | null;
    amount: number | null;
    active: boolean;
  }>,
};

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  roleId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: true,
  centers: {
    select: {
      centerId: true,
      center: true,
    },
  },
};

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private parseJson(value?: string | null, fallback: any = {}) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  private mergeMonbayConfig(config: any) {
    return {
      ...DEFAULT_MONBAY_CONFIG,
      ...(config || {}),
      ranks: {
        ...DEFAULT_MONBAY_CONFIG.ranks,
        ...(config?.ranks || {}),
      },
      feePackages: {
        ...DEFAULT_MONBAY_CONFIG.feePackages,
        ...(config?.feePackages || {}),
      },
    };
  }

  private async getMonbayConfig() {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key: MONBAY_CONFIG_KEY },
      select: { value: true },
    });
    const [pricing, discountSegments, promotions] = await Promise.all([
      this.prisma.systemConfig.findUnique({
        where: { key: MONBAY_PRICING_KEY },
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

    const parsed = this.mergeMonbayConfig(this.parseJson(config?.value));
    const pricingMatrix = parsed.pricingMatrix?.length
      ? parsed.pricingMatrix
      : this.parseJson(pricing?.value, []);
    const discountSegmentItems = parsed.discountSegments?.length
      ? parsed.discountSegments
      : this.parseJson(discountSegments?.value, []);
    const promotionItems = parsed.promotions?.length
      ? parsed.promotions
      : this.parseJson(promotions?.value, []);

    return this.mergeMonbayConfig({
      ...parsed,
      pricingMatrix,
      discountSegments: discountSegmentItems,
      promotions: promotionItems,
    });
  }

  private async saveSystemConfig(key: string, value: any) {
    return this.prisma.systemConfig.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  private uniqueStrings(items: any[]) {
    const seen = new Set<string>();
    return (items || [])
      .map((item) => String(item || '').trim())
      .filter((item) => {
        if (!item || seen.has(item.toLowerCase())) return false;
        seen.add(item.toLowerCase());
        return true;
      });
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

  private normalizeRoleCode(value: string) {
    return (value || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private sessionCountFromPackage(value: string) {
    const match = String(value || '').match(/\d+/);
    return match ? Number(match[0]) : null;
  }

  private normalizeBuckets(raw: any) {
    return {
      ielts: this.uniqueStrings(raw?.ielts || []),
      sat: this.uniqueStrings(raw?.sat || []),
      junior: this.uniqueStrings(raw?.junior || []),
      all: this.uniqueStrings(raw?.all || []),
    };
  }

  private normalizePricingItems(items: any[]) {
    return (items || [])
      .map((item) => {
        const product = String(item.product || '').trim();
        const rank = String(item.rank || '').trim();
        const feePackage = String(item.feePackage || '').trim();
        const unitPrice = Number(item.unitPrice);
        if (!product || !rank || !feePackage || !Number.isFinite(unitPrice)) {
          return null;
        }
        return {
          product,
          rank,
          feePackage,
          unitPrice,
          discountPercent: item.discountPercent ? String(item.discountPercent).trim() : null,
          discountAmount:
            item.discountAmount === '' || item.discountAmount == null
              ? null
              : Number(item.discountAmount),
          priceKey: `${product}|${rank}|${feePackage}`,
        };
      })
      .filter(Boolean);
  }

  private normalizePercent(value: any) {
    if (value === '' || value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw) return null;
    const parsed = Number(raw.replace(',', '.').replace('%', ''));
    if (!Number.isFinite(parsed)) return null;
    return raw.includes('%') ? parsed / 100 : parsed;
  }

  private normalizeOptionalNumber(value: any) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private normalizeDiscountSegments(items: any[]) {
    return (items || [])
      .map((item) => {
        const code = String(item.code || '').trim();
        const name = String(item.name || '').trim();
        const mode = String(item.mode || '').trim();
        if (!code || !name) return null;
        return {
          code,
          name,
          mode: mode || 'BASE',
          percent: this.normalizePercent(item.percent),
          amount: this.normalizeOptionalNumber(item.amount),
          minSessions: this.normalizeOptionalNumber(item.minSessions),
        };
      })
      .filter(Boolean);
  }

  private normalizePromotions(items: any[]) {
    return (items || [])
      .map((item) => {
        const code = String(item.code || '').trim();
        const name = String(item.name || '').trim();
        const mode = String(item.mode || '').trim();
        if (!code || !name) return null;
        return {
          code,
          name,
          mode: mode || 'ADD_PCT',
          percent: this.normalizePercent(item.percent),
          amount: this.normalizeOptionalNumber(item.amount),
          active: item.active === undefined ? true : Boolean(item.active),
        };
      })
      .filter(Boolean);
  }

  private async ensureProgramFromProduct(productName: string) {
    const name = productName.trim();
    const code = this.normalizeCode(name);
    const product =
      (await this.prisma.product.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      })) ||
      (await this.prisma.product.create({
        data: { name, description: `Imported from CRM Monbay: ${name}` },
      }));

    const program = await this.prisma.program.upsert({
      where: { code },
      update: { name, productId: product.id },
      create: { code, name, productId: product.id },
    });

    const defaultPlan = await this.prisma.plan.findFirst({
      where: { programId: program.id, name: `${name} default` },
    });
    if (!defaultPlan) {
      await this.prisma.plan.create({
        data: {
          programId: program.id,
          name: `${name} default`,
          price: 0,
          durationMonths: 1,
        },
      });
    }

    return program;
  }

  private async syncProducts(products: string[]) {
    for (const product of products) {
      await this.ensureProgramFromProduct(product);
    }
  }

  private async syncPlansFromPricing(pricingMatrix: any[]) {
    for (const item of pricingMatrix) {
      const program = await this.ensureProgramFromProduct(item.product);
      const planName = `${item.rank} - ${item.feePackage}`;
      const data = {
        programId: program.id,
        name: planName,
        price: item.unitPrice,
        durationMonths: 1,
        sessionCount: this.sessionCountFromPackage(item.feePackage),
      };
      const existing = await this.prisma.plan.findFirst({
        where: { programId: program.id, name: planName },
      });
      if (existing) {
        await this.prisma.plan.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.plan.create({ data });
      }
    }
  }

  // --- User Management ---
  async listUsers() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUser(data: any) {
    const hashedPassword = await bcrypt.hash(
      data.password || 'password123',
      10,
    );
    return this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        fullName: data.fullName,
        roleId: data.roleId,
        isActive: data.isActive !== undefined ? data.isActive : true,
        centers: {
          create: data.centerIds?.map((id: string) => ({ centerId: id })) || [],
        },
      },
      select: USER_SELECT,
    });
  }

  async updateUser(id: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {
      email: data.email,
      fullName: data.fullName,
      roleId: data.roleId,
      isActive: data.isActive,
    };

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    if (data.centerIds) {
      // Simple sync: delete all and recreate
      await this.prisma.userCenter.deleteMany({ where: { userId: id } });
      updateData.centers = {
        create: data.centerIds.map((cId: string) => ({ centerId: cId })),
      };
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: USER_SELECT,
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({
      where: { id },
      select: { id: true, email: true },
    });
  }

  // --- Role & Permission Management ---
  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  async createRole(data: any) {
    const code = this.normalizeRoleCode(data.code);
    const name = String(data.name || '').trim();
    if (!code || !name) {
      throw new BadRequestException('Role code and name are required');
    }

    const permissionIds = Array.isArray(data.permissionIds)
      ? data.permissionIds
      : [];

    return this.prisma.role.create({
      data: {
        code,
        name,
        permissions: {
          create: permissionIds.map((permissionId: string) => ({
            permissionId,
          })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
      },
    });
  }

  async updateRole(id: string, data: any) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Role not found');

    const code = this.normalizeRoleCode(data.code || existing.code);
    const name = String(data.name || existing.name).trim();
    if (!code || !name) {
      throw new BadRequestException('Role code and name are required');
    }

    const permissionIds = Array.isArray(data.permissionIds)
      ? data.permissionIds
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
      }

      return tx.role.update({
        where: { id },
        data: {
          code,
          name,
          ...(permissionIds
            ? {
                permissions: {
                  create: permissionIds.map((permissionId: string) => ({
                    permissionId,
                  })),
                },
              }
            : {}),
        },
        include: {
          permissions: { include: { permission: true } },
        },
      });
    });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role.code === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot delete SUPER_ADMIN role');
    }
    if (role._count.users > 0) {
      throw new BadRequestException('Cannot delete role while users are assigned');
    }

    await this.prisma.rolePermission.deleteMany({ where: { roleId: id } });
    return this.prisma.role.delete({ where: { id } });
  }

  async getBusinessConfig() {
    const [config, roles, permissions, leadSources, products] =
      await Promise.all([
        this.getMonbayConfig(),
        this.listRoles(),
        this.listPermissions(),
        this.prisma.leadSource.findMany({ orderBy: { name: 'asc' } }),
        this.prisma.product.findMany({
          include: {
            programs: {
              include: {
                plans: { orderBy: { name: 'asc' } },
              },
              orderBy: { code: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
        }),
      ]);

    return {
      config,
      roles,
      permissions,
      leadSources,
      products,
      enums: {
        leadStatuses: ['NEW', 'CONTACTED', 'QUALIFIED', 'NURTURING', 'LOST', 'CONVERTED'],
        studentStatusEnums: ['PENDING', 'TRIAL', 'ACTIVE', 'HOLD', 'COMPLETED', 'DROPPED', 'RENEWAL_CANDIDATE'],
      },
    };
  }

  async updateBusinessConfigSection(section: string, data: any) {
    const config = await this.getMonbayConfig();

    if (section === 'consult-slots') {
      const consultSlots = (data.items || [])
        .map((item: any) => ({
          code: String(item.code || '').trim(),
          time: String(item.time || '').trim(),
        }))
        .filter((item: any) => item.code && item.time);
      config.consultSlots = consultSlots;
      config.consultShifts = this.uniqueStrings(consultSlots.map((item: any) => item.code));
    } else if (section === 'student-statuses') {
      config.officialStudentStatuses = this.uniqueStrings(data.items || []);
    } else if (section === 'catalog') {
      config.products = this.uniqueStrings(data.products || []);
      config.ranks = this.normalizeBuckets(data.ranks);
      config.feePackages = this.normalizeBuckets(data.feePackages);
      await this.syncProducts(config.products);
    } else if (section === 'pricing') {
      const pricingMatrix = this.normalizePricingItems(data.items || []);
      config.pricingMatrix = pricingMatrix;
      config.products = this.uniqueStrings([
        ...(config.products || []),
        ...pricingMatrix.map((item: any) => item.product),
      ]);
      config.ranks = {
        ...config.ranks,
        all: this.uniqueStrings([
          ...(config.ranks?.all || []),
          ...pricingMatrix.map((item: any) => item.rank),
        ]),
      };
      config.feePackages = {
        ...config.feePackages,
        all: this.uniqueStrings([
          ...(config.feePackages?.all || []),
          ...pricingMatrix.map((item: any) => item.feePackage),
        ]),
      };
      await this.saveSystemConfig(MONBAY_PRICING_KEY, pricingMatrix);
      await this.syncPlansFromPricing(pricingMatrix);
    } else if (section === 'discount-segments') {
      const discountSegments = this.normalizeDiscountSegments(data.items || []);
      config.discountSegments = discountSegments;
      await this.saveSystemConfig('MONBAY_CRM_DISCOUNT_SEGMENTS', discountSegments);
    } else if (section === 'promotions') {
      const promotions = this.normalizePromotions(data.items || []);
      config.promotions = promotions;
      await this.saveSystemConfig('MONBAY_CRM_PROMOTIONS', promotions);
    } else {
      throw new BadRequestException('Unsupported config section');
    }

    await this.saveSystemConfig(MONBAY_CONFIG_KEY, config);
    return this.getBusinessConfig();
  }

  async createLeadSource(data: any) {
    const name = String(data.name || '').trim();
    if (!name) throw new BadRequestException('Lead source name is required');
    return this.prisma.leadSource.create({ data: { name } });
  }

  async updateLeadSource(id: string, data: any) {
    const name = String(data.name || '').trim();
    if (!name) throw new BadRequestException('Lead source name is required');
    return this.prisma.leadSource.update({ where: { id }, data: { name } });
  }

  async deleteLeadSource(id: string) {
    const source = await this.prisma.leadSource.findUnique({
      where: { id },
      include: { _count: { select: { leads: true } } },
    });
    if (!source) throw new NotFoundException('Lead source not found');
    if (source._count.leads > 0) {
      throw new BadRequestException('Cannot delete lead source while leads are using it');
    }
    return this.prisma.leadSource.delete({ where: { id } });
  }

  // --- Center Management ---
  async listCenters() {
    return this.prisma.center.findMany({
      include: {
        _count: {
          select: { users: true, students: true, contracts: true },
        },
      },
    });
  }

  async createCenter(data: any) {
    return this.prisma.center.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
      },
      include: {
        _count: {
          select: { users: true, students: true, contracts: true },
        },
      },
    });
  }

  async updateCenter(id: string, data: any) {
    return this.prisma.center.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        phone: data.phone,
      },
      include: {
        _count: {
          select: { users: true, students: true, contracts: true },
        },
      },
    });
  }

  async deleteCenter(id: string) {
    return this.prisma.center.delete({ where: { id } });
  }

  async assignUserToCenter(userId: string, centerId: string) {
    return this.prisma.userCenter.upsert({
      where: { userId_centerId: { userId, centerId } },
      update: {},
      create: { userId, centerId },
    });
  }

  async removeUserFromCenter(userId: string, centerId: string) {
    return this.prisma.userCenter.delete({
      where: { userId_centerId: { userId, centerId } },
    });
  }

  // --- Audit Logs ---
  async getAuditLogs(params: {
    user: any;
    take?: number;
    skip?: number;
    entity?: string;
    action?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
  }) {
    const {
      user,
      take = 50,
      skip = 0,
      entity,
      action,
      actorId,
      from,
      to,
    } = params;

    const where: any = {};

    if (user.role !== 'SUPER_ADMIN') {
      where.centerId = { in: user.allowedCenterIds || [] };
    }

    if (entity) where.entityType = entity;
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = from;
      if (to) where.timestamp.lte = to;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { timestamp: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
