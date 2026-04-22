import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type Loader2Props = {
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
  "id": "loader-2",
  "name": "loader2",
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
            "d": "M21 12 C20.999809 15.898981 18.489066 19.354425 14.780876 20.559157 C11.072686 21.763888 7.010479 20.44389 4.718765 17.289512 C2.42705 14.135134 2.427081 9.863844 4.718841 6.709499 C7.010601 3.555155 11.072827 2.235215 14.781 3.44"
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
                "d": "M21 12 C20.999809 15.898981 18.489066 19.354425 14.780876 20.559157 C11.072686 21.763888 7.010479 20.44389 4.718765 17.289512 C2.42705 14.135134 2.427081 9.863844 4.718841 6.709499 C7.010601 3.555155 11.072827 2.235215 14.781 3.44"
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
            "d": "M21 12 C20.999809 15.898981 18.489066 19.354425 14.780876 20.559157 C11.072686 21.763888 7.010479 20.44389 4.718765 17.289512 C2.42705 14.135134 2.427081 9.863844 4.718841 6.709499 C7.010601 3.555155 11.072827 2.235215 14.781 3.44"
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
                "d": "M21 12 C20.999809 15.898981 18.489066 19.354425 14.780876 20.559157 C11.072686 21.763888 7.010479 20.44389 4.718765 17.289512 C2.42705 14.135134 2.427081 9.863844 4.718841 6.709499 C7.010601 3.555155 11.072827 2.235215 14.781 3.44"
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
      "sourceIconId": "loader-2",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.179Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Loader2({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: Loader2Props) {
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
