import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ModuleGuard } from './common/guards/module.guard';
import { BrandingModule } from './branding/branding.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ModulesModule } from './modules/modules.module';
import { CommonModule } from './common/common.module';
import { StudentModule } from './student/student.module';
import { LeadModule } from './lead/lead.module';
import { FamilyModule } from './family/family.module';
import { ParentModule } from './parent/parent.module';
import { AcademicModule } from './academic/academic.module';
import { CommercialModule } from './commercial/commercial.module';
import { ReportingModule } from './reporting/reporting.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import {
  getLogoUploadDir,
  getUploadPublicRoot,
} from './common/utils/upload-paths';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: 60000,
          limit: 100,
        },
      ],
    }),
    ServeStaticModule.forRootAsync({
      useFactory: () => [
        {
          rootPath: getUploadPublicRoot(),
          serveRoot: '/public',
        },
        {
          rootPath: getLogoUploadDir(),
          serveRoot: '/public',
        },
      ],
    }),
    PrismaModule,
    AuthModule,
    AdminModule,
    BrandingModule,
    ModulesModule,
    CommonModule,
    StudentModule,
    LeadModule,
    FamilyModule,
    ParentModule,
    AcademicModule,
    CommercialModule,
    ReportingModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    HealthService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ModuleGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
