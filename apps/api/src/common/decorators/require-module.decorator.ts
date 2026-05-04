import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'module_code';
export const RequireModule = (moduleCode: string) =>
  SetMetadata(MODULE_KEY, moduleCode);
