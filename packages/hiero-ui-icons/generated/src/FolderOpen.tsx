import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type FolderOpenProps = {
  size?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
  label?: string;
  reduceMotion?: boolean | 'system';
  variant?: "v-16" | "v-24" | "16" | "24" | number;
  effect?: never;
  animate?: boolean;
};

const iconData = {
  "id": "folder-open",
  "name": "folderOpen",
  "variants": {
    "v-16": {
      "id": "v-16",
      "name": "16",
      "size": 16,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "path": {
          "id": "path",
          "path": {
            "d": "M6 14 L7.5 11.1 C7.832288 10.440079 8.50134 10.017115 9.24 10 L20 10 C20.619191 9.998914 21.203969 10.284685 21.583574 10.773867 C21.963179 11.263049 22.094799 11.90047 21.94 12.5 L20.4 18.5 C20.17076 19.387928 19.367021 20.006188 18.45 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 10"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "path": {
              "id": "path",
              "path": {
                "d": "M6 14 L7.5 11.1 C7.832288 10.440079 8.50134 10.017115 9.24 10 L20 10 C20.619191 9.998914 21.203969 10.284685 21.583574 10.773867 C21.963179 11.263049 22.094799 11.90047 21.94 12.5 L20.4 18.5 C20.17076 19.387928 19.367021 20.006188 18.45 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 10"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            }
          }
        }
      }
    },
    "v-24": {
      "id": "v-24",
      "name": "24",
      "size": 24,
      "viewBox": [
        0,
        0,
        24,
        24
      ],
      "layers": {
        "path": {
          "id": "path",
          "path": {
            "d": "M6 14 L7.5 11.1 C7.832288 10.440079 8.50134 10.017115 9.24 10 L20 10 C20.619191 9.998914 21.203969 10.284685 21.583574 10.773867 C21.963179 11.263049 22.094799 11.90047 21.94 12.5 L20.4 18.5 C20.17076 19.387928 19.367021 20.006188 18.45 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 10"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "path": {
              "id": "path",
              "path": {
                "d": "M6 14 L7.5 11.1 C7.832288 10.440079 8.50134 10.017115 9.24 10 L20 10 C20.619191 9.998914 21.203969 10.284685 21.583574 10.773867 C21.963179 11.263049 22.094799 11.90047 21.94 12.5 L20.4 18.5 C20.17076 19.387928 19.367021 20.006188 18.45 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 10"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            }
          }
        }
      }
    }
  },
  "meta": {
    "externalImport": {
      "adapterId": "lucide",
      "sourceLibrary": "lucide",
      "sourceVersion": "0.577.0",
      "sourceIconId": "folder-open",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.922Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function FolderOpen({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: FolderOpenProps) {
  return (
    <HieroIcon
      icon={typedIconData}
      size={size}
      color={color}
      className={className}
      style={style}
      label={label}
      reduceMotion={reduceMotion}
      variant={variant}
      animate={animate}
    />
  );
}
