import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type VenetianMaskProps = {
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
  "id": "venetian-mask",
  "name": "venetianMask",
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
            "d": "M18 11 C16.5 11 15.5 11.5 15 13"
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
            "d": "M4 6 C2.895431 6 2 6.895431 2 8 L2 12 C2 14.761424 4.238576 17 7 17 C8.847711 17.068825 10.614537 17.775555 12 19 C13.385463 17.775555 15.152289 17.068825 17 17 C19.761424 17 22 14.761424 22 12 L22 8 C22 6.895431 21.104569 6 20 6 L17 6 C15.152289 6.068825 13.385463 6.775555 12 8 C10.614537 6.775555 8.847711 6.068825 7 6 Z"
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
            "d": "M6 11 C7.5 11 8.5 11.5 9 13"
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
                "d": "M18 11 C16.5 11 15.5 11.5 15 13"
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
                "d": "M4 6 C2.895431 6 2 6.895431 2 8 L2 12 C2 14.761424 4.238576 17 7 17 C8.847711 17.068825 10.614537 17.775555 12 19 C13.385463 17.775555 15.152289 17.068825 17 17 C19.761424 17 22 14.761424 22 12 L22 8 C22 6.895431 21.104569 6 20 6 L17 6 C15.152289 6.068825 13.385463 6.775555 12 8 C10.614537 6.775555 8.847711 6.068825 7 6 Z"
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
                "d": "M6 11 C7.5 11 8.5 11.5 9 13"
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
            "d": "M18 11 C16.5 11 15.5 11.5 15 13"
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
            "d": "M4 6 C2.895431 6 2 6.895431 2 8 L2 12 C2 14.761424 4.238576 17 7 17 C8.847711 17.068825 10.614537 17.775555 12 19 C13.385463 17.775555 15.152289 17.068825 17 17 C19.761424 17 22 14.761424 22 12 L22 8 C22 6.895431 21.104569 6 20 6 L17 6 C15.152289 6.068825 13.385463 6.775555 12 8 C10.614537 6.775555 8.847711 6.068825 7 6 Z"
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
            "d": "M6 11 C7.5 11 8.5 11.5 9 13"
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
                "d": "M18 11 C16.5 11 15.5 11.5 15 13"
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
                "d": "M4 6 C2.895431 6 2 6.895431 2 8 L2 12 C2 14.761424 4.238576 17 7 17 C8.847711 17.068825 10.614537 17.775555 12 19 C13.385463 17.775555 15.152289 17.068825 17 17 C19.761424 17 22 14.761424 22 12 L22 8 C22 6.895431 21.104569 6 20 6 L17 6 C15.152289 6.068825 13.385463 6.775555 12 8 C10.614537 6.775555 8.847711 6.068825 7 6 Z"
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
                "d": "M6 11 C7.5 11 8.5 11.5 9 13"
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
      "sourceIconId": "venetian-mask",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:58.012Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function VenetianMask({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: VenetianMaskProps) {
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
