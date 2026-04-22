import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type SkipBackProps = {
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
  "id": "skip-back",
  "name": "skipBack",
  "tags": [
    "rtl-mirror"
  ],
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
            "d": "M17.971 4.285 C18.588864 3.914277 19.358381 3.904568 19.985402 4.259583 C20.612423 4.614598 21.000007 5.279451 21 6 L21 18 C21.000007 18.720549 20.612423 19.385402 19.985402 19.740417 C19.358381 20.095432 18.588864 20.085723 17.971 19.715 L7.974 13.717 C7.370313 13.356314 7.000413 12.705079 6.999799 12.00185 C6.999184 11.298621 7.367945 10.64674 7.971 10.285 Z"
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
            "d": "M3 20 L3 4"
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
                "d": "M17.971 4.285 C18.588864 3.914277 19.358381 3.904568 19.985402 4.259583 C20.612423 4.614598 21.000007 5.279451 21 6 L21 18 C21.000007 18.720549 20.612423 19.385402 19.985402 19.740417 C19.358381 20.095432 18.588864 20.085723 17.971 19.715 L7.974 13.717 C7.370313 13.356314 7.000413 12.705079 6.999799 12.00185 C6.999184 11.298621 7.367945 10.64674 7.971 10.285 Z"
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
                "d": "M3 20 L3 4"
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
            "d": "M17.971 4.285 C18.588864 3.914277 19.358381 3.904568 19.985402 4.259583 C20.612423 4.614598 21.000007 5.279451 21 6 L21 18 C21.000007 18.720549 20.612423 19.385402 19.985402 19.740417 C19.358381 20.095432 18.588864 20.085723 17.971 19.715 L7.974 13.717 C7.370313 13.356314 7.000413 12.705079 6.999799 12.00185 C6.999184 11.298621 7.367945 10.64674 7.971 10.285 Z"
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
            "d": "M3 20 L3 4"
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
                "d": "M17.971 4.285 C18.588864 3.914277 19.358381 3.904568 19.985402 4.259583 C20.612423 4.614598 21.000007 5.279451 21 6 L21 18 C21.000007 18.720549 20.612423 19.385402 19.985402 19.740417 C19.358381 20.095432 18.588864 20.085723 17.971 19.715 L7.974 13.717 C7.370313 13.356314 7.000413 12.705079 6.999799 12.00185 C6.999184 11.298621 7.367945 10.64674 7.971 10.285 Z"
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
                "d": "M3 20 L3 4"
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
      "sourceIconId": "skip-back",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.162Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function SkipBack({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: SkipBackProps) {
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
