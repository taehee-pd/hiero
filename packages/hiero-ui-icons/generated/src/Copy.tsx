import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type CopyProps = {
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
  "id": "copy",
  "name": "copy",
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
            "d": "M10 8 L20 8 C21.104569 8 22 8.895431 22 10 L22 20 C22 21.104569 21.104569 22 20 22 L10 22 C8.895431 22 8 21.104569 8 20 L8 10 C8 8.895431 8.895431 8 10 8 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path": {
          "id": "path",
          "path": {
            "d": "M4 16 C2.9 16 2 15.1 2 14 L2 4 C2 2.9 2.9 2 4 2 L14 2 C15.1 2 16 2.9 16 4"
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
                "d": "M10 8 L20 8 C21.104569 8 22 8.895431 22 10 L22 20 C22 21.104569 21.104569 22 20 22 L10 22 C8.895431 22 8 21.104569 8 20 L8 10 C8 8.895431 8.895431 8 10 8 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path": {
              "id": "path",
              "path": {
                "d": "M4 16 C2.9 16 2 15.1 2 14 L2 4 C2 2.9 2.9 2 4 2 L14 2 C15.1 2 16 2.9 16 4"
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
            "d": "M10 8 L20 8 C21.104569 8 22 8.895431 22 10 L22 20 C22 21.104569 21.104569 22 20 22 L10 22 C8.895431 22 8 21.104569 8 20 L8 10 C8 8.895431 8.895431 8 10 8 Z"
          },
          "style": {
            "stroke": {
              "mode": "currentColor"
            },
            "strokeWidth": 2,
            "lineCap": "round",
            "lineJoin": "round"
          }
        },
        "path": {
          "id": "path",
          "path": {
            "d": "M4 16 C2.9 16 2 15.1 2 14 L2 4 C2 2.9 2.9 2 4 2 L14 2 C15.1 2 16 2.9 16 4"
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
                "d": "M10 8 L20 8 C21.104569 8 22 8.895431 22 10 L22 20 C22 21.104569 21.104569 22 20 22 L10 22 C8.895431 22 8 21.104569 8 20 L8 10 C8 8.895431 8.895431 8 10 8 Z"
              },
              "style": {
                "stroke": {
                  "mode": "currentColor"
                },
                "strokeWidth": 2,
                "lineCap": "round",
                "lineJoin": "round"
              }
            },
            "path": {
              "id": "path",
              "path": {
                "d": "M4 16 C2.9 16 2 15.1 2 14 L2 4 C2 2.9 2.9 2 4 2 L14 2 C15.1 2 16 2.9 16 4"
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
      "sourceIconId": "copy",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.891Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Copy({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: CopyProps) {
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
