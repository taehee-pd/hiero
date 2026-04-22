import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type ZoomOutProps = {
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
  "id": "zoom-out",
  "name": "zoomOut",
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
            "d": "M11 3 C15.418 3 19 6.582 19 11 C19 15.418 15.418 19 11 19 C6.582 19 3 15.418 3 11 C3 6.582 6.582 3 11 3 Z"
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
        "line": {
          "id": "line",
          "path": {
            "d": "M21 21 L16.65 16.65"
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
        "line-2": {
          "id": "line-2",
          "path": {
            "d": "M8 11 L14 11"
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
                "d": "M11 3 C15.418 3 19 6.582 19 11 C19 15.418 15.418 19 11 19 C6.582 19 3 15.418 3 11 C3 6.582 6.582 3 11 3 Z"
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
            "line": {
              "id": "line",
              "path": {
                "d": "M21 21 L16.65 16.65"
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
            "line-2": {
              "id": "line-2",
              "path": {
                "d": "M8 11 L14 11"
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
            "d": "M11 3 C15.418 3 19 6.582 19 11 C19 15.418 15.418 19 11 19 C6.582 19 3 15.418 3 11 C3 6.582 6.582 3 11 3 Z"
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
        "line": {
          "id": "line",
          "path": {
            "d": "M21 21 L16.65 16.65"
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
        "line-2": {
          "id": "line-2",
          "path": {
            "d": "M8 11 L14 11"
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
                "d": "M11 3 C15.418 3 19 6.582 19 11 C19 15.418 15.418 19 11 19 C6.582 19 3 15.418 3 11 C3 6.582 6.582 3 11 3 Z"
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
            "line": {
              "id": "line",
              "path": {
                "d": "M21 21 L16.65 16.65"
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
            "line-2": {
              "id": "line-2",
              "path": {
                "d": "M8 11 L14 11"
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
      "sourceIconId": "zoom-out",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:58.014Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function ZoomOut({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: ZoomOutProps) {
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
