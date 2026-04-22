import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PauseProps = {
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
  "id": "pause",
  "name": "pause",
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
            "d": "M15 3 L18 3 C18.552285 3 19 3.447715 19 4 L19 20 C19 20.552285 18.552285 21 18 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
        "rect-2": {
          "id": "rect-2",
          "path": {
            "d": "M6 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 20 C10 20.552285 9.552285 21 9 21 L6 21 C5.447715 21 5 20.552285 5 20 L5 4 C5 3.447715 5.447715 3 6 3 Z"
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
                "d": "M15 3 L18 3 C18.552285 3 19 3.447715 19 4 L19 20 C19 20.552285 18.552285 21 18 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
            "rect-2": {
              "id": "rect-2",
              "path": {
                "d": "M6 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 20 C10 20.552285 9.552285 21 9 21 L6 21 C5.447715 21 5 20.552285 5 20 L5 4 C5 3.447715 5.447715 3 6 3 Z"
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
            "d": "M15 3 L18 3 C18.552285 3 19 3.447715 19 4 L19 20 C19 20.552285 18.552285 21 18 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
        "rect-2": {
          "id": "rect-2",
          "path": {
            "d": "M6 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 20 C10 20.552285 9.552285 21 9 21 L6 21 C5.447715 21 5 20.552285 5 20 L5 4 C5 3.447715 5.447715 3 6 3 Z"
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
                "d": "M15 3 L18 3 C18.552285 3 19 3.447715 19 4 L19 20 C19 20.552285 18.552285 21 18 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
            "rect-2": {
              "id": "rect-2",
              "path": {
                "d": "M6 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 20 C10 20.552285 9.552285 21 9 21 L6 21 C5.447715 21 5 20.552285 5 20 L5 4 C5 3.447715 5.447715 3 6 3 Z"
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
      "sourceIconId": "pause",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.937Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Pause({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PauseProps) {
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
