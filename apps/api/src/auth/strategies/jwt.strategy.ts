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

      return {
        id: payload.sub,
        userId: payload.sub,
        email: payload.email,
        fullName: user.fullName,
        role: user.role.code,
        permissions: user.role.permissions.map((item) => item.permission.code),
        allowedCenterIds: user.centers.map((c) => c.centerId),
        centers: user.centers.map((item) => ({
          id: item.centerId,
          code: item.center?.code,
          name: item.center?.name,
        })),
      };
    } catch (error) {
      console.error('[AUTH ERROR] JwtStrategy.validate:', error);
      throw error;
    }
  }
}
