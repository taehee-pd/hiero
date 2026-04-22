import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlertTriangleProps = {
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
  "id": "alert-triangle",
  "name": "alertTriangle",
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
        "path": {
          "id": "path",
          "path": {
            "d": "M21.73 18 L13.73 4 C13.374878 3.373379 12.710254 2.986103 11.99 2.986103 C11.269746 2.986103 10.605122 3.373379 10.25 4 L2.25 18 C1.891089 18.621585 1.892786 19.387834 2.254446 20.007823 C2.616107 20.627812 3.282265 21.006458 4 21 L20 21 C20.714165 20.999268 21.373748 20.617781 21.730513 19.999113 C22.087279 19.380444 22.087083 18.618485 21.73 18"
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
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M12 9 L12 13"
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
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M12 17 L12.01 17"
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
            "path": {
              "id": "path",
              "path": {
                "d": "M21.73 18 L13.73 4 C13.374878 3.373379 12.710254 2.986103 11.99 2.986103 C11.269746 2.986103 10.605122 3.373379 10.25 4 L2.25 18 C1.891089 18.621585 1.892786 19.387834 2.254446 20.007823 C2.616107 20.627812 3.282265 21.006458 4 21 L20 21 C20.714165 20.999268 21.373748 20.617781 21.730513 19.999113 C22.087279 19.380444 22.087083 18.618485 21.73 18"
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
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M12 9 L12 13"
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
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M12 17 L12.01 17"
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
        "path": {
          "id": "path",
          "path": {
            "d": "M21.73 18 L13.73 4 C13.374878 3.373379 12.710254 2.986103 11.99 2.986103 C11.269746 2.986103 10.605122 3.373379 10.25 4 L2.25 18 C1.891089 18.621585 1.892786 19.387834 2.254446 20.007823 C2.616107 20.627812 3.282265 21.006458 4 21 L20 21 C20.714165 20.999268 21.373748 20.617781 21.730513 19.999113 C22.087279 19.380444 22.087083 18.618485 21.73 18"
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
        "path-2": {
          "id": "path-2",
          "path": {
            "d": "M12 9 L12 13"
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
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M12 17 L12.01 17"
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
            "path": {
              "id": "path",
              "path": {
                "d": "M21.73 18 L13.73 4 C13.374878 3.373379 12.710254 2.986103 11.99 2.986103 C11.269746 2.986103 10.605122 3.373379 10.25 4 L2.25 18 C1.891089 18.621585 1.892786 19.387834 2.254446 20.007823 C2.616107 20.627812 3.282265 21.006458 4 21 L20 21 C20.714165 20.999268 21.373748 20.617781 21.730513 19.999113 C22.087279 19.380444 22.087083 18.618485 21.73 18"
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
            "path-2": {
              "id": "path-2",
              "path": {
                "d": "M12 9 L12 13"
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
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M12 17 L12.01 17"
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
      "sourceIconId": "alert-triangle",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.183Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlertTriangle({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlertTriangleProps) {
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
