import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PencilProps = {
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
  "id": "pencil",
  "name": "pencil",
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
            "d": "M21.174 6.812 C22.27498 5.711296 22.275203 3.92648 21.1745 2.8255 C20.073796 1.72452 18.28898 1.724297 17.188 2.825 L3.842 16.174 C3.609819 16.4055 3.438114 16.690532 3.342 17.004 L2.021 21.356 C1.968345 21.532195 2.016659 21.723074 2.146796 21.853002 C2.276934 21.982931 2.46789 22.030938 2.644 21.978 L6.997 20.658 C7.310169 20.562751 7.595173 20.392092 7.827 20.161 Z"
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
            "d": "M15 5 L19 9"
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
                "d": "M21.174 6.812 C22.27498 5.711296 22.275203 3.92648 21.1745 2.8255 C20.073796 1.72452 18.28898 1.724297 17.188 2.825 L3.842 16.174 C3.609819 16.4055 3.438114 16.690532 3.342 17.004 L2.021 21.356 C1.968345 21.532195 2.016659 21.723074 2.146796 21.853002 C2.276934 21.982931 2.46789 22.030938 2.644 21.978 L6.997 20.658 C7.310169 20.562751 7.595173 20.392092 7.827 20.161 Z"
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
                "d": "M15 5 L19 9"
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
            "d": "M21.174 6.812 C22.27498 5.711296 22.275203 3.92648 21.1745 2.8255 C20.073796 1.72452 18.28898 1.724297 17.188 2.825 L3.842 16.174 C3.609819 16.4055 3.438114 16.690532 3.342 17.004 L2.021 21.356 C1.968345 21.532195 2.016659 21.723074 2.146796 21.853002 C2.276934 21.982931 2.46789 22.030938 2.644 21.978 L6.997 20.658 C7.310169 20.562751 7.595173 20.392092 7.827 20.161 Z"
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
            "d": "M15 5 L19 9"
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
                "d": "M21.174 6.812 C22.27498 5.711296 22.275203 3.92648 21.1745 2.8255 C20.073796 1.72452 18.28898 1.724297 17.188 2.825 L3.842 16.174 C3.609819 16.4055 3.438114 16.690532 3.342 17.004 L2.021 21.356 C1.968345 21.532195 2.016659 21.723074 2.146796 21.853002 C2.276934 21.982931 2.46789 22.030938 2.644 21.978 L6.997 20.658 C7.310169 20.562751 7.595173 20.392092 7.827 20.161 Z"
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
                "d": "M15 5 L19 9"
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
      "sourceIconId": "pencil",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.137Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Pencil({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PencilProps) {
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
