type RouteUser = {
  role?: string;
  permissions?: string[];
};

const ROUTE_BY_ROLE: Record<string, { href: string; permission: string }> = {
  ACADEMIC: { href: '/academic/classes', permission: 'CLASS_ACADEMIC.VIEW' },
  ACCOUNTANT: { href: '/academic/payments', permission: 'PAYMENT_RECEIVABLE.VIEW' },
  SALES: { href: '/leads', permission: 'CRM_LEADS.VIEW' },
  CS: { href: '/students', permission: 'STUDENT.VIEW' },
  MANAGER: { href: '/dashboard', permission: 'REPORTING.VIEW' },
  ADMIN: { href: '/dashboard', permission: 'REPORTING.VIEW' },
  SUPER_ADMIN: { href: '/dashboard', permission: 'REPORTING.VIEW' },
};

const ROUTE_BY_PERMISSION: Array<{ permission: string; href: string }> = [
  { permission: 'REPORTING.VIEW', href: '/dashboard' },
  { permission: 'CRM_LEADS.VIEW', href: '/leads' },
  { permission: 'STUDENT.VIEW', href: '/students' },
  { permission: 'CLASS_ACADEMIC.VIEW', href: '/academic/classes' },
  { permission: 'PROGRAM_PRODUCT.VIEW', href: '/academic/products' },
  { permission: 'CONTRACT.VIEW', href: '/academic/contracts' },
  { permission: 'PAYMENT_RECEIVABLE.VIEW', href: '/academic/payments' },
  { permission: 'RENEWAL_RETENTION.VIEW', href: '/academic/renewals' },
  { permission: 'SETTINGS_ADMIN.VIEW', href: '/admin/users' },
];

export function hasPermission(user: RouteUser | null | undefined, permission: string) {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN' || user.permissions?.includes('*')) return true;
  return user.permissions?.includes(permission) || false;
}

export function getDefaultWorkspacePath(user: RouteUser | null | undefined) {
  if (!user) return '/login';

  const roleRoute = user.role ? ROUTE_BY_ROLE[user.role] : undefined;
  if (roleRoute && hasPermission(user, roleRoute.permission)) {
    return roleRoute.href;
  }

  return ROUTE_BY_PERMISSION.find((item) => hasPermission(user, item.permission))?.href || '/students';
}
