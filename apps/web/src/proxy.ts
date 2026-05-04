import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PATHS = [
  '/dashboard',
  '/admin',
  '/centers',
  '/users',
  '/leads',
  '/students',
  '/contracts',
  '/families',
  '/parents',
  '/academic',
];

const MODULE_ROUTE_MAP: Array<{ prefix: string; moduleCode: string }> = [
  { prefix: '/leads/pipeline', moduleCode: 'SALES_PIPELINE' },
  { prefix: '/leads', moduleCode: 'CRM_LEADS' },
  { prefix: '/students', moduleCode: 'STUDENT' },
  { prefix: '/families', moduleCode: 'FAMILY_PARENT' },
  { prefix: '/parents', moduleCode: 'FAMILY_PARENT' },
  { prefix: '/academic/classes', moduleCode: 'CLASS_ACADEMIC' },
  { prefix: '/academic/products', moduleCode: 'PROGRAM_PRODUCT' },
  { prefix: '/academic/contracts', moduleCode: 'CONTRACT' },
  { prefix: '/academic/payments', moduleCode: 'PAYMENT_RECEIVABLE' },
  { prefix: '/academic/renewals', moduleCode: 'RENEWAL_RETENTION' },
];

async function isModuleEnabled(moduleCode: string) {
  const apiBaseUrl =
    process.env.API_SERVER_URL?.replace(/\/$/, '') ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
    'http://localhost:3000';

  try {
    const response = await fetch(`${apiBaseUrl}/modules`, {
      cache: 'no-store',
    });
    if (!response.ok) return true;

    const modules = await response.json();
    const moduleItem = modules.find((item: any) => item.code === moduleCode);
    if (!moduleItem) return true;

    const isEnabled =
      moduleItem.settings && moduleItem.settings.length > 0
        ? moduleItem.settings[0].isEnabled
        : true;
    return Boolean(isEnabled);
  } catch {
    // Do not block unrelated requests when module service is unreachable.
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const accessToken = request.cookies.get('access_token');

  if (isProtected && !accessToken) {
    const url = new URL('/login', request.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const routeModule = MODULE_ROUTE_MAP.find((item) =>
    pathname.startsWith(item.prefix),
  );
  if (routeModule && accessToken) {
    const enabled = await isModuleEnabled(routeModule.moduleCode);
    if (!enabled) {
      const url = new URL('/dashboard', request.url);
      url.searchParams.set('moduleBlocked', routeModule.moduleCode);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
