import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignEndHorizontalProps = {
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
  "id": "align-end-horizontal",
  "name": "alignEndHorizontal",
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
            "d": "M6 2 L8 2 C9.104569 2 10 2.895431 10 4 L10 16 C10 17.104569 9.104569 18 8 18 L6 18 C4.895431 18 4 17.104569 4 16 L4 4 C4 2.895431 4.895431 2 6 2 Z"
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
            "d": "M16 9 L18 9 C19.104569 9 20 9.895431 20 11 L20 16 C20 17.104569 19.104569 18 18 18 L16 18 C14.895431 18 14 17.104569 14 16 L14 11 C14 9.895431 14.895431 9 16 9 Z"
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
            "d": "M22 22 L2 22"
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
                "d": "M6 2 L8 2 C9.104569 2 10 2.895431 10 4 L10 16 C10 17.104569 9.104569 18 8 18 L6 18 C4.895431 18 4 17.104569 4 16 L4 4 C4 2.895431 4.895431 2 6 2 Z"
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
                "d": "M16 9 L18 9 C19.104569 9 20 9.895431 20 11 L20 16 C20 17.104569 19.104569 18 18 18 L16 18 C14.895431 18 14 17.104569 14 16 L14 11 C14 9.895431 14.895431 9 16 9 Z"
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
                "d": "M22 22 L2 22"
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
            "d": "M6 2 L8 2 C9.104569 2 10 2.895431 10 4 L10 16 C10 17.104569 9.104569 18 8 18 L6 18 C4.895431 18 4 17.104569 4 16 L4 4 C4 2.895431 4.895431 2 6 2 Z"
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
            "d": "M16 9 L18 9 C19.104569 9 20 9.895431 20 11 L20 16 C20 17.104569 19.104569 18 18 18 L16 18 C14.895431 18 14 17.104569 14 16 L14 11 C14 9.895431 14.895431 9 16 9 Z"
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
            "d": "M22 22 L2 22"
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
                "d": "M6 2 L8 2 C9.104569 2 10 2.895431 10 4 L10 16 C10 17.104569 9.104569 18 8 18 L6 18 C4.895431 18 4 17.104569 4 16 L4 4 C4 2.895431 4.895431 2 6 2 Z"
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
                "d": "M16 9 L18 9 C19.104569 9 20 9.895431 20 11 L20 16 C20 17.104569 19.104569 18 18 18 L16 18 C14.895431 18 14 17.104569 14 16 L14 11 C14 9.895431 14.895431 9 16 9 Z"
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
                "d": "M22 22 L2 22"
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
      "sourceIconId": "align-end-horizontal",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.971Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignEndHorizontal({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignEndHorizontalProps) {
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
