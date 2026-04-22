import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PentagonProps = {
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
  "id": "pentagon",
  "name": "pentagon",
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
            "d": "M10.83 2.38 C11.528613 1.876089 12.471387 1.876089 13.17 2.38 L21.17 8.12 C21.878312 8.6303 22.173802 9.541058 21.9 10.37 L18.86 19.63 C18.588318 20.448575 17.822482 21.000783 16.96 21 L7.04 21 C6.177518 21.000783 5.411682 20.448575 5.14 19.63 L2.1 10.37 C1.826198 9.541058 2.121688 8.6303 2.83 8.12 Z"
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
                "d": "M10.83 2.38 C11.528613 1.876089 12.471387 1.876089 13.17 2.38 L21.17 8.12 C21.878312 8.6303 22.173802 9.541058 21.9 10.37 L18.86 19.63 C18.588318 20.448575 17.822482 21.000783 16.96 21 L7.04 21 C6.177518 21.000783 5.411682 20.448575 5.14 19.63 L2.1 10.37 C1.826198 9.541058 2.121688 8.6303 2.83 8.12 Z"
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
            "d": "M10.83 2.38 C11.528613 1.876089 12.471387 1.876089 13.17 2.38 L21.17 8.12 C21.878312 8.6303 22.173802 9.541058 21.9 10.37 L18.86 19.63 C18.588318 20.448575 17.822482 21.000783 16.96 21 L7.04 21 C6.177518 21.000783 5.411682 20.448575 5.14 19.63 L2.1 10.37 C1.826198 9.541058 2.121688 8.6303 2.83 8.12 Z"
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
                "d": "M10.83 2.38 C11.528613 1.876089 12.471387 1.876089 13.17 2.38 L21.17 8.12 C21.878312 8.6303 22.173802 9.541058 21.9 10.37 L18.86 19.63 C18.588318 20.448575 17.822482 21.000783 16.96 21 L7.04 21 C6.177518 21.000783 5.411682 20.448575 5.14 19.63 L2.1 10.37 C1.826198 9.541058 2.121688 8.6303 2.83 8.12 Z"
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
      "sourceIconId": "pentagon",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:58.004Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Pentagon({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PentagonProps) {
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
