import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type HeartProps = {
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
  "id": "heart",
  "name": "heart",
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
            "d": "M2 9.5 C2.000042 7.221946 3.404444 5.17969 5.531609 4.364399 C7.658774 3.549108 10.06839 4.129542 11.591 5.824 C11.696891 5.937222 11.844977 6.001483 12 6.001483 C12.155023 6.001483 12.303109 5.937222 12.409 5.824 C13.927118 4.118204 16.342614 3.530239 18.474875 4.347483 C20.607135 5.164728 22.010878 7.216515 22 9.5 C22 11.79 20.5 13.5 19 15 L13.508 20.313 C13.131067 20.745917 12.586294 20.99601 12.012289 20.999645 C11.438283 21.00328 10.890386 20.760108 10.508 20.332 L5 15 C3.5 13.5 2 11.8 2 9.5"
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
                "d": "M2 9.5 C2.000042 7.221946 3.404444 5.17969 5.531609 4.364399 C7.658774 3.549108 10.06839 4.129542 11.591 5.824 C11.696891 5.937222 11.844977 6.001483 12 6.001483 C12.155023 6.001483 12.303109 5.937222 12.409 5.824 C13.927118 4.118204 16.342614 3.530239 18.474875 4.347483 C20.607135 5.164728 22.010878 7.216515 22 9.5 C22 11.79 20.5 13.5 19 15 L13.508 20.313 C13.131067 20.745917 12.586294 20.99601 12.012289 20.999645 C11.438283 21.00328 10.890386 20.760108 10.508 20.332 L5 15 C3.5 13.5 2 11.8 2 9.5"
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
            "d": "M2 9.5 C2.000042 7.221946 3.404444 5.17969 5.531609 4.364399 C7.658774 3.549108 10.06839 4.129542 11.591 5.824 C11.696891 5.937222 11.844977 6.001483 12 6.001483 C12.155023 6.001483 12.303109 5.937222 12.409 5.824 C13.927118 4.118204 16.342614 3.530239 18.474875 4.347483 C20.607135 5.164728 22.010878 7.216515 22 9.5 C22 11.79 20.5 13.5 19 15 L13.508 20.313 C13.131067 20.745917 12.586294 20.99601 12.012289 20.999645 C11.438283 21.00328 10.890386 20.760108 10.508 20.332 L5 15 C3.5 13.5 2 11.8 2 9.5"
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
                "d": "M2 9.5 C2.000042 7.221946 3.404444 5.17969 5.531609 4.364399 C7.658774 3.549108 10.06839 4.129542 11.591 5.824 C11.696891 5.937222 11.844977 6.001483 12 6.001483 C12.155023 6.001483 12.303109 5.937222 12.409 5.824 C13.927118 4.118204 16.342614 3.530239 18.474875 4.347483 C20.607135 5.164728 22.010878 7.216515 22 9.5 C22 11.79 20.5 13.5 19 15 L13.508 20.313 C13.131067 20.745917 12.586294 20.99601 12.012289 20.999645 C11.438283 21.00328 10.890386 20.760108 10.508 20.332 L5 15 C3.5 13.5 2 11.8 2 9.5"
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
      "sourceIconId": "heart",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.185Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Heart({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: HeartProps) {
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
