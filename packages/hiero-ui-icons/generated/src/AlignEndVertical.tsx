import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignEndVerticalProps = {
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
  "id": "align-end-vertical",
  "name": "alignEndVertical",
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
            "d": "M4 4 L16 4 C17.104569 4 18 4.895431 18 6 L18 8 C18 9.104569 17.104569 10 16 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 6 C2 4.895431 2.895431 4 4 4 Z"
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
            "d": "M11 14 L16 14 C17.104569 14 18 14.895431 18 16 L18 18 C18 19.104569 17.104569 20 16 20 L11 20 C9.895431 20 9 19.104569 9 18 L9 16 C9 14.895431 9.895431 14 11 14 Z"
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
            "d": "M22 22 L22 2"
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
                "d": "M4 4 L16 4 C17.104569 4 18 4.895431 18 6 L18 8 C18 9.104569 17.104569 10 16 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 6 C2 4.895431 2.895431 4 4 4 Z"
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
                "d": "M11 14 L16 14 C17.104569 14 18 14.895431 18 16 L18 18 C18 19.104569 17.104569 20 16 20 L11 20 C9.895431 20 9 19.104569 9 18 L9 16 C9 14.895431 9.895431 14 11 14 Z"
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
                "d": "M22 22 L22 2"
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
            "d": "M4 4 L16 4 C17.104569 4 18 4.895431 18 6 L18 8 C18 9.104569 17.104569 10 16 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 6 C2 4.895431 2.895431 4 4 4 Z"
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
            "d": "M11 14 L16 14 C17.104569 14 18 14.895431 18 16 L18 18 C18 19.104569 17.104569 20 16 20 L11 20 C9.895431 20 9 19.104569 9 18 L9 16 C9 14.895431 9.895431 14 11 14 Z"
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
            "d": "M22 22 L22 2"
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
                "d": "M4 4 L16 4 C17.104569 4 18 4.895431 18 6 L18 8 C18 9.104569 17.104569 10 16 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 6 C2 4.895431 2.895431 4 4 4 Z"
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
                "d": "M11 14 L16 14 C17.104569 14 18 14.895431 18 16 L18 18 C18 19.104569 17.104569 20 16 20 L11 20 C9.895431 20 9 19.104569 9 18 L9 16 C9 14.895431 9.895431 14 11 14 Z"
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
                "d": "M22 22 L22 2"
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
      "sourceIconId": "align-end-vertical",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.972Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignEndVertical({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignEndVerticalProps) {
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
