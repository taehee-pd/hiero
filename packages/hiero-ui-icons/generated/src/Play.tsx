import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PlayProps = {
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
  "id": "play",
  "name": "play",
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
            "d": "M5 5 C4.999788 4.28371 5.382652 3.621998 6.003751 3.265196 C6.62485 2.908395 7.389338 2.91099 8.008 3.272 L20.005 10.27 C20.621144 10.62752 21.000617 11.285779 21.001235 11.998137 C21.001853 12.710495 20.623523 13.369412 20.008 13.728 L8.008 20.728 C7.389338 21.08901 6.62485 21.091605 6.003751 20.734804 C5.382652 20.378002 4.999788 19.71629 5 19 Z"
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
                "d": "M5 5 C4.999788 4.28371 5.382652 3.621998 6.003751 3.265196 C6.62485 2.908395 7.389338 2.91099 8.008 3.272 L20.005 10.27 C20.621144 10.62752 21.000617 11.285779 21.001235 11.998137 C21.001853 12.710495 20.623523 13.369412 20.008 13.728 L8.008 20.728 C7.389338 21.08901 6.62485 21.091605 6.003751 20.734804 C5.382652 20.378002 4.999788 19.71629 5 19 Z"
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
            "d": "M5 5 C4.999788 4.28371 5.382652 3.621998 6.003751 3.265196 C6.62485 2.908395 7.389338 2.91099 8.008 3.272 L20.005 10.27 C20.621144 10.62752 21.000617 11.285779 21.001235 11.998137 C21.001853 12.710495 20.623523 13.369412 20.008 13.728 L8.008 20.728 C7.389338 21.08901 6.62485 21.091605 6.003751 20.734804 C5.382652 20.378002 4.999788 19.71629 5 19 Z"
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
                "d": "M5 5 C4.999788 4.28371 5.382652 3.621998 6.003751 3.265196 C6.62485 2.908395 7.389338 2.91099 8.008 3.272 L20.005 10.27 C20.621144 10.62752 21.000617 11.285779 21.001235 11.998137 C21.001853 12.710495 20.623523 13.369412 20.008 13.728 L8.008 20.728 C7.389338 21.08901 6.62485 21.091605 6.003751 20.734804 C5.382652 20.378002 4.999788 19.71629 5 19 Z"
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
      "sourceIconId": "play",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.934Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Play({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PlayProps) {
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
