import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignHorizontalJustifyCenterProps = {
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
  "id": "align-horizontal-justify-center",
  "name": "alignHorizontalJustifyCenter",
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
            "d": "M4 5 L6 5 C7.104569 5 8 5.895431 8 7 L8 17 C8 18.104569 7.104569 19 6 19 L4 19 C2.895431 19 2 18.104569 2 17 L2 7 C2 5.895431 2.895431 5 4 5 Z"
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
            "d": "M18 7 L20 7 C21.104569 7 22 7.895431 22 9 L22 15 C22 16.104569 21.104569 17 20 17 L18 17 C16.895431 17 16 16.104569 16 15 L16 9 C16 7.895431 16.895431 7 18 7 Z"
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
            "d": "M12 2 L12 22"
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
                "d": "M4 5 L6 5 C7.104569 5 8 5.895431 8 7 L8 17 C8 18.104569 7.104569 19 6 19 L4 19 C2.895431 19 2 18.104569 2 17 L2 7 C2 5.895431 2.895431 5 4 5 Z"
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
                "d": "M18 7 L20 7 C21.104569 7 22 7.895431 22 9 L22 15 C22 16.104569 21.104569 17 20 17 L18 17 C16.895431 17 16 16.104569 16 15 L16 9 C16 7.895431 16.895431 7 18 7 Z"
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
                "d": "M12 2 L12 22"
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
            "d": "M4 5 L6 5 C7.104569 5 8 5.895431 8 7 L8 17 C8 18.104569 7.104569 19 6 19 L4 19 C2.895431 19 2 18.104569 2 17 L2 7 C2 5.895431 2.895431 5 4 5 Z"
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
            "d": "M18 7 L20 7 C21.104569 7 22 7.895431 22 9 L22 15 C22 16.104569 21.104569 17 20 17 L18 17 C16.895431 17 16 16.104569 16 15 L16 9 C16 7.895431 16.895431 7 18 7 Z"
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
            "d": "M12 2 L12 22"
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
                "d": "M4 5 L6 5 C7.104569 5 8 5.895431 8 7 L8 17 C8 18.104569 7.104569 19 6 19 L4 19 C2.895431 19 2 18.104569 2 17 L2 7 C2 5.895431 2.895431 5 4 5 Z"
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
                "d": "M18 7 L20 7 C21.104569 7 22 7.895431 22 9 L22 15 C22 16.104569 21.104569 17 20 17 L18 17 C16.895431 17 16 16.104569 16 15 L16 9 C16 7.895431 16.895431 7 18 7 Z"
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
                "d": "M12 2 L12 22"
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
      "sourceIconId": "align-horizontal-justify-center",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.973Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignHorizontalJustifyCenter({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignHorizontalJustifyCenterProps) {
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
