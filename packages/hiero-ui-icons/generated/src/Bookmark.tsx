import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type BookmarkProps = {
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
  "id": "bookmark",
  "name": "bookmark",
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
            "d": "M17 3 C18.104569 3 19 3.895431 19 5 L19 20 C18.999885 20.356384 18.810111 20.685775 18.501857 20.864628 C18.193602 21.043482 17.813456 21.044767 17.504 20.868 L12.992 18.29 C12.377277 17.93886 11.622723 17.93886 11.008 18.29 L6.496 20.868 C6.186544 21.044767 5.806398 21.043482 5.498143 20.864628 C5.189889 20.685775 5.000115 20.356384 5 20 L5 5 C5 3.895431 5.895431 3 7 3 Z"
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
                "d": "M17 3 C18.104569 3 19 3.895431 19 5 L19 20 C18.999885 20.356384 18.810111 20.685775 18.501857 20.864628 C18.193602 21.043482 17.813456 21.044767 17.504 20.868 L12.992 18.29 C12.377277 17.93886 11.622723 17.93886 11.008 18.29 L6.496 20.868 C6.186544 21.044767 5.806398 21.043482 5.498143 20.864628 C5.189889 20.685775 5.000115 20.356384 5 20 L5 5 C5 3.895431 5.895431 3 7 3 Z"
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
            "d": "M17 3 C18.104569 3 19 3.895431 19 5 L19 20 C18.999885 20.356384 18.810111 20.685775 18.501857 20.864628 C18.193602 21.043482 17.813456 21.044767 17.504 20.868 L12.992 18.29 C12.377277 17.93886 11.622723 17.93886 11.008 18.29 L6.496 20.868 C6.186544 21.044767 5.806398 21.043482 5.498143 20.864628 C5.189889 20.685775 5.000115 20.356384 5 20 L5 5 C5 3.895431 5.895431 3 7 3 Z"
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
                "d": "M17 3 C18.104569 3 19 3.895431 19 5 L19 20 C18.999885 20.356384 18.810111 20.685775 18.501857 20.864628 C18.193602 21.043482 17.813456 21.044767 17.504 20.868 L12.992 18.29 C12.377277 17.93886 11.622723 17.93886 11.008 18.29 L6.496 20.868 C6.186544 21.044767 5.806398 21.043482 5.498143 20.864628 C5.189889 20.685775 5.000115 20.356384 5 20 L5 5 C5 3.895431 5.895431 3 7 3 Z"
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
      "sourceIconId": "bookmark",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.986Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Bookmark({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: BookmarkProps) {
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
