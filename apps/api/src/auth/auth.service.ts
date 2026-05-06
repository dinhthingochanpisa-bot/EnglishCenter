import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

type RoleOption = {
  userRoleId: string;
  roleId: string;
  role: string;
  roleName: string;
  permissions: string[];
  allowedCenterIds: string[];
  centers: Array<{ id: string; code?: string; name?: string }>;
  isDefault?: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private getUserInclude() {
    return {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
      centers: {
        include: { center: true },
      },
      userRoles: {
        where: { isActive: true },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
          centers: {
            include: { center: true },
          },
        },
        orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'asc' as const }],
      },
    };
  }

  private roleOptionsForUser(user: any): RoleOption[] {
    const explicitRoles =
      user.userRoles?.map((userRole: any) => ({
        userRoleId: userRole.id,
        roleId: userRole.roleId,
        role: userRole.role.code,
        roleName: userRole.role.name,
        permissions: userRole.role.permissions?.map((p: any) => p.permission.code) ?? [],
        allowedCenterIds: userRole.centers?.map((c: any) => c.centerId) ?? [],
        centers:
          userRole.centers?.map((centerAccess: any) => ({
            id: centerAccess.centerId,
            code: centerAccess.center?.code,
            name: centerAccess.center?.name,
          })) ?? [],
        isDefault: userRole.isDefault,
      })) ?? [];

    if (explicitRoles.length) return explicitRoles;

    return [
      {
        userRoleId: `legacy:${user.roleId}`,
        roleId: user.roleId,
        role: user.role.code,
        roleName: user.role.name,
        permissions: user.role?.permissions?.map((p: any) => p.permission.code) ?? [],
        allowedCenterIds: user.centers?.map((c: any) => c.centerId) ?? [],
        centers:
          user.centers?.map((centerAccess: any) => ({
            id: centerAccess.centerId,
            code: centerAccess.center?.code,
            name: centerAccess.center?.name,
          })) ?? [],
        isDefault: true,
      },
    ];
  }

  private publicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    };
  }

  private buildSessionUser(user: any, roleOption: RoleOption) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: roleOption.role,
      roleId: roleOption.roleId,
      userRoleId: roleOption.userRoleId,
      roleName: roleOption.roleName,
      permissions: roleOption.permissions,
      allowedCenterIds: roleOption.allowedCenterIds,
      centers: roleOption.centers,
      availableRoles: this.roleOptionsForUser(user).map((option) => ({
        userRoleId: option.userRoleId,
        roleId: option.roleId,
        role: option.role,
        roleName: option.roleName,
        centers: option.centers,
        isDefault: option.isDefault,
      })),
    };
  }

  private async issueTokens(user: any, roleOption: RoleOption) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: roleOption.role,
      roleId: roleOption.roleId,
      userRoleId: roleOption.userRoleId,
      permissions: roleOption.permissions,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.updateRefreshToken(user.id, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.buildSessionUser(user, roleOption),
    };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: this.getUserInclude(),
    });

    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, refreshToken, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const roleOptions = this.roleOptionsForUser(user);
    if (roleOptions.length > 1) {
      const selectionToken = this.jwtService.sign(
        {
          sub: user.id,
          purpose: 'role-selection',
        },
        { expiresIn: '10m' },
      );

      return {
        requiresRoleSelection: true,
        selection_token: selectionToken,
        user: this.publicUser(user),
        availableRoles: roleOptions.map((option) => ({
          userRoleId: option.userRoleId,
          roleId: option.roleId,
          role: option.role,
          roleName: option.roleName,
          centers: option.centers,
          isDefault: option.isDefault,
        })),
      };
    }

    return this.issueTokens(user, roleOptions[0]);
  }

  async selectRole(selectionToken: string | undefined, userRoleId: string) {
    if (!selectionToken) throw new UnauthorizedException('Role selection expired');

    let payload: any;
    try {
      payload = this.jwtService.verify(selectionToken);
    } catch {
      throw new UnauthorizedException('Role selection expired');
    }

    if (payload.purpose !== 'role-selection') {
      throw new UnauthorizedException('Invalid role selection token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: this.getUserInclude(),
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Access Denied');

    const roleOptions = this.roleOptionsForUser(user);
    const selected = roleOptions.find((option) => option.userRoleId === userRoleId);
    if (!selected) throw new UnauthorizedException('Invalid role selection');

    return this.issueTokens(user, selected);
  }

  async switchRole(userId: string, userRoleId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.getUserInclude(),
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Access Denied');

    const roleOptions = this.roleOptionsForUser(user);
    const selected = roleOptions.find((option) => option.userRoleId === userRoleId);
    if (!selected) throw new UnauthorizedException('Invalid role selection');

    return this.issueTokens(user, selected);
  }

  async refreshTokens(userId: string, refreshToken: string, userRoleId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.getUserInclude(),
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Access Denied');
    }

    const roleOptions = this.roleOptionsForUser(user);
    const selected =
      roleOptions.find((option) => option.userRoleId === userRoleId) ||
      roleOptions.find((option) => option.isDefault) ||
      roleOptions[0];

    return this.issueTokens(user, selected);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: hashedRefreshToken },
    });
  }
}
