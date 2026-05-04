import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { BrandingService } from './branding.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { Public } from '../common/decorators/public.decorator';
import { Permissions } from '../common/decorators/rbac.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Request } from 'express';
import {
  getLogoPublicUrl,
  getLogoUploadDir,
} from '../common/utils/upload-paths';

@Controller('branding')
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Public()
  @Get()
  getBranding() {
    return this.brandingService.getBranding();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('SETTINGS_ADMIN.UPDATE')
  @Patch('admin')
  updateBranding(@Body() data: any) {
    return this.brandingService.updateBranding(data);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('SETTINGS_ADMIN.UPDATE')
  @Post('admin/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void,
        ) => {
          cb(null, getLogoUploadDir());
        },
        filename: (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `logo-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|svg\+xml)$/)) {
          return cb(
            new BadRequestException(
              'Chỉ cho phép file ảnh (jpg, png, gif, svg)',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file');
    }
    const url = getLogoPublicUrl(file.filename);
    await this.brandingService.updateLogo(url);
    return { url };
  }
}
