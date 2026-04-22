import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignStartVerticalProps = {
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
  "id": "align-start-vertical",
  "name": "alignStartVertical",
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
            "d": "M8 14 L13 14 C14.104569 14 15 14.895431 15 16 L15 18 C15 19.104569 14.104569 20 13 20 L8 20 C6.895431 20 6 19.104569 6 18 L6 16 C6 14.895431 6.895431 14 8 14 Z"
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
            "d": "M8 4 L20 4 C21.104569 4 22 4.895431 22 6 L22 8 C22 9.104569 21.104569 10 20 10 L8 10 C6.895431 10 6 9.104569 6 8 L6 6 C6 4.895431 6.895431 4 8 4 Z"
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
            "d": "M2 2 L2 22"
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
                "d": "M8 14 L13 14 C14.104569 14 15 14.895431 15 16 L15 18 C15 19.104569 14.104569 20 13 20 L8 20 C6.895431 20 6 19.104569 6 18 L6 16 C6 14.895431 6.895431 14 8 14 Z"
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
                "d": "M8 4 L20 4 C21.104569 4 22 4.895431 22 6 L22 8 C22 9.104569 21.104569 10 20 10 L8 10 C6.895431 10 6 9.104569 6 8 L6 6 C6 4.895431 6.895431 4 8 4 Z"
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
                "d": "M2 2 L2 22"
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
            "d": "M8 14 L13 14 C14.104569 14 15 14.895431 15 16 L15 18 C15 19.104569 14.104569 20 13 20 L8 20 C6.895431 20 6 19.104569 6 18 L6 16 C6 14.895431 6.895431 14 8 14 Z"
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
            "d": "M8 4 L20 4 C21.104569 4 22 4.895431 22 6 L22 8 C22 9.104569 21.104569 10 20 10 L8 10 C6.895431 10 6 9.104569 6 8 L6 6 C6 4.895431 6.895431 4 8 4 Z"
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
            "d": "M2 2 L2 22"
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
                "d": "M8 14 L13 14 C14.104569 14 15 14.895431 15 16 L15 18 C15 19.104569 14.104569 20 13 20 L8 20 C6.895431 20 6 19.104569 6 18 L6 16 C6 14.895431 6.895431 14 8 14 Z"
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
                "d": "M8 4 L20 4 C21.104569 4 22 4.895431 22 6 L22 8 C22 9.104569 21.104569 10 20 10 L8 10 C6.895431 10 6 9.104569 6 8 L6 6 C6 4.895431 6.895431 4 8 4 Z"
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
                "d": "M2 2 L2 22"
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
      "sourceIconId": "align-start-vertical",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.977Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignStartVertical({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignStartVerticalProps) {
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
