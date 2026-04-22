import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignStartHorizontalProps = {
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
  "id": "align-start-horizontal",
  "name": "alignStartHorizontal",
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
            "d": "M6 6 L8 6 C9.104569 6 10 6.895431 10 8 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 8 C4 6.895431 4.895431 6 6 6 Z"
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
            "d": "M16 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 13 C20 14.104569 19.104569 15 18 15 L16 15 C14.895431 15 14 14.104569 14 13 L14 8 C14 6.895431 14.895431 6 16 6 Z"
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
            "d": "M22 2 L2 2"
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
                "d": "M6 6 L8 6 C9.104569 6 10 6.895431 10 8 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 8 C4 6.895431 4.895431 6 6 6 Z"
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
                "d": "M16 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 13 C20 14.104569 19.104569 15 18 15 L16 15 C14.895431 15 14 14.104569 14 13 L14 8 C14 6.895431 14.895431 6 16 6 Z"
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
                "d": "M22 2 L2 2"
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
            "d": "M6 6 L8 6 C9.104569 6 10 6.895431 10 8 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 8 C4 6.895431 4.895431 6 6 6 Z"
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
            "d": "M16 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 13 C20 14.104569 19.104569 15 18 15 L16 15 C14.895431 15 14 14.104569 14 13 L14 8 C14 6.895431 14.895431 6 16 6 Z"
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
            "d": "M22 2 L2 2"
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
                "d": "M6 6 L8 6 C9.104569 6 10 6.895431 10 8 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 8 C4 6.895431 4.895431 6 6 6 Z"
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
                "d": "M16 6 L18 6 C19.104569 6 20 6.895431 20 8 L20 13 C20 14.104569 19.104569 15 18 15 L16 15 C14.895431 15 14 14.104569 14 13 L14 8 C14 6.895431 14.895431 6 16 6 Z"
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
                "d": "M22 2 L2 2"
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
      "sourceIconId": "align-start-horizontal",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.976Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignStartHorizontal({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignStartHorizontalProps) {
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
