import { basename, extname } from 'node:path';

export function inferPlatformKey(fileName: string): string | null {
  const segments = basename(fileName).split('-');
  if (segments.length < 3) return null;
  return `${segments[1]}-${segments[2]}`;
}

export function isInstallerArtifact(fileName: string): boolean {
  return ['.dmg', '.zip', '.deb', '.AppImage', '.exe'].includes(extname(fileName));
}
