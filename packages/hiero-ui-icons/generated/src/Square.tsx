import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type SquareProps = {
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
  "id": "square",
  "name": "square",
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
        "rect": {
          "id": "rect",
          "path": {
            "d": "M5 3 L19 3 C20.104569 3 21 3.895431 21 5 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
            "rect": {
              "id": "rect",
              "path": {
                "d": "M5 3 L19 3 C20.104569 3 21 3.895431 21 5 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
        "rect": {
          "id": "rect",
          "path": {
            "d": "M5 3 L19 3 C20.104569 3 21 3.895431 21 5 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
            "rect": {
              "id": "rect",
              "path": {
                "d": "M5 3 L19 3 C20.104569 3 21 3.895431 21 5 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
      "sourceIconId": "square",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.152Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Square({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: SquareProps) {
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
