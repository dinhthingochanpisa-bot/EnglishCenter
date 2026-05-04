import { mkdirSync } from 'fs';
import { basename, dirname, isAbsolute, resolve } from 'path';

function getProjectRoot() {
  return process.env.PROJECT_ROOT || process.env.INIT_CWD || process.cwd();
}

export function getLogoUploadDir() {
  const configuredDir = process.env.UPLOAD_DIR?.trim();
  const uploadDir = configuredDir
    ? isAbsolute(configuredDir)
      ? configuredDir
      : resolve(getProjectRoot(), configuredDir)
    : resolve(getProjectRoot(), 'uploads', 'logo');

  mkdirSync(uploadDir, { recursive: true });
  return uploadDir;
}

export function getUploadPublicRoot() {
  return dirname(getLogoUploadDir());
}

export function getLogoPublicUrl(filename: string) {
  return `/public/${basename(getLogoUploadDir())}/${filename}`;
}
