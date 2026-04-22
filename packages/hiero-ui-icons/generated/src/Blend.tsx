import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type BlendProps = {
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
  "id": "blend",
  "name": "blend",
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
        "circle": {
          "id": "circle",
          "path": {
            "d": "M9 2 C12.866 2 16 5.134 16 9 C16 12.866 12.866 16 9 16 C5.134 16 2 12.866 2 9 C2 5.134 5.134 2 9 2 Z"
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
        "circle-2": {
          "id": "circle-2",
          "path": {
            "d": "M15 8 C18.866 8 22 11.134 22 15 C22 18.866 18.866 22 15 22 C11.134 22 8 18.866 8 15 C8 11.134 11.134 8 15 8 Z"
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
            "circle": {
              "id": "circle",
              "path": {
                "d": "M9 2 C12.866 2 16 5.134 16 9 C16 12.866 12.866 16 9 16 C5.134 16 2 12.866 2 9 C2 5.134 5.134 2 9 2 Z"
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
            "circle-2": {
              "id": "circle-2",
              "path": {
                "d": "M15 8 C18.866 8 22 11.134 22 15 C22 18.866 18.866 22 15 22 C11.134 22 8 18.866 8 15 C8 11.134 11.134 8 15 8 Z"
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
        "circle": {
          "id": "circle",
          "path": {
            "d": "M9 2 C12.866 2 16 5.134 16 9 C16 12.866 12.866 16 9 16 C5.134 16 2 12.866 2 9 C2 5.134 5.134 2 9 2 Z"
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
        "circle-2": {
          "id": "circle-2",
          "path": {
            "d": "M15 8 C18.866 8 22 11.134 22 15 C22 18.866 18.866 22 15 22 C11.134 22 8 18.866 8 15 C8 11.134 11.134 8 15 8 Z"
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
            "circle": {
              "id": "circle",
              "path": {
                "d": "M9 2 C12.866 2 16 5.134 16 9 C16 12.866 12.866 16 9 16 C5.134 16 2 12.866 2 9 C2 5.134 5.134 2 9 2 Z"
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
            "circle-2": {
              "id": "circle-2",
              "path": {
                "d": "M15 8 C18.866 8 22 11.134 22 15 C22 18.866 18.866 22 15 22 C11.134 22 8 18.866 8 15 C8 11.134 11.134 8 15 8 Z"
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
      "sourceIconId": "blend",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.986Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Blend({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: BlendProps) {
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
