import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type LockProps = {
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
  "id": "lock",
  "name": "lock",
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
            "d": "M5 11 L19 11 C20.104569 11 21 11.895431 21 13 L21 20 C21 21.104569 20.104569 22 19 22 L5 22 C3.895431 22 3 21.104569 3 20 L3 13 C3 11.895431 3.895431 11 5 11 Z"
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
            "d": "M7 11 L7 7 C7 4.238576 9.238576 2 12 2 C14.761424 2 17 4.238576 17 7 L17 11"
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
                "d": "M5 11 L19 11 C20.104569 11 21 11.895431 21 13 L21 20 C21 21.104569 20.104569 22 19 22 L5 22 C3.895431 22 3 21.104569 3 20 L3 13 C3 11.895431 3.895431 11 5 11 Z"
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
                "d": "M7 11 L7 7 C7 4.238576 9.238576 2 12 2 C14.761424 2 17 4.238576 17 7 L17 11"
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
            "d": "M5 11 L19 11 C20.104569 11 21 11.895431 21 13 L21 20 C21 21.104569 20.104569 22 19 22 L5 22 C3.895431 22 3 21.104569 3 20 L3 13 C3 11.895431 3.895431 11 5 11 Z"
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
            "d": "M7 11 L7 7 C7 4.238576 9.238576 2 12 2 C14.761424 2 17 4.238576 17 7 L17 11"
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
                "d": "M5 11 L19 11 C20.104569 11 21 11.895431 21 13 L21 20 C21 21.104569 20.104569 22 19 22 L5 22 C3.895431 22 3 21.104569 3 20 L3 13 C3 11.895431 3.895431 11 5 11 Z"
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
                "d": "M7 11 L7 7 C7 4.238576 9.238576 2 12 2 C14.761424 2 17 4.238576 17 7 L17 11"
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
      "sourceIconId": "lock",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.996Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Lock({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: LockProps) {
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
