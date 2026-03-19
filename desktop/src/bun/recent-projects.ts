import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Utils } from 'electrobun/bun';
import { getProjectNameFromPath } from '../shared/naming';

export type RecentProject = {
  path: string;
  name: string;
  updatedAt: string;
};

const MAX_RECENT_PROJECTS = 20;
const RECENT_PROJECTS_FILE = join(Utils.paths.userData, 'recent-projects.json');

export async function addRecent(path: string, name?: string) {
  const nextEntry: RecentProject = {
    path,
    name: sanitizeProjectName(name) ?? getProjectNameFromPath(path),
    updatedAt: new Date().toISOString(),
  };

  const items = await readRecentProjects();
  const deduped = items.filter((item) => item.path !== path);
  deduped.unshift(nextEntry);
  await writeRecentProjects(deduped);
}

export async function getRecent(limit = MAX_RECENT_PROJECTS) {
  const items = await readRecentProjects();
  return items.slice(0, Math.max(0, limit));
}

export async function removeRecent(path: string) {
  const items = await readRecentProjects();
  await writeRecentProjects(items.filter((item) => item.path !== path));
}

export async function clearRecent() {
  await writeRecentProjects([]);
}

async function readRecentProjects(): Promise<RecentProject[]> {
  try {
    const file = Bun.file(RECENT_PROJECTS_FILE);
    if (!(await file.exists())) {
      return [];
    }

    const parsed = await file.json();
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(isRecentProject)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

async function writeRecentProjects(items: RecentProject[]) {
  const normalized = items
    .filter(isRecentProject)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_RECENT_PROJECTS);

  mkdirSync(Utils.paths.userData, { recursive: true });
  await Bun.write(RECENT_PROJECTS_FILE, JSON.stringify(normalized, null, 2));
}

function isRecentProject(value: unknown): value is RecentProject {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RecentProject>;
  return (
    typeof candidate.path === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

function sanitizeProjectName(name?: string | null) {
  const trimmed = name?.trim();
  return trimmed ? trimmed : null;
}
