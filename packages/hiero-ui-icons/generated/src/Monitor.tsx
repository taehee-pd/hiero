import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type MonitorProps = {
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
  "id": "monitor",
  "name": "monitor",
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
            "d": "M4 3 L20 3 C21.104569 3 22 3.895431 22 5 L22 15 C22 16.104569 21.104569 17 20 17 L4 17 C2.895431 17 2 16.104569 2 15 L2 5 C2 3.895431 2.895431 3 4 3 Z"
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
            "d": "M8 21 L16 21"
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
            "d": "M12 17 L12 21"
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
                "d": "M4 3 L20 3 C21.104569 3 22 3.895431 22 5 L22 15 C22 16.104569 21.104569 17 20 17 L4 17 C2.895431 17 2 16.104569 2 15 L2 5 C2 3.895431 2.895431 3 4 3 Z"
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
                "d": "M8 21 L16 21"
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
                "d": "M12 17 L12 21"
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
            "d": "M4 3 L20 3 C21.104569 3 22 3.895431 22 5 L22 15 C22 16.104569 21.104569 17 20 17 L4 17 C2.895431 17 2 16.104569 2 15 L2 5 C2 3.895431 2.895431 3 4 3 Z"
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
            "d": "M8 21 L16 21"
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
            "d": "M12 17 L12 21"
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
                "d": "M4 3 L20 3 C21.104569 3 22 3.895431 22 5 L22 15 C22 16.104569 21.104569 17 20 17 L4 17 C2.895431 17 2 16.104569 2 15 L2 5 C2 3.895431 2.895431 3 4 3 Z"
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
                "d": "M8 21 L16 21"
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
                "d": "M12 17 L12 21"
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
      "sourceIconId": "monitor",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.999Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Monitor({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: MonitorProps) {
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
