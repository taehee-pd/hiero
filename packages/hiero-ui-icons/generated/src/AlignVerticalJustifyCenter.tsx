import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignVerticalJustifyCenterProps = {
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
  "id": "align-vertical-justify-center",
  "name": "alignVerticalJustifyCenter",
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
            "d": "M7 16 L17 16 C18.104569 16 19 16.895431 19 18 L19 20 C19 21.104569 18.104569 22 17 22 L7 22 C5.895431 22 5 21.104569 5 20 L5 18 C5 16.895431 5.895431 16 7 16 Z"
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
            "d": "M9 2 L15 2 C16.104569 2 17 2.895431 17 4 L17 6 C17 7.104569 16.104569 8 15 8 L9 8 C7.895431 8 7 7.104569 7 6 L7 4 C7 2.895431 7.895431 2 9 2 Z"
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
            "d": "M2 12 L22 12"
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
                "d": "M7 16 L17 16 C18.104569 16 19 16.895431 19 18 L19 20 C19 21.104569 18.104569 22 17 22 L7 22 C5.895431 22 5 21.104569 5 20 L5 18 C5 16.895431 5.895431 16 7 16 Z"
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
                "d": "M9 2 L15 2 C16.104569 2 17 2.895431 17 4 L17 6 C17 7.104569 16.104569 8 15 8 L9 8 C7.895431 8 7 7.104569 7 6 L7 4 C7 2.895431 7.895431 2 9 2 Z"
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
                "d": "M2 12 L22 12"
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
            "d": "M7 16 L17 16 C18.104569 16 19 16.895431 19 18 L19 20 C19 21.104569 18.104569 22 17 22 L7 22 C5.895431 22 5 21.104569 5 20 L5 18 C5 16.895431 5.895431 16 7 16 Z"
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
            "d": "M9 2 L15 2 C16.104569 2 17 2.895431 17 4 L17 6 C17 7.104569 16.104569 8 15 8 L9 8 C7.895431 8 7 7.104569 7 6 L7 4 C7 2.895431 7.895431 2 9 2 Z"
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
            "d": "M2 12 L22 12"
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
                "d": "M7 16 L17 16 C18.104569 16 19 16.895431 19 18 L19 20 C19 21.104569 18.104569 22 17 22 L7 22 C5.895431 22 5 21.104569 5 20 L5 18 C5 16.895431 5.895431 16 7 16 Z"
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
                "d": "M9 2 L15 2 C16.104569 2 17 2.895431 17 4 L17 6 C17 7.104569 16.104569 8 15 8 L9 8 C7.895431 8 7 7.104569 7 6 L7 4 C7 2.895431 7.895431 2 9 2 Z"
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
                "d": "M2 12 L22 12"
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
      "sourceIconId": "align-vertical-justify-center",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.978Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignVerticalJustifyCenter({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignVerticalJustifyCenterProps) {
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
