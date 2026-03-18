import type { IconSet, Project, Workspace } from './types';

export function createWorkspaceFromProject(project: Project, iconSetId = 'icon-set-1'): Workspace {
  const safeIconSetId = iconSetId.trim() || 'icon-set-1';
  return {
    version: '2.0',
    meta: {
      ...project.meta,
      name: project.meta.name,
    },
    iconSets: {
      [safeIconSetId]: project,
    },
    activeIconSetId: safeIconSetId,
  };
}

export function getFirstIconSetId(workspace: Workspace | null | undefined): string | null {
  if (!workspace) return null;
  const requested = workspace.activeIconSetId;
  if (requested && workspace.iconSets[requested]) return requested;
  return Object.keys(workspace.iconSets)[0] ?? null;
}

export function getActiveIconSet(
  workspace: Workspace | null | undefined,
  activeIconSetId?: string | null,
): IconSet | null {
  if (!workspace) return null;
  const iconSetId = activeIconSetId ?? getFirstIconSetId(workspace);
  if (!iconSetId) return null;
  return workspace.iconSets[iconSetId] ?? null;
}

export function replaceWorkspaceIconSet(
  workspace: Workspace | null | undefined,
  iconSetId: string | null | undefined,
  iconSet: IconSet | null | undefined,
): Workspace | null {
  if (!workspace || !iconSetId || !iconSet || !workspace.iconSets[iconSetId]) {
    return workspace ?? null;
  }

  return {
    ...workspace,
    iconSets: {
      ...workspace.iconSets,
      [iconSetId]: iconSet,
    },
  };
}
