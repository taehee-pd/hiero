#!/usr/bin/env node
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);

// package.json
var require_package = __commonJS((exports, module) => {
  module.exports = {
    name: "@cuneiform/cli",
    version: "0.2.0",
    description: "Cuneiform CLI — repo-native icon authoring for host repositories",
    author: "taehee-pd <j.taehee@icloud.com>",
    license: "MIT",
    homepage: "https://github.com/taehee-pd/icon-authoring-tool/tree/main/packages/cuneiform-cli#readme",
    repository: {
      type: "git",
      url: "https://github.com/taehee-pd/icon-authoring-tool.git",
      directory: "packages/cuneiform-cli"
    },
    bugs: {
      url: "https://github.com/taehee-pd/icon-authoring-tool/issues"
    },
    bin: {
      cuneiform: "./dist/bin.js"
    },
    engines: {
      node: ">=18"
    },
    keywords: [
      "cuneiform",
      "icons",
      "icon-authoring",
      "cli",
      "svg",
      "design-system"
    ],
    type: "module",
    files: [
      "dist",
      "README.md"
    ],
    publishConfig: {
      access: "public",
      provenance: true
    },
    scripts: {
      build: "bun build src/bin.ts --outfile dist/bin.js --target node",
      prepare: "bun run build",
      prepublishOnly: "bun run build"
    }
  };
});

// src/commands/init.ts
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
var CONFIG_TEMPLATE = `import type { CuneiformConfig } from '@cuneiform/cli';

export default {
  sourceDir: 'cuneiform',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.cuneiform/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
} satisfies CuneiformConfig;
`;
function emptyManifest() {
  return JSON.stringify({
    schemaVersion: "1.0.0",
    generatedAt: new Date().toISOString(),
    iconCount: 0,
    icons: {}
  }, null, 2) + `
`;
}
async function runInit(cwd, _flags) {
  const configPath = path.join(cwd, "cuneiform.config.ts");
  const sourceDirPath = path.join(cwd, "cuneiform");
  const iconsDirPath = path.join(sourceDirPath, "icons");
  const manifestPath = path.join(sourceDirPath, "manifest.json");
  let anyCreated = false;
  if (!existsSync(configPath)) {
    await writeFile(configPath, CONFIG_TEMPLATE, "utf8");
    log("created", "cuneiform.config.ts");
    anyCreated = true;
  } else {
    log("exists ", "cuneiform.config.ts");
  }
  if (!existsSync(sourceDirPath)) {
    await mkdir(sourceDirPath, { recursive: true });
    log("created", "cuneiform/");
    anyCreated = true;
  }
  if (!existsSync(iconsDirPath)) {
    await mkdir(iconsDirPath, { recursive: true });
    log("created", "cuneiform/icons/");
    anyCreated = true;
  }
  if (!existsSync(manifestPath)) {
    await writeFile(manifestPath, emptyManifest(), "utf8");
    log("created", "cuneiform/manifest.json");
    anyCreated = true;
  }
  if (anyCreated) {
    console.log(`
[cuneiform] Initialized successfully.

Next steps:
  1.  Run \`cuneiform dev\` to start the live integration server
  2.  Open the Cuneiform editor and connect to this repository
       (set the dev server URL to http://localhost:4400)
  3.  Publish icons from the editor — they will appear in cuneiform/icons/
  4.  Run \`cuneiform build\` to produce a snapshot build for CI
  5.  Commit cuneiform/ to version-control as your canonical icon source

See docs at https://cuneiform.dev/docs/getting-started
`);
  } else {
    console.log("[cuneiform] Already initialized — nothing to create.");
  }
}
function log(action, file) {
  console.log(`  ${action}  ${file}`);
}

// src/commands/dev.ts
import path8 from "node:path";
import { existsSync as existsSync2 } from "node:fs";

