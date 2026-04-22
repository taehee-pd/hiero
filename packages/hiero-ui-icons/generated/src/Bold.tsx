import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type BoldProps = {
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
  "id": "bold",
  "name": "bold",
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
            "d": "M6 12 L15 12 C17.209139 12 19 13.790861 19 16 C19 18.209139 17.209139 20 15 20 L7 20 C6.447715 20 6 19.552285 6 19 L6 5 C6 4.447715 6.447715 4 7 4 L14 4 C16.209139 4 18 5.790861 18 8 C18 10.209139 16.209139 12 14 12"
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
                "d": "M6 12 L15 12 C17.209139 12 19 13.790861 19 16 C19 18.209139 17.209139 20 15 20 L7 20 C6.447715 20 6 19.552285 6 19 L6 5 C6 4.447715 6.447715 4 7 4 L14 4 C16.209139 4 18 5.790861 18 8 C18 10.209139 16.209139 12 14 12"
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
            "d": "M6 12 L15 12 C17.209139 12 19 13.790861 19 16 C19 18.209139 17.209139 20 15 20 L7 20 C6.447715 20 6 19.552285 6 19 L6 5 C6 4.447715 6.447715 4 7 4 L14 4 C16.209139 4 18 5.790861 18 8 C18 10.209139 16.209139 12 14 12"
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
                "d": "M6 12 L15 12 C17.209139 12 19 13.790861 19 16 C19 18.209139 17.209139 20 15 20 L7 20 C6.447715 20 6 19.552285 6 19 L6 5 C6 4.447715 6.447715 4 7 4 L14 4 C16.209139 4 18 5.790861 18 8 C18 10.209139 16.209139 12 14 12"
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
      "sourceVersion": "1.8.0",
      "sourceIconId": "bold",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.191Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Bold({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: BoldProps) {
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
