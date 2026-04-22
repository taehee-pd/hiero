import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type ServerProps = {
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
  "id": "server",
  "name": "server",
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
            "d": "M4 2 L20 2 C21.104569 2 22 2.895431 22 4 L22 8 C22 9.104569 21.104569 10 20 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 4 C2 2.895431 2.895431 2 4 2 Z"
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
            "d": "M4 14 L20 14 C21.104569 14 22 14.895431 22 16 L22 20 C22 21.104569 21.104569 22 20 22 L4 22 C2.895431 22 2 21.104569 2 20 L2 16 C2 14.895431 2.895431 14 4 14 Z"
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
            "d": "M6 6 L6.01 6"
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
            "d": "M6 18 L6.01 18"
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
                "d": "M4 2 L20 2 C21.104569 2 22 2.895431 22 4 L22 8 C22 9.104569 21.104569 10 20 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 4 C2 2.895431 2.895431 2 4 2 Z"
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
                "d": "M4 14 L20 14 C21.104569 14 22 14.895431 22 16 L22 20 C22 21.104569 21.104569 22 20 22 L4 22 C2.895431 22 2 21.104569 2 20 L2 16 C2 14.895431 2.895431 14 4 14 Z"
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
                "d": "M6 6 L6.01 6"
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
                "d": "M6 18 L6.01 18"
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
            "d": "M4 2 L20 2 C21.104569 2 22 2.895431 22 4 L22 8 C22 9.104569 21.104569 10 20 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 4 C2 2.895431 2.895431 2 4 2 Z"
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
            "d": "M4 14 L20 14 C21.104569 14 22 14.895431 22 16 L22 20 C22 21.104569 21.104569 22 20 22 L4 22 C2.895431 22 2 21.104569 2 20 L2 16 C2 14.895431 2.895431 14 4 14 Z"
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
            "d": "M6 6 L6.01 6"
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
            "d": "M6 18 L6.01 18"
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
                "d": "M4 2 L20 2 C21.104569 2 22 2.895431 22 4 L22 8 C22 9.104569 21.104569 10 20 10 L4 10 C2.895431 10 2 9.104569 2 8 L2 4 C2 2.895431 2.895431 2 4 2 Z"
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
                "d": "M4 14 L20 14 C21.104569 14 22 14.895431 22 16 L22 20 C22 21.104569 21.104569 22 20 22 L4 22 C2.895431 22 2 21.104569 2 20 L2 16 C2 14.895431 2.895431 14 4 14 Z"
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
                "d": "M6 6 L6.01 6"
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
                "d": "M6 18 L6.01 18"
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
      "sourceVersion": "1.8.0",
      "sourceIconId": "server",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.203Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Server({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: ServerProps) {
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
