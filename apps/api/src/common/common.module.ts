import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit/audit.service';
import { ModuleGuard } from './guards/module.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService, ModuleGuard],
  exports: [AuditService, ModuleGuard],
})
export class CommonModule {}