// ../../lib/install-config/validate-config.ts
var ALLOWED_HOST_KINDS = new Set(["react-app", "reference-app"]);
var ALLOWED_RUNTIME_MODES = new Set(["in-memory", "cache-dir", "vendored"]);
var ALLOWED_RELEASE_KINDS = new Set(["local-directory", "git-pr", "npm-registry"]);
function validateConfig(config) {
  const errors = [];
  if (!isObject(config)) {
    return { valid: false, errors: [{ field: "config", message: "Config must be a non-null object." }] };
  }
  validateSourceDir(config, errors);
  validateHostTargets(config, errors);
  validateReleaseTargets(config, errors);
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
function validateSourceDir(config, errors) {
  const { sourceDir } = config;
  if (typeof sourceDir !== "string" || sourceDir.trim() === "") {
    errors.push({ field: "sourceDir", message: "sourceDir is required and must be a non-empty string." });
    return;
  }
  validateRepoRelativePath("sourceDir", sourceDir, errors);
}
function validateHostTargets(config, errors) {
  const { hostTargets } = config;
  if (!Array.isArray(hostTargets)) {
    errors.push({ field: "hostTargets", message: "hostTargets must be an array." });
    return;
  }
  hostTargets.forEach((target, i) => {
    const prefix = `hostTargets[${i}]`;
    if (!isObject(target)) {
      errors.push({ field: prefix, message: "Each host target must be a non-null object." });
      return;
    }
    validateHostTarget(target, prefix, errors);
  });
}
function validateHostTarget(target, prefix, errors) {
  const { kind, mode, runtimeMode, cacheDir } = target;
  if (!kind || !ALLOWED_HOST_KINDS.has(String(kind))) {
    errors.push({
      field: `${prefix}.kind`,
      message: `kind must be one of: ${[...ALLOWED_HOST_KINDS].join(", ")}.`
    });
  }
  if (mode !== "live") {
    errors.push({ field: `${prefix}.mode`, message: "mode must be 'live'." });
  }
  if (!runtimeMode || !ALLOWED_RUNTIME_MODES.has(String(runtimeMode))) {
    errors.push({
      field: `${prefix}.runtimeMode`,
      message: `runtimeMode must be one of: ${[...ALLOWED_RUNTIME_MODES].join(", ")}.`
    });
  }
  if (runtimeMode === "cache-dir") {
    if (!cacheDir || typeof cacheDir !== "string" || cacheDir.trim() === "") {
      errors.push({
        field: `${prefix}.cacheDir`,
        message: "cacheDir is required when runtimeMode is 'cache-dir'."
      });
    } else {
      validateRepoRelativePath(`${prefix}.cacheDir`, cacheDir, errors);
    }
  }
  rejectInlineCredentials(target, prefix, errors);
}
function validateReleaseTargets(config, errors) {
  const { releaseTargets } = config;
  if (releaseTargets === undefined || releaseTargets === null) {
    return;
  }
  if (!Array.isArray(releaseTargets)) {
    errors.push({ field: "releaseTargets", message: "releaseTargets must be an array when present." });
    return;
  }
  releaseTargets.forEach((target, i) => {
    const prefix = `releaseTargets[${i}]`;
    if (!isObject(target)) {
      errors.push({ field: prefix, message: "Each release target must be a non-null object." });
      return;
    }
    validateReleaseTarget(target, prefix, errors);
  });
}
function validateReleaseTarget(target, prefix, errors) {
  const { kind } = target;
  if (!kind || !ALLOWED_RELEASE_KINDS.has(String(kind))) {
    errors.push({
      field: `${prefix}.kind`,
      message: `kind must be one of: ${[...ALLOWED_RELEASE_KINDS].join(", ")}.`
    });
    return;
  }
  if (kind === "local-directory") {
    const { outputMode, outputDir } = target;
    if (outputMode !== "snapshot") {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!outputDir || typeof outputDir !== "string" || outputDir.trim() === "") {
      errors.push({ field: `${prefix}.outputDir`, message: "outputDir is required and must be a non-empty string." });
    } else {
      validateRepoRelativePath(`${prefix}.outputDir`, outputDir, errors);
    }
  }
  if (kind === "git-pr") {
    const { outputMode, owner, repo, baseBranch, packagePath } = target;
    if (outputMode !== "snapshot") {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!owner || typeof owner !== "string" || owner.trim() === "") {
      errors.push({ field: `${prefix}.owner`, message: "owner is required and must be a non-empty string." });
    }
    if (!repo || typeof repo !== "string" || repo.trim() === "") {
      errors.push({ field: `${prefix}.repo`, message: "repo is required and must be a non-empty string." });
    }
    if (!baseBranch || typeof baseBranch !== "string" || baseBranch.trim() === "") {
      errors.push({ field: `${prefix}.baseBranch`, message: "baseBranch is required and must be a non-empty string." });
    }
    if (packagePath !== undefined) {
      if (typeof packagePath !== "string" || packagePath.trim() === "") {
        errors.push({ field: `${prefix}.packagePath`, message: "packagePath must be a non-empty string when provided." });
      } else {
        validateRepoRelativePath(`${prefix}.packagePath`, packagePath, errors);
      }
    }
  }
  if (kind === "npm-registry") {
    const { outputMode, packageName } = target;
    if (outputMode !== "snapshot") {
      errors.push({ field: `${prefix}.outputMode`, message: "outputMode must be 'snapshot'." });
    }
    if (!packageName || typeof packageName !== "string" || packageName.trim() === "") {
      errors.push({ field: `${prefix}.packageName`, message: "packageName is required and must be a non-empty string." });
    }
  }
  rejectInlineCredentials(target, prefix, errors);
}
function validateRepoRelativePath(field, value, errors) {
  if (path2.isAbsolute(value)) {
    errors.push({ field, message: `${field} must be a relative path.` });
    return;
  }
  if (escapesRoot(value)) {
    errors.push({ field, message: `${field} must not escape the repo root.` });
  }
}
function rejectInlineCredentials(target, prefix, errors) {
  const secretLike = ["token", "secret", "password", "key", "auth"];
  for (const [field, value] of Object.entries(target)) {
    if (secretLike.some((s) => field.toLowerCase().includes(s)) && typeof value === "string" && value.trim() !== "") {
      errors.push({
        field: `${prefix}.${field}`,
        message: `Config must not store credentials. Move "${field}" to the platform keychain.`
      });
    }
  }
}
function escapesRoot(p) {
  const parts = p.replace(/\\/g, "/").split("/");
  let depth = 0;
  for (const part of parts) {
    if (part === "" || part === ".")
      continue;
    if (part === "..") {
      depth--;
      if (depth < 0)
        return true;
    } else {
      depth++;
    }
  }
  return false;
}
var path2 = {
  isAbsolute(p) {
    return p.startsWith("/") || /^[A-Za-z]:[/\\]/.test(p);
  }
};
function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
// ../../lib/install-config/load-config.ts
function loadConfig(raw, configPath) {
  const label = configPath ?? "cuneiform.config.ts";
  if (raw === null || raw === undefined) {
    return { ok: false, error: `${label}: default export is missing or undefined.` };
  }
  const result = validateConfig(raw);
  if (!result.valid) {
    const messages = result.errors.map((e) => `  • ${e.field}: ${e.message}`).join(`
`);
    return { ok: false, error: `${label} is invalid:
${messages}` };
  }
  const config = raw;
  return { ok: true, config: normalizeConfig(config) };
}
function normalizeConfig(config) {
  return {
    ...config,
    sourceDir: config.sourceDir.replace(/\/$/, ""),
    hostTargets: config.hostTargets.map((t) => {
      if (t.runtimeMode === "cache-dir" && t.cacheDir) {
        return { ...t, cacheDir: t.cacheDir.replace(/\/$/, "") };
      }
      return t;
    }),
    releaseTargets: config.releaseTargets ?? []
  };
}
// ../../lib/live-sync/dev-server.ts
import { createServer } from "node:http";
import { mkdir as mkdir3, writeFile as writeFile3 } from "node:fs/promises";
import path7 from "node:path";

// ../../lib/live-sync/incremental-rebuild.ts
import path5 from "node:path";

// ../../lib/schema/guards.ts
function isObject2(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
function isProject(val) {
  if (!isObject2(val))
    return false;
  if (val.version !== "1.0")
    return false;
  if (!isObject2(val.meta))
    return false;
  if (typeof val.meta.name !== "string")
    return false;
  if (!isObject2(val.icons))
    return false;
  for (const icon of Object.values(val.icons)) {
    if (!isIcon(icon))
      return false;
  }
  return true;
}
function isIcon(val) {
  if (!isObject2(val))
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.name !== "string")
    return false;
  if (!isObject2(val.variants))
    return false;
  return true;
}

// ../../lib/sync-source/types.ts
var ICON_SOURCE_SCHEMA_VERSION = "1.0.0";
var SYNC_SOURCE_MANIFEST_SCHEMA_VERSION = "1.0.0";

// ../../lib/sync-source/export-icon-source.ts
function exportIconSource(icon) {
  const variants = {};
  for (const [variantId, variant] of sortedEntries(icon.variants)) {
    const layers = {};
    for (const [layerId, layer] of sortedEntries(variant.layers)) {
      layers[layerId] = stripLayer(layer);
    }
    variants[variantId] = {
      id: variant.id,
      ...variant.name ? { name: variant.name } : {},
      size: variant.size,
      viewBox: variant.viewBox,
      ...variant.renderingMode ? { renderingMode: variant.renderingMode } : {},
      ...variant.weight ? { weight: variant.weight } : {},
      ...variant.scale ? { scale: variant.scale } : {},
      layers,
      ...variant.topology ? { topology: variant.topology } : {}
    };
  }
  const source = {
    schemaVersion: ICON_SOURCE_SCHEMA_VERSION,
    id: icon.id,
    name: icon.name,
    ...icon.category ? { category: icon.category } : {},
    ...icon.tags && icon.tags.length > 0 ? { tags: [...icon.tags].sort((a, b) => a.localeCompare(b)) } : {},
    variants,
    ...icon.transitions && Object.keys(icon.transitions).length > 0 ? { transitions: icon.transitions } : {},
    ...icon.effects && Object.keys(icon.effects).length > 0 ? { effects: icon.effects } : {}
  };
  return source;
}
function stripLayer(layer) {
  const source = {
    id: layer.id,
    ...layer.role ? { role: layer.role } : {},
    ...layer.visible === false ? { visible: false } : {},
    ...layer.clipPathLayerId ? { clipPathLayerId: layer.clipPathLayerId } : {},
    ...layer.drawOrder !== undefined && layer.drawOrder !== 1 ? { drawOrder: layer.drawOrder } : {},
    ...layer.path ? { path: layer.path } : {},
    style: layer.style,
    ...layer.transform ? { transform: layer.transform } : {}
  };
  return source;
}
function sortedEntries(record) {
  return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}

// ../../lib/sync-source/export-manifest.ts
function generateSyncSourceManifest(entries, generatedAt) {
  const sorted = [...entries].sort((a, b) => a.source.id.localeCompare(b.source.id));
  const icons = {};
  for (const entry of sorted) {
    const { source } = entry;
    const sizes = Object.values(source.variants).map((v) => v.size).sort((a, b) => a - b);
    const uniqueSizes = [...new Set(sizes)];
    icons[source.id] = {
      id: source.id,
      name: source.name,
      ...source.category ? { category: source.category } : {},
      ...source.tags && source.tags.length > 0 ? { tags: source.tags } : {},
      variantCount: Object.keys(source.variants).length,
      sizes: uniqueSizes,
      hasTransitions: Boolean(source.transitions && Object.keys(source.transitions).length > 0),
      hasEffects: Boolean(source.effects && Object.keys(source.effects).length > 0),
      sourcePath: entry.sourcePath,
      previewPath: entry.previewPath
    };
  }
  return {
    schemaVersion: SYNC_SOURCE_MANIFEST_SCHEMA_VERSION,
    generatedAt,
    iconCount: sorted.length,
    icons
  };
}

// ../../lib/schema/types.ts
function buildDefaultIconType(v) {
  const fallbackType = Object.values(v.types ?? {})[0];
  return {
    id: v.defaultType ?? fallbackType?.id ?? "default",
    layers: v.layers ?? fallbackType?.layers ?? {},
    topology: v.topology ?? fallbackType?.topology
  };
}
function getVariantDefaultTypeId(v) {
  return v.defaultType ?? Object.keys(v.types ?? {})[0] ?? "default";
}
function getVariantType(v, typeId) {
  const resolvedTypeId = typeId ?? getVariantDefaultTypeId(v);
  const iconType = v.types?.[resolvedTypeId];
  if (iconType) {
    return {
      ...iconType,
      topology: iconType.topology ?? v.topology
    };
  }
  return buildDefaultIconType(v);
}

// ../../lib/rendering/resolve-layer-style.ts
var DEFAULT_RENDERING_MODE = "multicolor";
var ROLE_OPACITY = {
  primary: 1,
  secondary: 0.6,
  tertiary: 0.3
};
function resolveVariantRenderingMode(renderingMode) {
  return renderingMode ?? DEFAULT_RENDERING_MODE;
}
function resolveLayerStyleForRendering(layer, renderingMode, tokens) {
  const role = layer.role ?? "primary";
  const style = layer.style;
  let fill = style.fill;
  let stroke = style.stroke;
  let fillOpacity = style.fillOpacity;
  let strokeOpacity = style.strokeOpacity;
  let autoGradientFlag = false;
  if (renderingMode === "monochrome") {
    fill = coercePaint(fill, "currentColor");
    stroke = coercePaint(stroke, "currentColor");
  } else if (renderingMode === "hierarchical") {
    const opacity = ROLE_OPACITY[role] ?? ROLE_OPACITY.primary;
    fillOpacity = opacity;
    strokeOpacity = opacity;
  } else if (renderingMode === "palette") {
    const paletteColor = tokens?.[role];
    fill = coercePaint(fill, paletteColor);
    stroke = coercePaint(stroke, paletteColor);
  } else if (renderingMode === "autoGradient") {
    autoGradientFlag = true;
  }
  return {
    fill,
    stroke,
    fillOpacity,
    strokeOpacity,
    strokeWidth: style.strokeWidth,
    lineCap: style.lineCap,
    lineJoin: style.lineJoin,
    autoGradient: autoGradientFlag || undefined
  };
}
function coercePaint(paint, nextColor) {
  if (!hasVisiblePaint(paint))
    return paint;
  if (!nextColor)
    return paint;
  if (nextColor === "currentColor") {
    return { mode: "currentColor" };
  }
  return { mode: "fixed", value: nextColor };
}
function applyVariableValue(style, variableResult) {
  if (!variableResult.visible) {
    return {
      ...style,
      fillOpacity: 0,
      strokeOpacity: 0
    };
  }
  return {
    ...style,
    fillOpacity: style.fillOpacity != null ? style.fillOpacity * variableResult.opacity : variableResult.opacity,
    strokeOpacity: style.strokeOpacity != null ? style.strokeOpacity * variableResult.opacity : variableResult.opacity
  };
}
function hasVisiblePaint(paint) {
  if (!paint)
    return false;
  return !(paint.mode === "fixed" && paint.value === "none");
}

// ../../lib/runtime-core/variable-value.ts
var ROLE_THRESHOLDS = {
  primary: [0, 0.33],
  secondary: [0.33, 0.66],
  tertiary: [0.66, 1]
};
function computeVariableValue(layers, variableValue) {
  const clamped = Math.max(0, Math.min(1, variableValue));
  const result = {};
  for (const [layerId, layer] of Object.entries(layers)) {
    if (layer.visible === false) {
      result[layerId] = { opacity: 0, visible: false };
      continue;
    }
    const role = layer.role ?? "primary";
    const [start, end] = ROLE_THRESHOLDS[role] ?? ROLE_THRESHOLDS.primary;
    if (clamped <= start) {
      result[layerId] = { opacity: 0, visible: false };
    } else if (clamped >= end) {
      result[layerId] = { opacity: 1, visible: true };
    } else {
      const opacity = (clamped - start) / (end - start);
      result[layerId] = { opacity, visible: true };
    }
  }
  return result;
}

// ../../lib/export/export-svg.ts
function exportSvgString(icon, variantId, stateId, tokens, renderingMode) {
  const variant = icon.variants[variantId];
  if (!variant)
    return "";
  const state = getVariantType(variant, stateId);
  const effectiveRenderingMode = resolveVariantRenderingMode(renderingMode ?? variant.renderingMode);
  const [vx, vy, vw, vh] = variant.viewBox;
  const lines = [];
  const pathLines = [];
  const defs = new Map;
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${variant.size}" height="${variant.size}" fill="none">`);
  const layers = Object.keys(state.layers).sort((a, b) => a.localeCompare(b)).map((id) => state.layers[id]);
  const layerById = new Map(layers.map((layer) => [layer.id, layer]));
  const variableValues = computeVariableValue(state.layers, variant.variableValue ?? 1);
  for (const layer of layers) {
    if (layer.visible === false || !layer.path?.d || layer.isClipMask)
      continue;
    const attrs = [];
    attrs.push(`id="${escapeAttr(layer.id)}"`);
    attrs.push(`d="${escapeAttr(layer.path.d)}"`);
    if (layer.path.fillRule) {
      attrs.push(`fill-rule="${layer.path.fillRule}"`);
    }
    const baseStyle = resolveLayerStyleForRendering(layer, effectiveRenderingMode, tokens);
    const resolvedStyle = applyVariableValue(baseStyle, variableValues[layer.id] ?? { opacity: 1, visible: true });
    const fill = resolvePaint(resolvedStyle.fill, layer.id, "fill", defs, tokens);
    if (fill !== "none") {
      attrs.push(`fill="${escapeAttr(fill)}"`);
    }
    const stroke = resolvePaint(resolvedStyle.stroke, layer.id, "stroke", defs, tokens);
    if (stroke !== "none") {
      attrs.push(`stroke="${escapeAttr(stroke)}"`);
    }
    if (resolvedStyle.strokeWidth !== undefined) {
      attrs.push(`stroke-width="${resolvedStyle.strokeWidth}"`);
    }
    if (resolvedStyle.fillOpacity !== undefined) {
      attrs.push(`fill-opacity="${resolvedStyle.fillOpacity}"`);
    }
    if (resolvedStyle.strokeOpacity !== undefined) {
      attrs.push(`stroke-opacity="${resolvedStyle.strokeOpacity}"`);
    }
    if (resolvedStyle.lineCap) {
      attrs.push(`stroke-linecap="${resolvedStyle.lineCap}"`);
    }
    if (resolvedStyle.lineJoin) {
      attrs.push(`stroke-linejoin="${resolvedStyle.lineJoin}"`);
    }
    const transform = buildTransform(layer);
    if (transform) {
      attrs.push(`transform="${escapeAttr(transform)}"`);
    }
    const clipPath = resolveClipPath(layer, layerById, defs);
    if (clipPath) {
      attrs.push(`clip-path="${escapeAttr(clipPath)}"`);
    }
    pathLines.push(`  <path ${attrs.join(" ")}/>`);
  }
  if (defs.size > 0) {
    lines.push("  <defs>");
    for (const definition of defs.values()) {
      lines.push(`    ${definition}`);
    }
    lines.push("  </defs>");
  }
  lines.push(...pathLines);
  lines.push("</svg>");
  return lines.join(`
`);
}
function resolvePaint(paint, layerId, role, defs, tokens) {
  if (!paint)
    return "none";
  switch (paint.mode) {
    case "currentColor":
      return "currentColor";
    case "fixed":
      return paint.value;
    case "token":
      return tokens?.[paint.token] ?? "currentColor";
    case "linearGradient": {
      const gradientId = buildGradientId(layerId, role);
      defs.set(gradientId, serializeLinearGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    case "radialGradient": {
      const gradientId = buildGradientId(layerId, role);
      defs.set(gradientId, serializeRadialGradient(gradientId, paint));
      return `url(#${gradientId})`;
    }
    default:
      return "none";
  }
}
function buildTransform(layer) {
  const t = layer.transform;
  if (!t)
    return null;
  const parts = [];
  if (t.x !== undefined || t.y !== undefined) {
    parts.push(`translate(${t.x ?? 0}, ${t.y ?? 0})`);
  }
  if (t.rotate !== undefined) {
    parts.push(`rotate(${t.rotate})`);
  }
  if (t.scaleX !== undefined || t.scaleY !== undefined) {
    parts.push(`scale(${t.scaleX ?? 1}, ${t.scaleY ?? 1})`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}
function resolveClipPath(layer, layerById, defs) {
  const maskLayerId = layer.clipPathLayerId;
  if (!maskLayerId)
    return null;
  const maskLayer = layerById.get(maskLayerId);
  if (!isValidClipMaskLayer(maskLayer))
    return null;
  const clipPathId = buildClipPathId(layer.id);
  defs.set(clipPathId, serializeClipPath(clipPathId, maskLayer));
  return `url(#${clipPathId})`;
}
function escapeAttr(val) {
  return val.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function buildGradientId(layerId, role) {
  return `gradient-${layerId}-${role}`;
}
function buildClipPathId(layerId) {
  return `clip-${layerId}`;
}
function isValidClipMaskLayer(layer) {
  return Boolean(layer && layer.visible !== false && layer.path?.d);
}
function serializeClipPath(id, maskLayer) {
  const attrs = [
    `d="${escapeAttr(maskLayer.path.d)}"`
  ];
  if (maskLayer.path?.fillRule) {
    attrs.push(`fill-rule="${maskLayer.path.fillRule}"`);
  }
  const transform = buildTransform(maskLayer);
  if (transform) {
    attrs.push(`transform="${escapeAttr(transform)}"`);
  }
  return `<clipPath id="${escapeAttr(id)}"><path ${attrs.join(" ")}/></clipPath>`;
}
function serializeLinearGradient(id, paint) {
  const [x1, y1, x2, y2] = getLinearGradientVector(paint.angle);
  return `<linearGradient id="${escapeAttr(id)}" x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}">${serializeGradientStops(paint.stops)}</linearGradient>`;
}
function serializeRadialGradient(id, paint) {
  return `<radialGradient id="${escapeAttr(id)}" cx="${formatNumber(paint.cx)}" cy="${formatNumber(paint.cy)}" r="${formatNumber(paint.r)}">${serializeGradientStops(paint.stops)}</radialGradient>`;
}
function serializeGradientStops(stops) {
  return stops.map((stop) => {
    const attrs = [
      `offset="${formatNumber(stop.offset)}"`,
      `stop-color="${escapeAttr(stop.color)}"`
    ];
    if (stop.opacity !== undefined) {
      attrs.push(`stop-opacity="${formatNumber(stop.opacity)}"`);
    }
    return `<stop ${attrs.join(" ")}/>`;
  }).join("");
}
function getLinearGradientVector(angle) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const scale = 0.5 / Math.max(Math.abs(cos), Math.abs(sin), 0.000001);
  return [
    0.5 - cos * scale,
    0.5 - sin * scale,
    0.5 + cos * scale,
    0.5 + sin * scale
  ];
}
function formatNumber(value) {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

// ../../lib/sync-source/export-preview.ts
function generatePreviewSvg(icon, tokens) {
  const variantIds = Object.keys(icon.variants).sort((a, b) => a.localeCompare(b));
  const variantId = variantIds[0];
  if (!variantId)
    return null;
  const variant = icon.variants[variantId];
  const svg = exportSvgString(icon, variantId, "", tokens, variant.renderingMode);
  return svg || null;
}

// ../../lib/sync-source/serialize.ts
function serializeSourceJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}
`;
}
function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}

// ../../lib/sync-source/validate.ts
var VALID_ICON_DIR_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
var MAX_ICON_DIR_NAME_LENGTH = 128;
function toIconDirName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function isValidIconDirName(dirName) {
  return dirName.length > 0 && dirName.length <= MAX_ICON_DIR_NAME_LENGTH && VALID_ICON_DIR_NAME.test(dirName);
}
function containsPathTraversal(filePath) {
  const segments = filePath.split("/");
  return segments.some((segment) => segment === ".." || segment === "." || segment === "");
}
function validateIconsForExport(icons) {
  const errors = [];
  const seenIds = new Set;
  const seenDirNames = new Map;
  for (const [iconId, icon] of Object.entries(icons)) {
    if (!iconId || iconId.trim() === "") {
      errors.push({ kind: "empty-icon-id", message: "Icon has an empty id." });
      continue;
    }
    if (!icon.name || icon.name.trim() === "") {
      errors.push({
        kind: "empty-icon-name",
        message: `Icon "${iconId}" has an empty name.`
      });
      continue;
    }
    if (seenIds.has(iconId)) {
      errors.push({
        kind: "duplicate-icon-id",
        message: `Duplicate icon id: "${iconId}".`
      });
    }
    seenIds.add(iconId);
    const dirName = toIconDirName(icon.name);
    if (!isValidIconDirName(dirName)) {
      errors.push({
        kind: "invalid-icon-name",
        message: `Icon "${iconId}" produces invalid directory name: "${dirName}".`
      });
    }
    const existingIdForDir = seenDirNames.get(dirName);
    if (existingIdForDir && existingIdForDir !== iconId) {
      errors.push({
        kind: "duplicate-icon-dir",
        message: `Icons "${existingIdForDir}" and "${iconId}" both map to directory name "${dirName}".`
      });
    }
    seenDirNames.set(dirName, iconId);
    const testPath = `icons/${dirName}/icon.json`;
    if (containsPathTraversal(testPath)) {
      errors.push({
        kind: "path-traversal",
        message: `Icon "${iconId}" would produce a path with traversal: "${testPath}".`
      });
    }
  }
  return errors;
}
function validateSourcePayload(payload) {
  const errors = [];
  if (payload.manifest.iconCount !== payload.iconCount) {
    errors.push({
      kind: "manifest-count-mismatch",
      message: `Manifest declares ${payload.manifest.iconCount} icons but payload contains ${payload.iconCount}.`
    });
  }
  const filePaths = new Set(payload.files.map((f) => f.path));
  for (const entry of Object.values(payload.manifest.icons)) {
    if (!filePaths.has(entry.sourcePath)) {
      errors.push({
        kind: "manifest-missing-icon",
        message: `Manifest references "${entry.sourcePath}" but no file was generated.`
      });
    }
    if (!filePaths.has(entry.previewPath)) {
      errors.push({
        kind: "manifest-missing-icon",
        message: `Manifest references "${entry.previewPath}" but no file was generated.`
      });
    }
  }
  for (const file of payload.files) {
    if (file.path.includes("..")) {
      errors.push({
        kind: "path-traversal",
        message: `Generated file path contains traversal: "${file.path}".`
      });
    }
  }
  return errors;
}

// ../../lib/sync-source/export-source-payload.ts
function exportSourcePayload(project, options) {
  if (!isProject(project)) {
    throw new Error("Invalid project input for source export.");
  }
  const preErrors = validateIconsForExport(project.icons);
  if (preErrors.length > 0) {
    const messages = preErrors.map((e) => `  - [${e.kind}] ${e.message}`).join(`
`);
    throw new Error(`Source export validation failed:
${messages}`);
  }
  const generatedAt = options?.generatedAt ?? new Date().toISOString();
  const tokens = project.tokenSet?.colors;
  const files = [];
  const manifestInputs = [];
  const iconEntries = Object.entries(project.icons).sort(([a], [b]) => a.localeCompare(b));
  for (const [, icon] of iconEntries) {
    const dirName = toIconDirName(icon.name);
    const sourcePath = `icons/${dirName}/icon.json`;
    const previewPath = `icons/${dirName}/preview.svg`;
    const source = exportIconSource(icon);
    files.push({ path: sourcePath, contents: serializeSourceJson(source) });
    const previewSvg = generatePreviewSvg(icon, tokens);
    if (previewSvg) {
      files.push({ path: previewPath, contents: `${previewSvg}
` });
    }
    manifestInputs.push({ source, sourcePath, previewPath });
  }
  const manifest = generateSyncSourceManifest(manifestInputs, generatedAt);
  files.push({ path: "manifest.json", contents: serializeSourceJson(manifest) });
  files.sort((a, b) => a.path.localeCompare(b.path));
  const payload = {
    files,
    manifest,
    iconCount: iconEntries.length
  };
  const postErrors = validateSourcePayload(payload);
  if (postErrors.length > 0) {
    const messages = postErrors.map((e) => `  - [${e.kind}] ${e.message}`).join(`
`);
    throw new Error(`Source payload validation failed:
${messages}`);
  }
  return payload;
}
// ../../lib/sync-source/source-to-project.ts
import { readdir, readFile, stat } from "node:fs/promises";
import path3 from "node:path";
function iconFromSource(source) {
  const variants = {};
  for (const [variantId, sv] of Object.entries(source.variants)) {
    variants[variantId] = variantFromSource(sv);
  }
  return {
    id: source.id,
    name: source.name,
    ...source.category ? { category: source.category } : {},
    ...source.tags && source.tags.length > 0 ? { tags: source.tags } : {},
    variants,
    ...source.effects && Object.keys(source.effects).length > 0 ? { effects: source.effects } : {}
  };
}
function variantFromSource(sv) {
  const layers = {};
  for (const [layerId, sl] of Object.entries(sv.layers)) {
    layers[layerId] = layerFromSource(sl);
  }
  return {
    id: sv.id,
    ...sv.name ? { name: sv.name } : {},
    size: sv.size,
    viewBox: sv.viewBox,
    ...sv.renderingMode ? { renderingMode: sv.renderingMode } : {},
    ...sv.weight ? { weight: sv.weight } : {},
    ...sv.scale ? { scale: sv.scale } : {},
    layers,
    ...sv.topology ? { topology: sv.topology } : {}
  };
}
function layerFromSource(sl) {
  return {
    id: sl.id,
    ...sl.role ? { role: sl.role } : {},
    ...sl.visible === false ? { visible: false } : {},
    ...sl.clipPathLayerId ? { clipPathLayerId: sl.clipPathLayerId } : {},
    ...sl.drawOrder !== undefined ? { drawOrder: sl.drawOrder } : {},
    ...sl.path ? { path: sl.path } : {},
    style: sl.style,
    ...sl.transform ? { transform: sl.transform } : {}
  };
}
function projectFromSourceFiles(files, options) {
  let manifest = null;
  const iconSources = [];
  for (const file of files) {
    if (file.path === "manifest.json") {
      manifest = JSON.parse(file.contents);
    } else if (file.path.endsWith("/icon.json")) {
      iconSources.push(JSON.parse(file.contents));
    }
  }
  if (!manifest) {
    throw new Error("Missing manifest.json in source files.");
  }
  const icons = {};
  for (const source of iconSources) {
    icons[source.id] = iconFromSource(source);
  }
  const now = options?.updatedAt ?? manifest.generatedAt ?? new Date().toISOString();
  const project = {
    version: "1.0",
    meta: {
      name: options?.name ?? "Source Export",
      createdAt: now,
      updatedAt: now
    },
    icons,
    ...options?.tokenColors ? { tokenSet: { colors: options.tokenColors } } : {}
  };
  if (!isProject(project)) {
    throw new Error("Reconstructed project failed validation.");
  }
  return project;
}
async function projectFromSourceDir(sourceDir, options) {
  const files = [];
  const manifestPath = path3.join(sourceDir, "manifest.json");
  const manifestContents = await readFile(manifestPath, "utf8");
  files.push({ path: "manifest.json", contents: manifestContents });
  const iconsDir = path3.join(sourceDir, "icons");
  try {
    const iconDirs = await readdir(iconsDir);
    for (const dirName of iconDirs.sort()) {
      const dirPath = path3.join(iconsDir, dirName);
      const dirStat = await stat(dirPath);
      if (!dirStat.isDirectory())
        continue;
      const iconJsonPath = path3.join(dirPath, "icon.json");
      try {
        const iconContents = await readFile(iconJsonPath, "utf8");
        files.push({ path: `icons/${dirName}/icon.json`, contents: iconContents });
      } catch {}
    }
  } catch {}
  return projectFromSourceFiles(files, options);
}
// ../../lib/compiler-contracts/types.ts
var COMPILED_ICON_SCHEMA_URI = "https://cuneiform.dev/schemas/compiled-icon/1.0.0";
var PACKAGE_MANIFEST_SCHEMA_URI = "https://cuneiform.dev/schemas/manifest/1.0.0";
var ICON_CHANGE_RECORD_SCHEMA_URI = "https://cuneiform.dev/schemas/change-record/1.0.0";
// ../../lib/compiler-contracts/validators.ts
function isObject3(val) {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}
function isStringArray(val) {
  return Array.isArray(val) && val.every((item) => typeof item === "string");
}
function isNumberArray(val) {
  return Array.isArray(val) && val.every((item) => typeof item === "number");
}
function isSpringConfig(val) {
  return isObject3(val) && val.type === "spring" && typeof val.stiffness === "number" && typeof val.damping === "number" && (val.mass === undefined || typeof val.mass === "number") && (val.velocity === undefined || typeof val.velocity === "number");
}
function isRecordOf(val, predicate) {
  return isObject3(val) && Object.values(val).every((item) => predicate(item));
}
var REQUIRED_RENDERING_MODES = [
  "monochrome",
  "hierarchical",
  "palette",
  "multicolor"
];
var RENDERING_MODES = [
  ...REQUIRED_RENDERING_MODES
];
var TRACK_PROPERTIES = [
  "opacity",
  "rotate",
  "translateX",
  "translateY",
  "scale",
  "pathLength",
  "trimStart",
  "trimEnd",
  "trimOffset"
];
var EFFECT_KINDS = [
  "bounce",
  "pulse",
  "breathe",
  "wiggle",
  "rotate",
  "scale",
  "variableColor",
  "lineDrawOn",
  "lineDrawOff",
  "draw"
];
var CHANGE_KINDS = [
  "geometry",
  "style",
  "state-added",
  "state-removed",
  "variant-added",
  "variant-removed",
  "mode-added",
  "mode-removed",
  "animation-added",
  "animation-changed",
  "animation-removed",
  "effect-added",
  "effect-removed",
  "metadata",
  "breaking"
];
function isCompiledLayer(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.role !== "string")
    return false;
  if (!isObject3(val.path))
    return false;
  if (typeof val.path.d !== "string")
    return false;
  if (val.path.fillRule !== undefined && val.path.fillRule !== "nonzero" && val.path.fillRule !== "evenodd") {
    return false;
  }
  if (!isObject3(val.style))
    return false;
  if (typeof val.style.fill !== "string")
    return false;
  if (typeof val.style.fillOpacity !== "number")
    return false;
  if (typeof val.style.stroke !== "string")
    return false;
  if (typeof val.style.strokeOpacity !== "number")
    return false;
  if (typeof val.style.strokeWidth !== "number")
    return false;
  if (val.style.lineCap !== undefined && (typeof val.style.lineCap !== "string" || !["butt", "round", "square"].includes(val.style.lineCap))) {
    return false;
  }
  if (val.style.lineJoin !== undefined && (typeof val.style.lineJoin !== "string" || !["miter", "round", "bevel"].includes(val.style.lineJoin))) {
    return false;
  }
  if (val.transform !== undefined) {
    if (!isObject3(val.transform))
      return false;
    if (typeof val.transform.x !== "number")
      return false;
    if (typeof val.transform.y !== "number")
      return false;
    if (typeof val.transform.rotate !== "number")
      return false;
    if (typeof val.transform.scaleX !== "number")
      return false;
    if (typeof val.transform.scaleY !== "number")
      return false;
  }
  return true;
}
function isCompiledLayerSet(val) {
  return isObject3(val) && Array.isArray(val.layers) && val.layers.every(isCompiledLayer);
}
function isCompiledVariant(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.size !== "number")
    return false;
  if (!Array.isArray(val.viewBox) || val.viewBox.length !== 4 || !val.viewBox.every((n) => typeof n === "number")) {
    return false;
  }
  return isCompiledLayerSet(val.layers);
}
function isCompiledLayerBinding(val) {
  if (!isObject3(val))
    return false;
  if (val.fromLayerId !== undefined && typeof val.fromLayerId !== "string")
    return false;
  if (val.toLayerId !== undefined && typeof val.toLayerId !== "string")
    return false;
  if (val.tracks !== undefined) {
    if (!Array.isArray(val.tracks))
      return false;
    for (const track of val.tracks) {
      if (!isObject3(track))
        return false;
      if (!TRACK_PROPERTIES.includes(track.property)) {
        return false;
      }
      if (!isNumberArray(track.keyframes) && !isStringArray(track.keyframes)) {
        return false;
      }
    }
  }
  if (val.morph !== undefined) {
    if (!isObject3(val.morph))
      return false;
    if (!["strict", "bestGuess"].includes(val.morph.topology))
      return false;
  }
  return true;
}
function isCompiledTransition(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.from !== "string")
    return false;
  if (typeof val.to !== "string")
    return false;
  if (typeof val.durationMs !== "number")
    return false;
  if (typeof val.easing !== "string" && !isSpringConfig(val.easing))
    return false;
  if (!["track", "strictMorph", "bestGuessMorph", "replace"].includes(val.strategy)) {
    return false;
  }
  return Array.isArray(val.bindings) && val.bindings.every(isCompiledLayerBinding);
}
function isCompiledEffect(val) {
  if (!isObject3(val))
    return false;
  if (!EFFECT_KINDS.includes(val.kind))
    return false;
  if (typeof val.durationMs !== "number")
    return false;
  if (typeof val.easing !== "string" && !isSpringConfig(val.easing))
    return false;
  if (val.params !== undefined) {
    if (!isObject3(val.params))
      return false;
    if (!Object.values(val.params).every((param) => ["string", "number", "boolean"].includes(typeof param))) {
      return false;
    }
  }
  return true;
}
function isCompiledIcon(val) {
  if (!isObject3(val))
    return false;
  if (val.$schema !== COMPILED_ICON_SCHEMA_URI)
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.name !== "string")
    return false;
  if (typeof val.componentName !== "string")
    return false;
  if (!isObject3(val.meta))
    return false;
  if (typeof val.meta.category !== "string")
    return false;
  if (!isStringArray(val.meta.tags))
    return false;
  if (typeof val.meta.updatedAt !== "string")
    return false;
  if (typeof val.meta.version !== "string")
    return false;
  if (typeof val.meta.contentHash !== "string")
    return false;
  if (!isRecordOf(val.variants, isCompiledVariant))
    return false;
  if (!Array.isArray(val.transitions) || !val.transitions.every(isCompiledTransition)) {
    return false;
  }
  if (!Array.isArray(val.effects) || !val.effects.every(isCompiledEffect)) {
    return false;
  }
  return true;
}
function isIconEntry(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.id !== "string")
    return false;
  if (typeof val.name !== "string")
    return false;
  if (typeof val.componentName !== "string")
    return false;
  if (typeof val.category !== "string")
    return false;
  if (!isStringArray(val.tags))
    return false;
  if (typeof val.version !== "string")
    return false;
  if (typeof val.updatedAt !== "string")
    return false;
  if (typeof val.contentHash !== "string")
    return false;
  if (!isNumberArray(val.supportedSizes))
    return false;
  if (!Array.isArray(val.supportedModes) || !val.supportedModes.every((mode) => RENDERING_MODES.includes(mode))) {
    return false;
  }
  if (typeof val.hasAnimation !== "boolean")
    return false;
  if (typeof val.hasMorphTransition !== "boolean")
    return false;
  if (typeof val.compiledPath !== "string")
    return false;
  return true;
}
function isCollectionEntry(val) {
  if (!isObject3(val))
    return false;
  if (typeof val.name !== "string")
    return false;
  if (val.description !== undefined && typeof val.description !== "string")
    return false;
  if (!isStringArray(val.iconIds))
    return false;
  return true;
}
function isPackageManifest(val) {
  if (!isObject3(val))
    return false;
  if (val.$schema !== PACKAGE_MANIFEST_SCHEMA_URI)
    return false;
  if (!isObject3(val.package))
    return false;
  if (typeof val.package.name !== "string")
    return false;
  if (typeof val.package.version !== "string")
    return false;
  if (typeof val.package.builtAt !== "string")
    return false;
  if (typeof val.package.iconSchemaVersion !== "string")
    return false;
  if (typeof val.package.iconCount !== "number")
    return false;
  if (val.package.gitSha !== undefined && typeof val.package.gitSha !== "string")
    return false;
  if (val.package.gitBranch !== undefined && typeof val.package.gitBranch !== "string") {
    return false;
  }
  if (!isRecordOf(val.icons, isIconEntry))
    return false;
  if (!isRecordOf(val.collections, isCollectionEntry))
    return false;
  return true;
}
function isIconChange(val) {
  if (!isObject3(val))
    return false;
  if (!CHANGE_KINDS.includes(val.kind))
    return false;
  if (typeof val.summary !== "string")
    return false;
  if (typeof val.breaking !== "boolean")
    return false;
  if (val.scope !== undefined) {
    if (!isObject3(val.scope))
      return false;
    if (val.scope.variantSize !== undefined && typeof val.scope.variantSize !== "number") {
      return false;
    }
    if (val.scope.stateId !== undefined && typeof val.scope.stateId !== "string")
      return false;
    if (val.scope.layerId !== undefined && typeof val.scope.layerId !== "string")
      return false;
    if (val.scope.renderingMode !== undefined && !RENDERING_MODES.includes(val.scope.renderingMode)) {
      return false;
    }
    if (val.scope.effectKind !== undefined && !EFFECT_KINDS.includes(val.scope.effectKind)) {
      return false;
    }
  }
  return true;
}
function isIconChangeRecord(val) {
  if (!isObject3(val))
    return false;
  if (val.$schema !== ICON_CHANGE_RECORD_SCHEMA_URI)
    return false;
  if (typeof val.iconId !== "string")
    return false;
  if (typeof val.iconName !== "string")
    return false;
  if (typeof val.componentName !== "string")
    return false;
  if (typeof val.fromVersion !== "string")
    return false;
  if (typeof val.toVersion !== "string")
    return false;
  if (typeof val.publishedAt !== "string")
    return false;
  if (!["major", "minor", "patch"].includes(val.bump))
    return false;
  if (typeof val.isBreaking !== "boolean")
    return false;
  if (val.designerNote !== undefined && typeof val.designerNote !== "string")
    return false;
  if (!Array.isArray(val.changes) || !val.changes.every(isIconChange))
    return false;
  return true;
}
// ../../lib/export/diff-compiled-icons.ts
var MODE_ORDER = [
  "monochrome",
  "hierarchical",
  "palette",
  "multicolor"
];
function diffCompiledIcons(previous, next, options) {
  const changes = [];
  diffMetadata(previous, next, changes);
  diffVariants(previous, next, changes);
  diffAnimation(previous, next, changes);
  diffEffects(previous.effects, next.effects, changes);
  const isBreakingByChanges = changes.some((change) => change.breaking);
  const isBreaking = options?.breakingOverride ?? isBreakingByChanges;
  if (isBreaking) {
    const hasBreakingChange = changes.some((change) => change.kind === "breaking");
    if (!hasBreakingChange) {
      changes.push({
        kind: "breaking",
        summary: options?.breakingOverride === true ? "Marked as breaking by manual override." : "Contains one or more breaking removals.",
        breaking: true
      });
    }
  }
  const record = {
    $schema: ICON_CHANGE_RECORD_SCHEMA_URI,
    iconId: next.id,
    iconName: next.name,
    componentName: next.componentName,
    fromVersion: previous.meta.version,
    toVersion: next.meta.version,
    publishedAt: options?.publishedAt ?? new Date().toISOString(),
    bump: deriveBump(changes, isBreaking),
    isBreaking,
    designerNote: options?.designerNote,
    changes
  };
  validateIconChangeRecordOrThrow(record);
  return record;
}
function validateIconChangeRecordOrThrow(value) {
  if (!isIconChangeRecord(value)) {
    throw new Error("Malformed IconChangeRecord payload.");
  }
}
function diffMetadata(previous, next, changes) {
  const metadataChanges = [];
  if (previous.name !== next.name) {
    metadataChanges.push(`name: "${previous.name}" -> "${next.name}"`);
  }
  if (previous.componentName !== next.componentName) {
    metadataChanges.push(`componentName: "${previous.componentName}" -> "${next.componentName}"`);
  }
  if (previous.meta.category !== next.meta.category) {
    metadataChanges.push(`category: "${previous.meta.category}" -> "${next.meta.category}"`);
  }
  const prevTags = [...previous.meta.tags].sort((a, b) => a.localeCompare(b));
  const nextTags = [...next.meta.tags].sort((a, b) => a.localeCompare(b));
  if (prevTags.join("|") !== nextTags.join("|")) {
    metadataChanges.push(`tags: [${prevTags.join(", ")}] -> [${nextTags.join(", ")}]`);
  }
  if (metadataChanges.length > 0) {
    changes.push({
      kind: "metadata",
      summary: `Metadata updated (${metadataChanges.join("; ")}).`,
      breaking: false
    });
  }
}
function diffVariants(previous, next, changes) {
  const previousVariantIds = new Set(Object.keys(previous.variants));
  const nextVariantIds = new Set(Object.keys(next.variants));
  for (const variantId of [...nextVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!previousVariantIds.has(variantId)) {
      const size = next.variants[variantId].size;
      changes.push({
        kind: "variant-added",
        summary: `Added variant ${variantId} (${size}px).`,
        breaking: false,
        scope: { variantSize: size }
      });
    }
  }
  for (const variantId of [...previousVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextVariantIds.has(variantId)) {
      const size = previous.variants[variantId].size;
      changes.push({
        kind: "variant-removed",
        summary: `Removed variant ${variantId} (${size}px).`,
        breaking: true,
        scope: { variantSize: size }
      });
    }
  }
  for (const variantId of [...previousVariantIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextVariantIds.has(variantId))
      continue;
    const prevVariant = previous.variants[variantId];
    const nextVariant = next.variants[variantId];
    const prevStates = { default: { modes: { monochrome: prevVariant.layers } } };
    const nextStates = { default: { modes: { monochrome: nextVariant.layers } } };
    diffStates(prevVariant.size, prevStates, nextStates, changes);
  }
}
function diffStates(variantSize, previousStates, nextStates, changes) {
  const previousStateIds = new Set(Object.keys(previousStates));
  const nextStateIds = new Set(Object.keys(nextStates));
  for (const stateId of [...nextStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!previousStateIds.has(stateId)) {
      changes.push({
        kind: "state-added",
        summary: `Added state "${stateId}" for ${variantSize}px variant.`,
        breaking: false,
        scope: { variantSize, stateId }
      });
    }
  }
  for (const stateId of [...previousStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextStateIds.has(stateId)) {
      changes.push({
        kind: "state-removed",
        summary: `Removed state "${stateId}" for ${variantSize}px variant.`,
        breaking: true,
        scope: { variantSize, stateId }
      });
    }
  }
  for (const stateId of [...previousStateIds].sort((a, b) => a.localeCompare(b))) {
    if (!nextStateIds.has(stateId))
      continue;
    const previousModes = previousStates[stateId].modes;
    const nextModes = nextStates[stateId].modes;
    const previousModeKeys = new Set(Object.keys(previousModes));
    const nextModeKeys = new Set(Object.keys(nextModes));
    for (const mode of MODE_ORDER) {
      const had = previousModeKeys.has(mode);
      const has = nextModeKeys.has(mode);
      if (!had && has) {
        changes.push({
          kind: "mode-added",
          summary: `Added ${mode} mode to state "${stateId}" (${variantSize}px).`,
          breaking: false,
          scope: { variantSize, stateId, renderingMode: mode }
        });
        continue;
      }
      if (had && !has) {
        changes.push({
          kind: "mode-removed",
          summary: `Removed ${mode} mode from state "${stateId}" (${variantSize}px).`,
          breaking: true,
          scope: { variantSize, stateId, renderingMode: mode }
        });
        continue;
      }
      if (!had || !has)
        continue;
      diffLayerSets(variantSize, stateId, mode, previousModes[mode].layers, nextModes[mode].layers, changes);
    }
  }
}
function diffLayerSets(variantSize, stateId, mode, previousLayers, nextLayers, changes) {
  const previousById = new Map(previousLayers.map((layer) => [layer.id, layer]));
  const nextById = new Map(nextLayers.map((layer) => [layer.id, layer]));
  const commonLayerIds = [...previousById.keys()].filter((layerId) => nextById.has(layerId)).sort((a, b) => a.localeCompare(b));
  for (const layerId of commonLayerIds) {
    const prevLayer = previousById.get(layerId);
    const nextLayer = nextById.get(layerId);
    if (hasGeometryChange(prevLayer, nextLayer)) {
      changes.push({
        kind: "geometry",
        summary: `Geometry updated for layer "${layerId}" in ${mode}/${stateId} (${variantSize}px).`,
        breaking: false,
        scope: { variantSize, stateId, layerId, renderingMode: mode }
      });
    }
    if (hasStyleChange(prevLayer, nextLayer)) {
      changes.push({
        kind: "style",
        summary: `Style updated for layer "${layerId}" in ${mode}/${stateId} (${variantSize}px).`,
        breaking: false,
        scope: { variantSize, stateId, layerId, renderingMode: mode }
      });
    }
  }
}
function hasGeometryChange(previous, next) {
  return previous.path.d !== next.path.d || previous.path.fillRule !== next.path.fillRule || serializeCanonical(previous.transform) !== serializeCanonical(next.transform);
}
function hasStyleChange(previous, next) {
  return previous.style.fill !== next.style.fill || previous.style.fillOpacity !== next.style.fillOpacity || previous.style.stroke !== next.style.stroke || previous.style.strokeOpacity !== next.style.strokeOpacity || previous.style.strokeWidth !== next.style.strokeWidth || previous.style.lineCap !== next.style.lineCap || previous.style.lineJoin !== next.style.lineJoin;
}
function diffAnimation(previous, next, changes) {
  const hadAnimation = previous.transitions.length > 0 || previous.effects.length > 0;
  const hasAnimation = next.transitions.length > 0 || next.effects.length > 0;
  if (!hadAnimation && hasAnimation) {
    changes.push({
      kind: "animation-added",
      summary: "Animation capability added.",
      breaking: false
    });
    return;
  }
  if (hadAnimation && !hasAnimation) {
    changes.push({
      kind: "animation-removed",
      summary: "Animation capability removed.",
      breaking: true
    });
    return;
  }
  if (hadAnimation && hasAnimation) {
    const previousSignature = serializeCanonical(previous.transitions);
    const nextSignature = serializeCanonical(next.transitions);
    if (previousSignature !== nextSignature) {
      changes.push({
        kind: "animation-changed",
        summary: "Animation transitions changed.",
        breaking: false
      });
    }
  }
}
function diffEffects(previous, next, changes) {
  const previousCounts = countByKind(previous);
  const nextCounts = countByKind(next);
  const allKinds = new Set([...Object.keys(previousCounts), ...Object.keys(nextCounts)]);
  for (const kind of [...allKinds].sort((a, b) => a.localeCompare(b))) {
    const prevCount = previousCounts[kind] ?? 0;
    const nextCount = nextCounts[kind] ?? 0;
    if (nextCount > prevCount) {
      changes.push({
        kind: "effect-added",
        summary: `Added effect "${kind}".`,
        breaking: false,
        scope: { effectKind: kind }
      });
    }
    if (nextCount < prevCount) {
      changes.push({
        kind: "effect-removed",
        summary: `Removed effect "${kind}".`,
        breaking: true,
        scope: { effectKind: kind }
      });
    }
  }
}
function deriveBump(changes, isBreaking) {
  if (isBreaking || changes.some((change) => change.breaking))
    return "major";
  const hasAdditiveChange = changes.some((change) => [
    "state-added",
    "variant-added",
    "mode-added",
    "animation-added",
    "effect-added"
  ].includes(change.kind));
  if (hasAdditiveChange)
    return "minor";
  return "patch";
}
function countByKind(effects) {
  return effects.reduce((acc, effect) => {
    acc[effect.kind] = (acc[effect.kind] ?? 0) + 1;
    return acc;
  }, {});
}
function serializeCanonical(value) {
  return JSON.stringify(sortJsonValue(value));
}
function sortJsonValue(value) {
  if (Array.isArray(value))
    return value.map(sortJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue(entry)]));
  }
  return value;
}

// ../../lib/export/export-compiled-icon.ts
import { createHash } from "node:crypto";
function exportCompiledIcon(project, iconId) {
  const icon = project.icons[iconId];
  if (!icon) {
    throw new Error(`Icon "${iconId}" not found.`);
  }
  const compiledWithoutHash = {
    $schema: COMPILED_ICON_SCHEMA_URI,
    id: icon.id,
    name: icon.name,
    componentName: toComponentName(icon.id),
    meta: {
      category: icon.category ?? "uncategorized",
      tags: [...icon.tags ?? []].sort((a, b) => a.localeCompare(b)),
      updatedAt: project.meta.updatedAt,
      version: project.version,
      contentHash: ""
    },
    variants: buildCompiledVariants(project, icon),
    transitions: [],
    effects: buildCompiledEffects(icon)
  };
  const contentHash = computeContentHash(compiledWithoutHash);
  const compiled = {
    ...compiledWithoutHash,
    meta: {
      ...compiledWithoutHash.meta,
      contentHash
    }
  };
  validateCompiledIconOrThrow(compiled);
  return compiled;
}
function exportCompiledIconFile(project, iconId) {
  const compiled = exportCompiledIcon(project, iconId);
  return {
    path: `${compiled.id}.compiled.json`,
    contents: serializeCompiledJson(compiled),
    compiled
  };
}
function validateCompiledIconOrThrow(value) {
  if (!isCompiledIcon(value)) {
    throw new Error("Malformed CompiledIcon payload.");
  }
}
function serializeCompiledJson(value) {
  return `${JSON.stringify(sortJsonValue2(value), null, 2)}
`;
}
function buildCompiledVariants(project, icon) {
  return Object.keys(icon.variants).sort((a, b) => a.localeCompare(b)).reduce((acc, variantId) => {
    const variant = icon.variants[variantId];
    const modeLayers = buildResolvedLayers(project, variant.layers);
    acc[variantId] = {
      size: variant.size,
      viewBox: [...variant.viewBox],
      layers: { layers: modeLayers.monochrome }
    };
    return acc;
  }, {});
}
function buildResolvedLayers(project, layers) {
  const ordered = Object.keys(layers).sort((a, b) => a.localeCompare(b)).map((layerId) => layers[layerId]).filter((layer) => layer.visible !== false && !layer.isClipMask && Boolean(layer.path?.d));
  return {
    monochrome: ordered.map((layer) => toCompiledLayer(layer, project, "monochrome")),
    hierarchical: ordered.map((layer) => toCompiledLayer(layer, project, "hierarchical")),
    palette: ordered.map((layer) => toCompiledLayer(layer, project, "palette")),
    multicolor: ordered.map((layer) => toCompiledLayer(layer, project, "multicolor"))
  };
}
function toCompiledLayer(layer, project, _mode) {
  const compiled = {
    id: layer.id,
    role: layer.role ?? "primary",
    path: {
      d: layer.path.d,
      fillRule: layer.path?.fillRule
    },
    style: {
      fill: resolveCompiledPaint(layer.style.fill, project),
      fillOpacity: layer.style.fillOpacity ?? 1,
      stroke: resolveCompiledPaint(layer.style.stroke, project),
      strokeOpacity: layer.style.strokeOpacity ?? 1,
      strokeWidth: layer.style.strokeWidth ?? 0,
      lineCap: layer.style.lineCap,
      lineJoin: layer.style.lineJoin
    }
  };
  const transform = toCompiledTransform(layer);
  if (transform) {
    compiled.transform = transform;
  }
  return compiled;
}
function resolveCompiledPaint(paint, project) {
  if (!paint)
    return "none";
  switch (paint.mode) {
    case "currentColor":
      return "currentColor";
    case "fixed":
      return paint.value;
    case "token":
      return project.tokenSet?.colors?.[paint.token] ?? "currentColor";
    case "linearGradient":
    case "radialGradient":
      return "currentColor";
    default:
      return "none";
  }
}
function toCompiledTransform(layer) {
  if (!layer.transform)
    return;
  const x = layer.transform.x ?? 0;
  const y = layer.transform.y ?? 0;
  const rotate = layer.transform.rotate ?? 0;
  const scaleX = layer.transform.scaleX ?? 1;
  const scaleY = layer.transform.scaleY ?? 1;
  if (x === 0 && y === 0 && rotate === 0 && scaleX === 1 && scaleY === 1) {
    return;
  }
  return { x, y, rotate, scaleX, scaleY };
}
function buildCompiledEffects(icon) {
  if (!icon.effects)
    return [];
  return Object.keys(icon.effects).sort((a, b) => a.localeCompare(b)).map((effectId) => toCompiledEffect(icon.effects[effectId])).filter((effect) => effect !== null);
}
function toCompiledEffect(effect) {
  if (effect.kind === "appear" || effect.kind === "disappear") {
    return null;
  }
  const compiled = {
    kind: effect.kind,
    durationMs: effect.durationMs,
    easing: effect.easing ?? "linear"
  };
  if (effect.kind === "draw" && effect.drawConfig) {
    compiled.params = {
      mode: effect.drawConfig.mode,
      ...effect.drawConfig.windowSize !== undefined && { windowSize: effect.drawConfig.windowSize },
      ...effect.drawConfig.initialOffset !== undefined && { initialOffset: effect.drawConfig.initialOffset },
      ...effect.drawConfig.compoundTrimMode !== undefined && { compoundTrimMode: effect.drawConfig.compoundTrimMode }
    };
  }
  return compiled;
}
function computeContentHash(compiled) {
  const canonical = serializeCompiledJson({
    ...compiled,
    meta: {
      ...compiled.meta,
      contentHash: ""
    }
  });
  return createHash("sha256").update(canonical).digest("hex");
}
function toComponentName(iconId) {
  const words = iconId.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1));
  const normalized = words.join("");
  if (!normalized)
    return "IcIcon";
  if (normalized.startsWith("Ic"))
    return normalized;
  return `Ic${normalized}`;
}
function sortJsonValue2(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue2);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue2(entry)]));
  }
  return value;
}

// ../../lib/export/export-package-manifest.ts
var RENDERING_MODE_ORDER = [
  "monochrome",
  "hierarchical",
  "palette",
  "multicolor"
];
function generatePackageManifest(compiledIcons, options) {
  const schemaVersions = new Set(compiledIcons.map((entry) => getCompiledIconSchemaVersion(entry.compiled.$schema)));
  if (schemaVersions.size > 1) {
    throw new Error(`Compiled icon schema version mismatch: ${[...schemaVersions].sort((a, b) => a.localeCompare(b)).join(", ")}`);
  }
  const iconSchemaVersion = [...schemaVersions][0] ?? "1.0.0";
  const sortedEntries2 = [...compiledIcons].sort((left, right) => left.compiled.id.localeCompare(right.compiled.id));
  const icons = sortedEntries2.reduce((acc, entry) => {
    acc[entry.compiled.id] = toIconEntry(entry.compiled, entry.path);
    return acc;
  }, {});
  const collections = resolveCollections(options);
  const manifest = {
    $schema: PACKAGE_MANIFEST_SCHEMA_URI,
    package: {
      name: options.package.name,
      version: options.package.version,
      builtAt: options.package.builtAt,
      iconSchemaVersion,
      iconCount: compiledIcons.length,
      gitSha: options.package.gitSha,
      gitBranch: options.package.gitBranch
    },
    icons,
    collections
  };
  validatePackageManifestOrThrow(manifest);
  return manifest;
}
function generatePackageManifestFile(compiledIcons, options) {
  const manifest = generatePackageManifest(compiledIcons, options);
  return {
    path: "icons.manifest.json",
    contents: serializePackageManifestJson(manifest),
    manifest
  };
}
function validatePackageManifestOrThrow(value) {
  if (!isPackageManifest(value)) {
    throw new Error("Malformed PackageManifest payload.");
  }
}
function serializePackageManifestJson(value) {
  return `${JSON.stringify(sortJsonValue3(value), null, 2)}
`;
}
function toIconEntry(compiled, compiledPath) {
  const sizes = new Set;
  const states = new Set(["default"]);
  const modes = new Set;
  for (const variant of Object.values(compiled.variants)) {
    sizes.add(variant.size);
    states.add("default");
    for (const mode of RENDERING_MODE_ORDER) {
      modes.add(mode);
    }
  }
  const hasMorphTransition = compiled.transitions.some((transition) => transition.strategy === "strictMorph" || transition.strategy === "bestGuessMorph" || transition.bindings.some((binding) => binding.morph !== undefined));
  return {
    id: compiled.id,
    name: compiled.name,
    componentName: compiled.componentName,
    category: compiled.meta.category,
    tags: [...compiled.meta.tags].sort((a, b) => a.localeCompare(b)),
    version: compiled.meta.version,
    updatedAt: compiled.meta.updatedAt,
    contentHash: compiled.meta.contentHash,
    supportedSizes: [...sizes].sort((a, b) => a - b),
    supportedModes: RENDERING_MODE_ORDER.filter((mode) => modes.has(mode)),
    hasAnimation: compiled.transitions.length > 0 || compiled.effects.length > 0,
    hasMorphTransition,
    compiledPath: toRelativePackagePath(compiledPath)
  };
}
function toRelativePackagePath(path4) {
  return path4.replace(/^\.\//, "").replace(/^\//, "");
}
function resolveCollections(options) {
  if (options.resolveCollections) {
    return options.resolveCollections();
  }
  return options.collections ?? {};
}
function getCompiledIconSchemaVersion(schemaUri) {
  const match = schemaUri.match(/^https:\/\/(?:cuneiform|icophone)\.dev\/schemas\/compiled-icon\/([^/]+)$/);
  if (!match) {
    throw new Error(`Unexpected compiled icon schema URI: ${schemaUri}`);
  }
  return match[1];
}
function sortJsonValue3(value) {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue3);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue3(entry)]));
  }
  return value;
}

// ../../lib/export/export-react-components.ts
function generateReactIconComponents(compiledIcons, manifest) {
  const compiledById = new Map(compiledIcons.map((icon) => [icon.id, icon]));
  const files = [];
  const iconIds = Object.keys(manifest.icons).sort((a, b) => a.localeCompare(b));
  for (const iconId of iconIds) {
    const entry = manifest.icons[iconId];
    const compiled = compiledById.get(iconId);
    if (!compiled)
      continue;
    files.push(makeIconMetaFile(entry));
    for (const size of entry.supportedSizes) {
      const variant = findVariantBySize(compiled, size);
      if (!variant)
        continue;
      files.push(makeVariantDataFile(iconId, size, variant));
      files.push(makeSizedComponentFile(entry.componentName, iconId, size));
      files.push(makeSizeEntryFile(entry.componentName, size));
    }
    files.push(makeIconComponentFile(compiled, entry));
    files.push({
      path: `generated/icons/${entry.componentName}/index.ts`,
      contents: `export { default } from './${entry.componentName}';
`
    });
  }
  for (const [collectionId, collection] of Object.entries(manifest.collections)) {
    files.push(makeCollectionEntryFile(collectionId, collection.iconIds, manifest));
  }
  files.push(makeRootIndexFile(manifest));
  files.push(makeCollectionsIndexFile(manifest));
  return {
    files,
    exports: makePackageExports(manifest)
  };
}
function makeIconMetaFile(entry) {
  return {
    path: `generated/icons/${entry.componentName}/meta.ts`,
    contents: `import type { IconComponentMeta } from '@/lib/runtime-sdk';

export const iconMeta: IconComponentMeta = ${serializeCode({
      id: entry.id,
      name: entry.name,
      componentName: entry.componentName,
      schema: "https://cuneiform.dev/schemas/compiled-icon/1.0.0",
      version: entry.version,
      availableSizes: entry.supportedSizes,
      availableModes: entry.supportedModes
    })};
`
  };
}
function makeVariantDataFile(iconId, size, variant) {
  return {
    path: `generated/icons/${toPascal(iconId)}/variants/${size}.ts`,
    contents: `export const variant${size} = ${serializeCode(variant)} as const;
`
  };
}
function makeSizedComponentFile(componentName, iconId, size) {
  const pascalIconId = toPascal(iconId);
  return {
    path: `generated/icons/${componentName}/sizes/${size}.tsx`,
    contents: `import React, { forwardRef } from 'react';
import type { IconBaseProps } from '@/lib/runtime-sdk';
import { RuntimeIconRenderer } from '@/lib/runtime-sdk';
import { variant${size} } from '../../${pascalIconId}/variants/${size}';

type SizedProps = Omit<IconBaseProps, 'size'> & { size?: ${size} };

const iconData = {
  id: ${JSON.stringify(iconId)},
  name: ${JSON.stringify(componentName)},
  componentName: ${JSON.stringify(componentName)},
  $schema: 'https://cuneiform.dev/schemas/compiled-icon/1.0.0',
  meta: {
    category: '',
    tags: [],
    updatedAt: '',
    version: '1.0.0',
    contentHash: '',
  },
  variants: {
    '${size}': variant${size},
  },
  transitions: [],
  effects: [],
} as const;

const ${componentName}${size} = forwardRef<SVGSVGElement, SizedProps>(function ${componentName}${size}(props, ref) {
  return <RuntimeIconRenderer ref={ref} icon={iconData as any} size={${size}} {...props} />;
});

export default ${componentName}${size};
`
  };
}
function makeSizeEntryFile(componentName, size) {
  return {
    path: `generated/sizes/${size}/${componentName}.ts`,
    contents: `export { default } from '../../icons/${componentName}/sizes/${size}';
`
  };
}
function makeIconComponentFile(compiled, entry) {
  const sizeUnion = unionOfNumbers(entry.supportedSizes);
  const stateUnion = unionOfStates(compiled);
  const modeUnion = unionOfModes(entry.supportedModes);
  const effectUnion = unionOfAnimateKinds(compiled.effects.map((effect) => effect.kind));
  const variantImports = entry.supportedSizes.map((size) => `import { variant${size} } from '../../${toPascal(entry.id)}/variants/${size}';`).join(`
`);
  const variantMap = `const variants = {
${entry.supportedSizes.map((size) => `  '${size}': variant${size},`).join(`
`)}
} as const;`;
  return {
    path: `generated/icons/${entry.componentName}/${entry.componentName}.tsx`,
    contents: `import React, { forwardRef } from 'react';
import type { IconBaseProps, IconComponentMeta } from '@/lib/runtime-sdk';
import { RuntimeIconRenderer } from '@/lib/runtime-sdk';
import { iconMeta } from './meta';
${variantImports}

type ${entry.componentName}Props = Omit<IconBaseProps, 'size' | 'state' | 'renderingMode' | 'animate'> & {
  size?: ${sizeUnion};
  state?: ${stateUnion};
  renderingMode?: ${modeUnion};
  animate?: ${effectUnion} | null;
};

${variantMap}

const iconData = {
  id: ${JSON.stringify(compiled.id)},
  name: ${JSON.stringify(compiled.name)},
  componentName: ${JSON.stringify(compiled.componentName)},
  $schema: ${JSON.stringify(compiled.$schema)},
  meta: {
    category: ${JSON.stringify(compiled.meta.category)},
    tags: ${serializeCode(compiled.meta.tags)},
    updatedAt: ${JSON.stringify(compiled.meta.updatedAt)},
    version: ${JSON.stringify(compiled.meta.version)},
    contentHash: ${JSON.stringify(compiled.meta.contentHash)},
  },
  variants,
  transitions: ${serializeCode(compiled.transitions)},
  effects: ${serializeCode(compiled.effects)},
} as const;

const ${entry.componentName} = forwardRef<SVGSVGElement, ${entry.componentName}Props>(function ${entry.componentName}(props, ref) {
  return <RuntimeIconRenderer ref={ref} icon={iconData as any} {...props} />;
});

(${entry.componentName} as typeof ${entry.componentName} & { __iconMeta: IconComponentMeta }).__iconMeta = iconMeta;

export default ${entry.componentName};
`
  };
}
function makeCollectionEntryFile(collectionId, iconIds, manifest) {
  const exports = iconIds.map((iconId) => manifest.icons[iconId]).filter(Boolean).map((icon) => `export { default as ${icon.componentName} } from '../icons/${icon.componentName}';`).join(`
`);
  return {
    path: `generated/collections/${collectionId}.ts`,
    contents: `${exports}
`
  };
}
function makeRootIndexFile(manifest) {
  const lines = Object.values(manifest.icons).sort((a, b) => a.componentName.localeCompare(b.componentName)).map((icon) => `export { default as ${icon.componentName} } from './icons/${icon.componentName}';`);
  return {
    path: "generated/index.ts",
    contents: `${lines.join(`
`)}
`
  };
}
function makeCollectionsIndexFile(manifest) {
  const lines = Object.keys(manifest.collections).sort((a, b) => a.localeCompare(b)).map((collectionId) => `export * as ${toPascal(collectionId)} from './${collectionId}';`);
  return {
    path: "generated/collections/index.ts",
    contents: `${lines.join(`
`)}
`
  };
}
function makePackageExports(manifest) {
  const exports = {
    ".": "./generated/index.ts",
    "./collections": "./generated/collections/index.ts"
  };
  for (const icon of Object.values(manifest.icons)) {
    exports[`./icons/${icon.componentName}`] = `./generated/icons/${icon.componentName}/index.ts`;
    for (const size of icon.supportedSizes) {
      exports[`./sizes/${size}/${icon.componentName}`] = `./generated/sizes/${size}/${icon.componentName}.ts`;
    }
  }
  for (const collectionId of Object.keys(manifest.collections)) {
    exports[`./collections/${collectionId}`] = `./generated/collections/${collectionId}.ts`;
  }
  return Object.fromEntries(Object.entries(exports).sort(([left], [right]) => left.localeCompare(right)));
}
function findVariantBySize(compiled, size) {
  return Object.values(compiled.variants).find((variant) => variant.size === size);
}
function unionOfStates(compiled) {
  const states = new Set(["default"]);
  for (const transition of compiled.transitions) {
    if (transition.from)
      states.add(transition.from);
    if (transition.to)
      states.add(transition.to);
  }
  const sorted = [...states].sort((a, b) => {
    if (a === "default")
      return -1;
    if (b === "default")
      return 1;
    return a.localeCompare(b);
  });
  return sorted.map((s) => JSON.stringify(s)).join(" | ");
}
function unionOfNumbers(values) {
  return values.sort((a, b) => a - b).join(" | ");
}
function unionOfModes(values) {
  return values.map((value) => JSON.stringify(value)).join(" | ");
}
function unionOfAnimateKinds(values) {
  const unique = [...new Set(values)].sort((a, b) => a.localeCompare(b));
  if (unique.length === 0) {
    return "never";
  }
  return unique.map((value) => JSON.stringify(value)).join(" | ");
}
function toPascal(value) {
  return value.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}
function serializeCode(value) {
  return JSON.stringify(value, null, 2);
}

// ../../lib/export/compile-pipeline.ts
function compileProject(project, options) {
  if (!isProject(project)) {
    throw new Error("Invalid project input for compile pipeline.");
  }
  const compiledOutputs = Object.keys(project.icons).sort((a, b) => a.localeCompare(b)).map((iconId) => {
    const output = exportCompiledIconFile(project, iconId);
    if (!isCompiledIcon(output.compiled)) {
      throw new Error(`Invalid compiled output for icon "${iconId}".`);
    }
    return {
      path: `icons/${output.path}`,
      contents: output.contents,
      compiled: output.compiled
    };
  });
  const manifestFile = generatePackageManifestFile(compiledOutputs.map((entry) => ({ path: entry.path, compiled: entry.compiled })), {
    package: options.package
  });
  validatePackageManifestOrThrow(manifestFile.manifest);
  const files = compiledOutputs.map((entry) => ({
    path: entry.path,
    contents: entry.contents
  }));
  files.push({ path: manifestFile.path, contents: manifestFile.contents });
  if (options.previousCompiledIcons) {
    const changeFiles = compiledOutputs.map((entry) => {
      const previous = options.previousCompiledIcons?.[entry.compiled.id];
      if (!previous)
        return null;
      const record = diffCompiledIcons(previous, entry.compiled, {
        publishedAt: options.package.builtAt
      });
      if (!isIconChangeRecord(record)) {
        throw new Error(`Invalid change record for icon "${entry.compiled.id}".`);
      }
      return {
        path: `changes/${entry.compiled.id}.change.json`,
        contents: serializeCanonicalJson(record)
      };
    }).filter(Boolean);
    files.push(...changeFiles);
  }
  if (options.generateReact) {
    const react = generateReactIconComponents(compiledOutputs.map((entry) => entry.compiled), manifestFile.manifest);
    files.push(...react.files);
    files.push({
      path: "package.exports.generated.json",
      contents: serializeCanonicalJson(react.exports)
    });
  }
  files.push({
    path: "README.md",
    contents: generatePackageReadme(options.package.name, options.package.version, compiledOutputs.map((entry) => entry.compiled))
  });
  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    compiledIcons: compiledOutputs.map((entry) => entry.compiled),
    manifestPath: "icons.manifest.json"
  };
}
function generatePackageReadme(packageName, version, icons) {
  const iconList = icons.map((icon) => `- \`${icon.id}\` — ${icon.name}`).sort().join(`
`);
  const iconCount = icons.length;
  const sampleIcon = icons[0]?.id ?? "icon-name";
  return `# ${packageName}

> ${iconCount} animated, stateful SVG icon${iconCount !== 1 ? "s" : ""} built with [Cuneiform](https://cuneiform.dev).

## Install

\`\`\`bash
npm install ${packageName}
\`\`\`

## Quick Start (React)

\`\`\`tsx
import { CuneiformIcon } from '${packageName}/react';
import icon from '${packageName}/icons/${sampleIcon}.compiled.json';

function App() {
  return <CuneiformIcon icon={icon} size={24} animate />;
}
\`\`\`

## State Transitions

\`\`\`tsx
<CuneiformIcon icon={icon} state="active" animate />
\`\`\`

## Effects

\`\`\`tsx
<CuneiformIcon icon={icon} effect="bounce" />
\`\`\`

## Icons (${iconCount})

${iconList}

---

*v${version} — generated by Cuneiform*
`;
}
function serializeCanonicalJson(value) {
  return `${JSON.stringify(sortJsonValue4(value), null, 2)}
`;
}
function sortJsonValue4(value) {
  if (Array.isArray(value))
    return value.map(sortJsonValue4);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, sortJsonValue4(entry)]));
  }
  return value;
}

