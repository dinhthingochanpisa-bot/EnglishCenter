import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: any) => request?.cookies?.access_token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: any) {
    try {
      // Fetch authorized centers to ensure we have the latest state
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
          centers: {
            include: {
              center: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException(
          'Tài khoản không tồn tại hoặc đã bị khóa',
        );
      }

      let activeRole = {
        userRoleId: payload.userRoleId || `legacy:${user.roleId}`,
        roleId: user.roleId,
        roleCode: user.role.code,
        roleName: user.role.name,
        permissions: user.role.permissions.map((item) => item.permission.code),
        centers: user.centers.map((item) => ({
          id: item.centerId,
          code: item.center?.code,
          name: item.center?.name,
        })),
        allowedCenterIds: user.centers.map((c) => c.centerId),
      };

      if (payload.userRoleId && !String(payload.userRoleId).startsWith('legacy:')) {
        const userRole = await this.prisma.userRole.findFirst({
          where: {
            id: payload.userRoleId,
            userId: user.id,
            isActive: true,
          },
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
            centers: {
              include: {
                center: { select: { id: true, code: true, name: true } },
              },
            },
          },
        });
        if (!userRole) throw new UnauthorizedException('Vai trò không còn hiệu lực');
        activeRole = {
          userRoleId: userRole.id,
          roleId: userRole.roleId,
          roleCode: userRole.role.code,
          roleName: userRole.role.name,
          permissions: userRole.role.permissions.map((item) => item.permission.code),
          centers: userRole.centers.map((item) => ({
            id: item.centerId,
            code: item.center?.code,
            name: item.center?.name,
          })),
          allowedCenterIds: userRole.centers.map((c) => c.centerId),
        };
      }

      return {
        id: payload.sub,
        userId: payload.sub,
        email: payload.email,
        fullName: user.fullName,
        role: activeRole.roleCode,
        roleId: activeRole.roleId,
        roleName: activeRole.roleName,
        userRoleId: activeRole.userRoleId,
        permissions: activeRole.permissions,
        allowedCenterIds: activeRole.allowedCenterIds,
        centers: activeRole.centers,
      };
    } catch (error) {
      console.error('[AUTH ERROR] JwtStrategy.validate:', error);
      throw error;
    }
  }
}
