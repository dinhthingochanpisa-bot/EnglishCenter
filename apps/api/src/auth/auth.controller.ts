import { Controller, Post, UseGuards, Get, Res, Request, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import {
  LocalAuthGuard,
  JwtAuthGuard,
  RefreshAuthGuard,
} from './guards/auth.guards';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';

type CookieSameSite = 'lax' | 'strict' | 'none';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  private getCookieOptions() {
    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') || 'development'
    ).toLowerCase();
    const cookieSecureRaw = this.configService.get<string>('COOKIE_SECURE');
    const secure =
      cookieSecureRaw !== undefined
        ? cookieSecureRaw === 'true'
        : nodeEnv === 'production' || nodeEnv === 'staging';

    const sameSiteRaw = (
      this.configService.get<string>('COOKIE_SAME_SITE') || 'lax'
    ).toLowerCase();
    const sameSite: CookieSameSite =
      sameSiteRaw === 'strict' || sameSiteRaw === 'none'
        ? (sameSiteRaw as CookieSameSite)
        : 'lax';

    return {
      secure,
      sameSite,
      path: '/',
    };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    const result: any = await this.authService.login(req.user);
    const cookieOptions = this.getCookieOptions();

    if (result.requiresRoleSelection) {
      res.cookie('role_selection_token', result.selection_token, {
        ...cookieOptions,
        httpOnly: true,
        maxAge: 10 * 60 * 1000,
      });
      const { selection_token, ...safeResult } = result;
      return safeResult;
    }

    res.cookie('access_token', result.access_token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refresh_token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { refresh_token, access_token, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @Post('select-role')
  async selectRole(
    @Body('userRoleId') userRoleId: string,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.selectRole(
      req.cookies?.role_selection_token,
      userRoleId,
    );
    const cookieOptions = this.getCookieOptions();

    res.cookie('access_token', result.access_token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refresh_token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie('role_selection_token', cookieOptions);

    const { refresh_token, access_token, ...safeResult } = result;
    return safeResult;
  }

  @Public()
  @UseGuards(RefreshAuthGuard)
  @Post('refresh')
  async refresh(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshTokens(
      req.user.sub,
      req.user.refreshToken,
      req.user.userRoleId,
    );
    const cookieOptions = this.getCookieOptions();

    res.cookie('access_token', result.access_token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refresh_token, {
      ...cookieOptions,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    const { refresh_token, access_token, ...safeResult } = result;
    return safeResult;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId);
    const cookieOptions = this.getCookieOptions();
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    res.clearCookie('role_selection_token', cookieOptions);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return req.user;
  }
}