// ../../lib/sync-service/diff-source.ts
function diffSourcePayloads(previous, current) {
  const prevMap = toMap(previous);
  const currMap = toMap(current);
  const filesToWrite = [];
  const filesToDelete = [];
  for (const [path4, contents] of currMap) {
    const prevContents = prevMap.get(path4);
    if (prevContents === undefined) {
      filesToWrite.push({
        path: path4,
        kind: classifyNewFile(path4, currMap),
        iconDir: extractIconDir(path4),
        contents
      });
    } else if (prevContents !== contents) {
      filesToWrite.push({
        path: path4,
        kind: classifyChangedFile(path4),
        iconDir: extractIconDir(path4),
        contents
      });
    }
  }
  for (const [path4] of prevMap) {
    if (!currMap.has(path4)) {
      filesToDelete.push({
        path: path4,
        kind: classifyDeletedFile(path4, currMap),
        iconDir: extractIconDir(path4)
      });
    }
  }
  filesToWrite.sort((a, b) => a.path.localeCompare(b.path));
  filesToDelete.sort((a, b) => a.path.localeCompare(b.path));
  const iconChanges = computeIconChanges(prevMap, currMap);
  return {
    filesToWrite,
    filesToDelete,
    isNoOp: filesToWrite.length === 0 && filesToDelete.length === 0,
    iconChanges
  };
}
function classifyNewFile(path4, currMap) {
  if (path4 === "manifest.json")
    return "manifest-changed";
  const dir = extractIconDir(path4);
  if (!dir)
    return "manifest-changed";
  const iconJsonPath = `icons/${dir}/icon.json`;
  if (path4 === iconJsonPath || currMap.has(iconJsonPath)) {
    return "icon-added";
  }
  return "icon-added";
}
function classifyChangedFile(path4) {
  if (path4 === "manifest.json")
    return "manifest-changed";
  if (path4.endsWith("/preview.svg"))
    return "preview-only";
  if (path4.endsWith("/icon.json"))
    return "icon-updated";
  return "metadata-only";
}
function classifyDeletedFile(path4, currMap) {
  if (path4 === "manifest.json")
    return "manifest-changed";
  const dir = extractIconDir(path4);
  if (!dir)
    return "manifest-changed";
  const iconJsonPath = `icons/${dir}/icon.json`;
  if (!currMap.has(iconJsonPath)) {
    return "icon-removed";
  }
  if (path4.endsWith("/preview.svg"))
    return "preview-only";
  return "icon-updated";
}
function computeIconChanges(prevMap, currMap) {
  const prevDirs = extractAllIconDirs(prevMap);
  const currDirs = extractAllIconDirs(currMap);
  const changes = [];
  for (const dir of currDirs) {
    if (!prevDirs.has(dir)) {
      changes.push({ iconDir: dir, kind: "added" });
    }
  }
  for (const dir of prevDirs) {
    if (!currDirs.has(dir)) {
      changes.push({ iconDir: dir, kind: "removed" });
    }
  }
  for (const dir of currDirs) {
    if (!prevDirs.has(dir))
      continue;
    const iconJsonPath = `icons/${dir}/icon.json`;
    const previewPath = `icons/${dir}/preview.svg`;
    const iconJsonChanged = prevMap.get(iconJsonPath) !== currMap.get(iconJsonPath);
    const previewChanged = prevMap.get(previewPath) !== currMap.get(previewPath);
    if (iconJsonChanged) {
      changes.push({ iconDir: dir, kind: "updated" });
    } else if (previewChanged) {
      changes.push({ iconDir: dir, kind: "preview-only" });
    }
  }
  return changes.sort((a, b) => a.iconDir.localeCompare(b.iconDir));
}
function toMap(files) {
  const map = new Map;
  for (const f of files) {
    map.set(f.path, f.contents);
  }
  return map;
}
function extractIconDir(path4) {
  const match = path4.match(/^icons\/([^/]+)\//);
  return match ? match[1] : null;
}
function extractAllIconDirs(fileMap) {
  const dirs = new Set;
  for (const path4 of fileMap.keys()) {
    const dir = extractIconDir(path4);
    if (dir)
      dirs.add(dir);
  }
  return dirs;
}

// ../../lib/live-sync/output-writer.ts
import { mkdir as mkdir2, writeFile as writeFile2 } from "node:fs/promises";
import path4 from "node:path";
async function writeCompiledToHostTarget(repoRoot, target, files) {
  if (target.runtimeMode === "cache-dir") {
    if (!target.cacheDir) {
      return {
        target,
        writtenFiles: [],
        skipped: true,
        skipReason: "cacheDir is not configured for this host target"
      };
    }
    const cacheDir = path4.resolve(repoRoot, target.cacheDir);
    const writtenFiles = [];
    for (const file of files) {
      const targetPath = path4.join(cacheDir, file.path);
      await mkdir2(path4.dirname(targetPath), { recursive: true });
      await writeFile2(targetPath, file.contents, "utf8");
      writtenFiles.push(file.path);
    }
    return { target, writtenFiles, skipped: false };
  }
  if (target.runtimeMode === "in-memory") {
    return {
      target,
      writtenFiles: [],
      skipped: true,
      skipReason: "in-memory mode: host imports directly, no file writes needed"
    };
  }
  if (target.runtimeMode === "vendored") {
    return {
      target,
      writtenFiles: [],
      skipped: true,
      skipReason: "vendored mode: managed by consumer build step"
    };
  }
  return {
    target,
    writtenFiles: [],
    skipped: true,
    skipReason: `unsupported runtimeMode: ${target.runtimeMode}`
  };
}

// ../../lib/live-sync/incremental-rebuild.ts
async function fullRebuild(repoRoot, config, opts) {
  return runBuild(repoRoot, config, null, opts);
}
async function incrementalRebuild(repoRoot, config, previousSourceFiles, opts) {
  return runBuild(repoRoot, config, previousSourceFiles, opts);
}
async function runBuild(repoRoot, config, previousSourceFiles, opts) {
  const startMs = Date.now();
  const sourceDir = path5.resolve(repoRoot, config.sourceDir);
  const builtAt = opts?.builtAt ?? new Date().toISOString();
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    return {
      kind: "error",
      durationMs: Date.now() - startMs,
      error: `Failed to read source directory "${config.sourceDir}": ${err instanceof Error ? err.message : String(err)}`
    };
  }
  let currentPayload;
  try {
    currentPayload = exportSourcePayload(project, { generatedAt: "1970-01-01T00:00:00.000Z" });
  } catch (err) {
    return {
      kind: "error",
      durationMs: Date.now() - startMs,
      error: `Source export failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  if (previousSourceFiles !== null) {
    const diff = diffSourcePayloads(previousSourceFiles, currentPayload.files);
    if (diff.isNoOp) {
      return {
        kind: "no-op",
        durationMs: Date.now() - startMs,
        changedIcons: 0,
        sourceFiles: previousSourceFiles
      };
    }
  }
  let compiled;
  try {
    compiled = compileProject(project, {
      package: {
        name: "cuneiform-live",
        version: "0.0.0",
        builtAt
      }
    });
  } catch (err) {
    return {
      kind: "error",
      durationMs: Date.now() - startMs,
      error: `Compile failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
  const writtenFiles = [];
  for (const target of config.hostTargets) {
    try {
      const result = await writeCompiledToHostTarget(repoRoot, target, compiled.files);
      if (!result.skipped) {
        writtenFiles.push(...result.writtenFiles);
      }
    } catch (err) {
      return {
        kind: "error",
        durationMs: Date.now() - startMs,
        error: `Write to host target "${target.kind}" failed: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
  let changedIcons = compiled.compiledIcons.length;
  if (previousSourceFiles !== null) {
    const diff = diffSourcePayloads(previousSourceFiles, currentPayload.files);
    changedIcons = diff.iconChanges.filter((c) => c.kind === "added" || c.kind === "updated" || c.kind === "removed").length;
  }
  return {
    kind: "success",
    durationMs: Date.now() - startMs,
    changedIcons,
    totalIcons: compiled.compiledIcons.length,
    writtenFiles,
    sourceFiles: currentPayload.files
  };
}

// ../../lib/live-sync/file-watcher.ts
import { watch } from "node:fs";
import path6 from "node:path";
var RELEVANT_EXTENSIONS = new Set([".json", ".svg"]);
var DEFAULT_DEBOUNCE_MS = 100;
function watchSourceDir(sourceDir, onChanged, debounceMs = DEFAULT_DEBOUNCE_MS) {
  let debounceTimer = null;
  let pendingChangedPath = "";
  let watcher = null;
  let isActive = false;
  const fire = (filePath) => {
    if (debounceTimer !== null)
      clearTimeout(debounceTimer);
    pendingChangedPath = filePath;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onChanged(pendingChangedPath);
    }, debounceMs);
  };
  try {
    watcher = watch(sourceDir, { recursive: true, persistent: false }, (_event, filename) => {
      if (!filename)
        return;
      const ext = path6.extname(filename).toLowerCase();
      if (!RELEVANT_EXTENSIONS.has(ext))
        return;
      fire(path6.join(sourceDir, filename));
    });
    watcher.on("error", () => {
      handle.close();
    });
    isActive = true;
  } catch {}
  const handle = {
    close() {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      isActive = false;
    },
    get active() {
      return isActive;
    }
  };
  return handle;
}

// ../../lib/live-sync/dev-server.ts
async function startDevServer(serverConfig) {
  const { repoRoot, cuneiform: config, port } = serverConfig;
  const state = {
    iconCount: 0,
    lastBuildAt: null,
    lastBuildDurationMs: null,
    watching: false,
    previousSourceFiles: null
  };
  console.log(`[cuneiform] Starting dev server on port ${port}...`);
  console.log(`[cuneiform] Source directory: ${path7.resolve(repoRoot, config.sourceDir)}`);
  console.log(`[cuneiform] Host targets: ${config.hostTargets.map((t) => `${t.kind}(${t.runtimeMode})`).join(", ")}`);
  const initialBuild = await fullRebuild(repoRoot, config);
  applyBuildResult(state, initialBuild);
  if (initialBuild.kind === "success") {
    console.log(`[cuneiform] Initial build: ${initialBuild.totalIcons} icon(s) in ${initialBuild.durationMs}ms`);
  } else if (initialBuild.kind === "error") {
    console.warn(`[cuneiform] Initial build failed: ${initialBuild.error}`);
    console.warn(`[cuneiform] Continuing — server will retry on file change.`);
  }
  const sourceDir = path7.resolve(repoRoot, config.sourceDir);
  const watcher = watchSourceDir(sourceDir, async () => {
    const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
    applyBuildResult(state, result);
    if (result.kind === "success") {
      console.log(`[cuneiform] Rebuilt ${result.changedIcons} icon(s) in ${result.durationMs}ms`);
    } else if (result.kind === "error") {
      console.warn(`[cuneiform] Rebuild failed: ${result.error}`);
    }
  });
  state.watching = watcher.active;
  const server = createServer((req, res) => {
    handleRequest(req, res, serverConfig, state);
  });
  await new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(`[cuneiform] Listening on http://localhost:${port}`);
  return {
    port,
    async close() {
      watcher.close();
      state.watching = false;
      await new Promise((resolve) => server.close(() => resolve()));
    }
  };
}
async function handleRequest(req, res, serverConfig, state) {
  const { method, url } = req;
  const { repoRoot, cuneiform: config, apiSecret } = serverConfig;
  const requestOrigin = req.headers["origin"];
  if (requestOrigin) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (method === "POST" && apiSecret) {
    const auth = req.headers["authorization"] ?? "";
    if (auth !== `Bearer ${apiSecret}`) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }
  }
  try {
    if (method === "GET" && url === "/api/status") {
      await handleGetStatus(res, serverConfig, state);
    } else if (method === "GET" && url === "/api/icons") {
      await handleGetIcons(res, state);
    } else if (method === "POST" && url === "/api/source/icons") {
      await handlePostIcons(req, res, repoRoot, config, state);
    } else if (method === "POST" && url === "/api/source/manifest") {
      await handlePostManifest(req, res, repoRoot, config, state);
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  } catch (err) {
    console.error(`[cuneiform] Unhandled request error:`, err);
    sendJson(res, 500, { error: "Internal server error" });
  }
}
async function handleGetStatus(res, serverConfig, state) {
  const { repoRoot, cuneiform: config, port } = serverConfig;
  const status = {
    ok: true,
    repoRoot,
    sourceDir: config.sourceDir,
    iconCount: state.iconCount,
    lastBuildAt: state.lastBuildAt,
    lastBuildDurationMs: state.lastBuildDurationMs,
    watching: state.watching,
    port,
    hostTargets: config.hostTargets.map((t) => ({
      kind: t.kind,
      runtimeMode: t.runtimeMode,
      ...t.cacheDir ? { cacheDir: t.cacheDir } : {}
    })),
    releaseTargets: (config.releaseTargets ?? []).map((t) => {
      if (t.kind === "local-directory") {
        return { kind: t.kind, outputMode: t.outputMode, outputDir: t.outputDir };
      }
      if (t.kind === "git-pr") {
        return {
          kind: t.kind,
          outputMode: t.outputMode,
          owner: t.owner,
          repo: t.repo,
          baseBranch: t.baseBranch,
          ...t.packagePath ? { packagePath: t.packagePath } : {}
        };
      }
      return {
        kind: t.kind,
        outputMode: t.outputMode,
        packageName: t.packageName,
        ...t.registry ? { registry: t.registry } : {},
        ...t.scope ? { scope: t.scope } : {}
      };
    })
  };
  sendJson(res, 200, status);
}
async function handleGetIcons(res, state) {
  const icons = extractIconList(state.previousSourceFiles);
  sendJson(res, 200, { icons, count: icons.length });
}
async function handlePostIcons(req, res, repoRoot, config, state) {
  const body = await readBody(req);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }
  if (!Array.isArray(parsed.files)) {
    sendJson(res, 400, { error: "files must be an array" });
    return;
  }
  const sourceDir = path7.resolve(repoRoot, config.sourceDir);
  for (const file of parsed.files) {
    if (!isValidSourcePath(file.path)) {
      sendJson(res, 400, { error: `Invalid or unsafe source path: ${file.path}` });
      return;
    }
    const targetPath = path7.join(sourceDir, file.path);
    await mkdir3(path7.dirname(targetPath), { recursive: true });
    await writeFile3(targetPath, file.contents, "utf8");
  }
  const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
  applyBuildResult(state, result);
  if (result.kind === "success") {
    console.log(`[cuneiform] API ingest: ${parsed.files.length} file(s) received, rebuilt ${result.changedIcons} icon(s) in ${result.durationMs}ms`);
  }
  sendJson(res, 200, {
    ok: true,
    filesReceived: parsed.files.length,
    buildResult: result.kind,
    ...result.kind === "success" ? { changedIcons: result.changedIcons, totalIcons: result.totalIcons, durationMs: result.durationMs } : result.kind === "error" ? { error: result.error } : {}
  });
}
async function handlePostManifest(req, res, repoRoot, config, state) {
  const body = await readBody(req);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return;
  }
  if (typeof parsed.contents !== "string") {
    sendJson(res, 400, { error: "contents must be a string" });
    return;
  }
  try {
    JSON.parse(parsed.contents);
  } catch {
    sendJson(res, 400, { error: "contents is not valid JSON" });
    return;
  }
  const sourceDir = path7.resolve(repoRoot, config.sourceDir);
  await mkdir3(sourceDir, { recursive: true });
  await writeFile3(path7.join(sourceDir, "manifest.json"), parsed.contents, "utf8");
  const result = await incrementalRebuild(repoRoot, config, state.previousSourceFiles);
  applyBuildResult(state, result);
  sendJson(res, 200, {
    ok: true,
    buildResult: result.kind,
    ...result.kind === "success" ? { changedIcons: result.changedIcons, durationMs: result.durationMs } : result.kind === "error" ? { error: result.error } : {}
  });
}
function applyBuildResult(state, result) {
  if (result.kind === "success") {
    state.iconCount = result.totalIcons;
    state.lastBuildAt = new Date().toISOString();
    state.lastBuildDurationMs = result.durationMs;
    state.previousSourceFiles = result.sourceFiles;
  } else if (result.kind === "no-op") {}
}
function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(json)
  });
  res.end(json);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
function isValidSourcePath(filePath) {
  if (!filePath || typeof filePath !== "string")
    return false;
  if (path7.isAbsolute(filePath))
    return false;
  if (filePath.includes(".."))
    return false;
  const normalized = filePath.replace(/\\/g, "/");
  return normalized === "manifest.json" || /^icons\/[a-z0-9][a-z0-9-]*[a-z0-9]?\/icon\.json$/.test(normalized) || /^icons\/[a-z0-9][a-z0-9-]*[a-z0-9]?\/preview\.svg$/.test(normalized);
}
function extractIconList(sourceFiles) {
  if (!sourceFiles)
    return [];
  const manifestFile = sourceFiles.find((f) => f.path === "manifest.json");
  if (!manifestFile)
    return [];
  try {
    const manifest = JSON.parse(manifestFile.contents);
    return Object.entries(manifest.icons ?? {}).map(([dirName, entry]) => ({
      id: entry.id,
      name: entry.name,
      dirName,
      variantCount: entry.variantCount,
      sizes: entry.sizes,
      hasTransitions: entry.hasTransitions,
      hasEffects: entry.hasEffects
    }));
  } catch {
    return [];
  }
}

// src/commands/dev.ts
async function runDev(cwd, flags) {
  const configPath = typeof flags["config"] === "string" ? path8.resolve(cwd, flags["config"]) : path8.join(cwd, "cuneiform.config.ts");
  const rawPort = flags["port"];
  const port = typeof rawPort === "string" && /^\d+$/.test(rawPort) ? parseInt(rawPort, 10) : 4400;
  const apiSecret = typeof flags["secret"] === "string" ? flags["secret"] : undefined;
  if (!existsSync2(configPath)) {
    console.error(`[cuneiform] Config not found: ${path8.relative(cwd, configPath)}`);
    console.error(`         Run \`cuneiform init\` to scaffold cuneiform.config.ts`);
    process.exit(1);
  }
  let config;
  try {
    const rawModule = await import(configPath);
    const result = loadConfig(rawModule.default, configPath);
    if (!result.ok) {
      console.error(`[cuneiform] Config invalid:
${result.error}`);
      process.exit(1);
    }
    config = result.config;
  } catch (err) {
    console.error(`[cuneiform] Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const server = await startDevServer({
    repoRoot: cwd,
    cuneiform: config,
    port,
    apiSecret
  });
  const shutdown = async () => {
    console.log(`
[cuneiform] Shutting down...`);
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  await new Promise(() => {});
}

// src/commands/build.ts
import path9 from "node:path";
import { existsSync as existsSync3 } from "node:fs";
import { mkdir as mkdir4, writeFile as writeFile4 } from "node:fs/promises";
async function runBuild2(cwd, flags) {
  const configPath = typeof flags["config"] === "string" ? path9.resolve(cwd, flags["config"]) : path9.join(cwd, "cuneiform.config.ts");
  const outOverride = typeof flags["out"] === "string" ? flags["out"] : undefined;
  if (!existsSync3(configPath)) {
    console.error(`[cuneiform] Config not found: ${path9.relative(cwd, configPath)}`);
    process.exit(1);
  }
  let config;
  try {
    const rawModule = await import(configPath);
    const result = loadConfig(rawModule.default, configPath);
    if (!result.ok) {
      console.error(`[cuneiform] Config invalid:
${result.error}`);
      process.exit(1);
    }
    config = result.config;
  } catch (err) {
    console.error(`[cuneiform] Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const releaseTargets = config.releaseTargets ?? [];
  if (releaseTargets.length === 0 && !outOverride) {
    console.error(`[cuneiform] No releaseTargets configured and --out not provided.
         Add a local-directory target to cuneiform.config.ts or pass --out <dir>.`);
    process.exit(1);
  }
  const sourceDir = path9.resolve(cwd, config.sourceDir);
  if (!existsSync3(sourceDir)) {
    console.error(`[cuneiform] Source directory not found: ${config.sourceDir}`);
    console.error(`         Run \`cuneiform init\` to create it`);
    process.exit(1);
  }
  console.log(`[cuneiform] Loading source from ${config.sourceDir}...`);
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    console.error(`[cuneiform] Source read failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const iconCount = Object.keys(project.icons).length;
  if (iconCount === 0) {
    console.warn(`[cuneiform] Warning: no icons found in ${config.sourceDir}. Build will produce an empty output.`);
  }
  console.log(`[cuneiform] Compiling ${iconCount} icon(s)...`);
  const builtAt = new Date().toISOString();
  let compiled;
  try {
    compiled = compileProject(project, {
      package: {
        name: "cuneiform-build",
        version: "0.0.0",
        builtAt
      }
    });
  } catch (err) {
    console.error(`[cuneiform] Compile failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const localDirTargets = outOverride ? [{ kind: "local-directory", outputMode: "snapshot", outputDir: outOverride }] : releaseTargets.filter((t) => t.kind === "local-directory");
  for (const target of localDirTargets) {
    const outDir = path9.resolve(cwd, target.outputDir);
    console.log(`[cuneiform] Writing to ${target.outputDir}...`);
    for (const file of compiled.files) {
      const targetPath = path9.join(outDir, file.path);
      await mkdir4(path9.dirname(targetPath), { recursive: true });
      await writeFile4(targetPath, file.contents, "utf8");
    }
    console.log(`         ${compiled.files.length} file(s) written`);
  }
  for (const target of releaseTargets) {
    if (target.kind === "git-pr") {
      console.log(`
[cuneiform] git-pr target: ${target.owner}/${target.repo}
         To open a pull request, use the Create PR action in the Cuneiform editor.`);
    }
    if (target.kind === "npm-registry") {
      console.log(`
[cuneiform] npm-registry target: ${target.packageName}
         To publish to npm, use the Release action in the Cuneiform editor.`);
    }
  }
  const elapsedMs = Date.now() - new Date(builtAt).getTime();
  console.log(`
[cuneiform] Build complete — ${iconCount} icon(s) in ${elapsedMs}ms`);
}

// src/commands/validate.ts
import path10 from "node:path";
import { existsSync as existsSync4 } from "node:fs";
async function runValidate(cwd, flags) {
  const configPath = typeof flags["config"] === "string" ? path10.resolve(cwd, flags["config"]) : path10.join(cwd, "cuneiform.config.ts");
  let exitCode = 0;
  if (!existsSync4(configPath)) {
    console.error(`[cuneiform] Config not found: ${path10.relative(cwd, configPath)}`);
    console.error(`         Run \`cuneiform init\` to scaffold cuneiform.config.ts`);
    process.exit(1);
  }
  let rawModule;
  try {
    rawModule = await import(configPath);
  } catch (err) {
    console.error(`[cuneiform] Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const loadResult = loadConfig(rawModule.default, configPath);
  if (!loadResult.ok) {
    console.error(`[cuneiform] Config invalid:
${loadResult.error}`);
    process.exit(1);
  }
  const config = loadResult.config;
  console.log(`[cuneiform] Config`);
  console.log(`   sourceDir:       ${config.sourceDir}`);
  console.log(`   hostTargets:     ${config.hostTargets.length}`);
  console.log(`   releaseTargets:  ${(config.releaseTargets ?? []).length}`);
  console.log(`   status:          OK`);
  const sourceDir = path10.resolve(cwd, config.sourceDir);
  if (!existsSync4(sourceDir)) {
    console.error(`
[cuneiform] Source directory not found: ${config.sourceDir}`);
    console.error(`         Run \`cuneiform init\` to create it`);
    process.exit(1);
  }
  let project;
  try {
    project = await projectFromSourceDir(sourceDir);
  } catch (err) {
    console.error(`
[cuneiform] Source read failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const iconCount = Object.keys(project.icons).length;
  if (iconCount > 0) {
    try {
      const payload = exportSourcePayload(project);
      console.log(`
[cuneiform] Source`);
      console.log(`   icons:   ${iconCount}`);
      console.log(`   files:   ${payload.files.length}`);
      console.log(`   status:  OK`);
    } catch (err) {
      console.error(`
[cuneiform] Source export failed: ${err instanceof Error ? err.message : String(err)}`);
      exitCode = 1;
    }
  } else {
    console.log(`
[cuneiform] Source`);
    console.log(`   icons:   0  (no icons — run \`cuneiform init\` to populate from the editor)`);
    console.log(`   status:  OK`);
  }
  if (exitCode === 0) {
    console.log(`
[cuneiform] Validation passed`);
  } else {
    console.error(`
[cuneiform] Validation failed`);
    process.exit(exitCode);
  }
}

// src/bin.ts
function parseFlags(argv) {
  const flags = {};
  for (let i = 0;i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return flags;
}
var allArgs = process.argv.slice(2);
var flags = parseFlags(allArgs);
var command = (() => {
  for (let i = 0;i < allArgs.length; i++) {
    const a = allArgs[i];
    if (a.startsWith("--")) {
      const next = allArgs[i + 1];
      if (next !== undefined && !next.startsWith("--"))
        i++;
    } else {
      return a;
    }
  }
  return;
})();
async function main() {
  if (flags["help"] || flags["h"]) {
    printUsage();
    return;
  }
  if (flags["version"] || flags["v"]) {
    const pkg = await Promise.resolve().then(() => __toESM(require_package(), 1)).catch(() => ({ version: "unknown" }));
    console.log(pkg.version);
    return;
  }
  switch (command) {
    case "init":
      await runInit(process.cwd(), flags);
      break;
    case "dev":
      await runDev(process.cwd(), flags);
      break;
    case "build":
      await runBuild2(process.cwd(), flags);
      break;
    case "validate":
      await runValidate(process.cwd(), flags);
      break;
    default:
      if (command) {
        console.error(`[cuneiform] Unknown command: "${command}"
`);
        printUsage();
        process.exit(1);
      } else {
        printUsage();
      }
  }
}
function printUsage() {
  console.log(`
cuneiform — repo-native icon authoring by Cuneiform

Usage:
  cuneiform <command> [options]

Commands:
  init              Scaffold cuneiform.config.ts and source directory
  dev               Start live integration dev server (Lane 1)
  build             Deterministic snapshot build (Lane 2)
  validate          Validate config and source files

Options:
  --port <n>        Dev server port (default: 4400)
  --config <path>   Path to cuneiform.config.ts (default: ./cuneiform.config.ts)
  --out <path>      Output directory override for build
  --secret <token>  Shared secret for dev server API auth
  --version         Print version
  --help            Show this help
`);
}
main().catch((err) => {
  console.error(`[cuneiform] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
