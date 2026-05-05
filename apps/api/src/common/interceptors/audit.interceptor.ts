import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, body } = request;

    // Only log write operations
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Don't log login attempts (sensitive)
    if (url.includes('/auth/login')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (data) => {
        if (user) {
          try {
            await this.prisma.auditLog.create({
              data: {
                actorId: user.userId,
                action: method,
                entityType: this.getEntityType(url),
                entityId: data?.id || request.params.id || 'N/A',
                afterData: body,
                centerId: body?.centerId || request.params.centerId || null,
              },
            });
          } catch (error) {
            console.error('Failed to create audit log:', error);
          }
        }
      }),
    );
  }

  private getEntityType(url: string): string {
    const path = url.toLowerCase();
    if (path.includes('/branding')) return 'BrandingConfig';
    if (path.includes('/modules')) return 'ModuleRegistry';
    if (path.includes('/auth')) return 'Auth';
    if (path.includes('/users')) return 'User';
    if (path.includes('/roles')) return 'Role';
    if (path.includes('/centers')) return 'Center';
    if (path.includes('/leads')) return 'Lead';
    if (path.includes('/parents')) return 'Parent';
    if (path.includes('/families')) return 'Family';
    if (path.includes('/students')) return 'Student';
    if (path.includes('/products')) return 'Product';
    if (path.includes('/programs')) return 'Program';
    if (path.includes('/classes')) return 'Class';
    if (path.includes('/contracts')) return 'Contract';
    if (path.includes('/payments')) return 'Payment';
    if (path.includes('/enrollments')) return 'Enrollment';

    const parts = url
      .split('/')
      .filter((p) => p && !p.startsWith(':') && !p.match(/^[0-9a-f-]{36}$/i));
    return parts[parts.length - 1] || 'Unknown';
  }
}
