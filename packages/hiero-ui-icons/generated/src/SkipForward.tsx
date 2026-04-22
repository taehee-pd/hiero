import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type SkipForwardProps = {
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
  "id": "skip-forward",
  "name": "skipForward",
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
            "d": "M21 4 L21 20"
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
            "d": "M6.029 4.285 C5.411136 3.914277 4.641619 3.904568 4.014598 4.259583 C3.387577 4.614598 2.999993 5.279451 3 6 L3 18 C2.999993 18.720549 3.387577 19.385402 4.014598 19.740417 C4.641619 20.095432 5.411136 20.085723 6.029 19.715 L16.026 13.717 C16.629687 13.356314 16.999587 12.705079 17.000201 12.00185 C17.000816 11.298621 16.632055 10.64674 16.029 10.285 Z"
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
                "d": "M21 4 L21 20"
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
                "d": "M6.029 4.285 C5.411136 3.914277 4.641619 3.904568 4.014598 4.259583 C3.387577 4.614598 2.999993 5.279451 3 6 L3 18 C2.999993 18.720549 3.387577 19.385402 4.014598 19.740417 C4.641619 20.095432 5.411136 20.085723 6.029 19.715 L16.026 13.717 C16.629687 13.356314 16.999587 12.705079 17.000201 12.00185 C17.000816 11.298621 16.632055 10.64674 16.029 10.285 Z"
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
            "d": "M21 4 L21 20"
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
            "d": "M6.029 4.285 C5.411136 3.914277 4.641619 3.904568 4.014598 4.259583 C3.387577 4.614598 2.999993 5.279451 3 6 L3 18 C2.999993 18.720549 3.387577 19.385402 4.014598 19.740417 C4.641619 20.095432 5.411136 20.085723 6.029 19.715 L16.026 13.717 C16.629687 13.356314 16.999587 12.705079 17.000201 12.00185 C17.000816 11.298621 16.632055 10.64674 16.029 10.285 Z"
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
                "d": "M21 4 L21 20"
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
                "d": "M6.029 4.285 C5.411136 3.914277 4.641619 3.904568 4.014598 4.259583 C3.387577 4.614598 2.999993 5.279451 3 6 L3 18 C2.999993 18.720549 3.387577 19.385402 4.014598 19.740417 C4.641619 20.095432 5.411136 20.085723 6.029 19.715 L16.026 13.717 C16.629687 13.356314 16.999587 12.705079 17.000201 12.00185 C17.000816 11.298621 16.632055 10.64674 16.029 10.285 Z"
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
      "sourceIconId": "skip-forward",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.917Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function SkipForward({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: SkipForwardProps) {
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
