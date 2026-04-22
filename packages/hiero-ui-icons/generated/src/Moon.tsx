import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type MoonProps = {
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
  "id": "moon",
  "name": "moon",
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
            "d": "M20.985 12.486 C20.72386 17.323496 16.680379 21.086329 11.83662 20.999415 C6.99286 20.912502 3.086976 17.007029 2.999551 12.163279 C2.912125 7.319529 6.674532 3.275651 11.512 3.014 C11.917 2.992 12.129 3.474 11.914 3.817 C10.433186 6.186257 10.783697 9.264054 12.759322 11.239678 C14.734946 13.215303 17.812743 13.565814 20.182 12.085 C20.526 11.87 21.007 12.081 20.985 12.486"
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
                "d": "M20.985 12.486 C20.72386 17.323496 16.680379 21.086329 11.83662 20.999415 C6.99286 20.912502 3.086976 17.007029 2.999551 12.163279 C2.912125 7.319529 6.674532 3.275651 11.512 3.014 C11.917 2.992 12.129 3.474 11.914 3.817 C10.433186 6.186257 10.783697 9.264054 12.759322 11.239678 C14.734946 13.215303 17.812743 13.565814 20.182 12.085 C20.526 11.87 21.007 12.081 20.985 12.486"
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
            "d": "M20.985 12.486 C20.72386 17.323496 16.680379 21.086329 11.83662 20.999415 C6.99286 20.912502 3.086976 17.007029 2.999551 12.163279 C2.912125 7.319529 6.674532 3.275651 11.512 3.014 C11.917 2.992 12.129 3.474 11.914 3.817 C10.433186 6.186257 10.783697 9.264054 12.759322 11.239678 C14.734946 13.215303 17.812743 13.565814 20.182 12.085 C20.526 11.87 21.007 12.081 20.985 12.486"
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
                "d": "M20.985 12.486 C20.72386 17.323496 16.680379 21.086329 11.83662 20.999415 C6.99286 20.912502 3.086976 17.007029 2.999551 12.163279 C2.912125 7.319529 6.674532 3.275651 11.512 3.014 C11.917 2.992 12.129 3.474 11.914 3.817 C10.433186 6.186257 10.783697 9.264054 12.759322 11.239678 C14.734946 13.215303 17.812743 13.565814 20.182 12.085 C20.526 11.87 21.007 12.081 20.985 12.486"
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
      "sourceIconId": "moon",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:58.000Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Moon({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: MoonProps) {
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
