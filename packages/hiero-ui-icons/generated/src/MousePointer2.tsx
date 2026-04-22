import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type MousePointer2Props = {
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
  "id": "mouse-pointer-2",
  "name": "mousePointer2",
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
            "d": "M4.037 4.688 C3.956239 4.501616 3.997543 4.28481 4.141177 4.141177 C4.28481 3.997543 4.501616 3.956239 4.688 4.037 L20.688 10.537 C20.88753 10.618291 21.012549 10.818256 20.998247 11.033235 C20.983945 11.248214 20.83354 11.429856 20.625 11.484 L14.501 13.064 C13.796329 13.245158 13.245629 13.794709 13.063 14.499 L11.484 20.625 C11.429856 20.83354 11.248214 20.983945 11.033235 20.998247 C10.818256 21.012549 10.618291 20.88753 10.537 20.688 Z"
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
                "d": "M4.037 4.688 C3.956239 4.501616 3.997543 4.28481 4.141177 4.141177 C4.28481 3.997543 4.501616 3.956239 4.688 4.037 L20.688 10.537 C20.88753 10.618291 21.012549 10.818256 20.998247 11.033235 C20.983945 11.248214 20.83354 11.429856 20.625 11.484 L14.501 13.064 C13.796329 13.245158 13.245629 13.794709 13.063 14.499 L11.484 20.625 C11.429856 20.83354 11.248214 20.983945 11.033235 20.998247 C10.818256 21.012549 10.618291 20.88753 10.537 20.688 Z"
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
            "d": "M4.037 4.688 C3.956239 4.501616 3.997543 4.28481 4.141177 4.141177 C4.28481 3.997543 4.501616 3.956239 4.688 4.037 L20.688 10.537 C20.88753 10.618291 21.012549 10.818256 20.998247 11.033235 C20.983945 11.248214 20.83354 11.429856 20.625 11.484 L14.501 13.064 C13.796329 13.245158 13.245629 13.794709 13.063 14.499 L11.484 20.625 C11.429856 20.83354 11.248214 20.983945 11.033235 20.998247 C10.818256 21.012549 10.618291 20.88753 10.537 20.688 Z"
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
                "d": "M4.037 4.688 C3.956239 4.501616 3.997543 4.28481 4.141177 4.141177 C4.28481 3.997543 4.501616 3.956239 4.688 4.037 L20.688 10.537 C20.88753 10.618291 21.012549 10.818256 20.998247 11.033235 C20.983945 11.248214 20.83354 11.429856 20.625 11.484 L14.501 13.064 C13.796329 13.245158 13.245629 13.794709 13.063 14.499 L11.484 20.625 C11.429856 20.83354 11.248214 20.983945 11.033235 20.998247 C10.818256 21.012549 10.618291 20.88753 10.537 20.688 Z"
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
      "sourceIconId": "mouse-pointer-2",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:58.000Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function MousePointer2({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: MousePointer2Props) {
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
