import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BrandingService {
  private readonly DEFAULT_ID = 'default';
  private readonly ALLOWED_FONTS = new Set([
    'Inter',
    'Roboto',
    'Poppins',
    'Outfit',
  ]);

  constructor(private prisma: PrismaService) {}

  async getBranding() {
    let config = await this.prisma.brandingConfig.findUnique({
      where: { id: this.DEFAULT_ID },
    });

    if (!config) {
      // Create if doesn't exist (e.g. if seed didn't run)
      config = await this.prisma.brandingConfig.create({
        data: {
          id: this.DEFAULT_ID,
          appName: 'English Center CRM',
          shortName: 'EC CRM',
        },
      });
    }

    return config;
  }

  async updateBranding(data: any) {
    const headingFont = this.ALLOWED_FONTS.has(data.headingFont)
      ? data.headingFont
      : 'Inter';
    const bodyFont = this.ALLOWED_FONTS.has(data.bodyFont)
      ? data.bodyFont
      : 'Inter';

    return this.prisma.brandingConfig.update({
      where: { id: this.DEFAULT_ID },
      data: {
        appName: data.appName,
        shortName: data.shortName,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        headingFont,
        bodyFont,
        borderRadius: data.borderRadius,
      },
    });
  }

  async updateLogo(url: string, type: 'light' | 'dark' = 'light') {
    return this.prisma.brandingConfig.update({
      where: { id: this.DEFAULT_ID },
      data: {
        [type === 'light' ? 'logoLightUrl' : 'logoDarkUrl']: url,
      },
    });
  }
}
