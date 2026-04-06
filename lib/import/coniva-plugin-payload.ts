import { z } from 'zod';

const pluginIconSchema = z.object({
  name: z.string().min(1),
  nodeId: z.string().min(1),
  svgContent: z.string().min(1),
  sourcePage: z.string().optional(),
  sourceFrame: z.string().optional(),
});

const pluginPayloadSchema = z.object({
  version: z.literal('1'),
  source: z.literal('contour-figma-plugin'),
  exportedAt: z.string().min(1),
  fileName: z.string().min(1),
  icons: z.array(pluginIconSchema).min(1),
  skipped: z
    .array(
      z.object({
        nodeId: z.string().min(1),
        name: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .optional(),
});

export type ContourPluginIconPayload = z.infer<typeof pluginIconSchema>;
export type ContourPluginPayload = z.infer<typeof pluginPayloadSchema>;

export function parseContourPluginPayload(input: string): ContourPluginPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error('Plugin payload must be valid JSON.');
  }

  const result = pluginPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid plugin payload.');
  }

  return result.data;
}

export function buildPluginImportEntries(payload: ContourPluginPayload) {
  return payload.icons.map((icon) => ({
    svg: icon.svgContent,
    name: icon.name,
    tags: ['figma', 'plugin'],
    provenance: {
      adapterId: 'figma-plugin',
      sourceLibrary: 'Figma Plugin',
      sourceIconId: icon.nodeId,
      importedAt: payload.exportedAt,
    },
  }));
}
