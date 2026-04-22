import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type EyeProps = {
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
  "id": "eye",
  "name": "eye",
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
            "d": "M2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C3.722023 7.626908 7.646031 5.000616 12 5.000616 C16.353969 5.000616 20.277977 7.626908 21.938 11.652 C22.021341 11.876515 22.021341 12.123485 21.938 12.348 C20.277977 16.373092 16.353969 18.999384 12 18.999384 C7.646031 18.999384 3.722023 16.373092 2.062 12.348"
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
        "circle": {
          "id": "circle",
          "path": {
            "d": "M12 9 C13.657 9 15 10.343 15 12 C15 13.657 13.657 15 12 15 C10.343 15 9 13.657 9 12 C9 10.343 10.343 9 12 9 Z"
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
                "d": "M2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C3.722023 7.626908 7.646031 5.000616 12 5.000616 C16.353969 5.000616 20.277977 7.626908 21.938 11.652 C22.021341 11.876515 22.021341 12.123485 21.938 12.348 C20.277977 16.373092 16.353969 18.999384 12 18.999384 C7.646031 18.999384 3.722023 16.373092 2.062 12.348"
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
            "circle": {
              "id": "circle",
              "path": {
                "d": "M12 9 C13.657 9 15 10.343 15 12 C15 13.657 13.657 15 12 15 C10.343 15 9 13.657 9 12 C9 10.343 10.343 9 12 9 Z"
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
            "d": "M2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C3.722023 7.626908 7.646031 5.000616 12 5.000616 C16.353969 5.000616 20.277977 7.626908 21.938 11.652 C22.021341 11.876515 22.021341 12.123485 21.938 12.348 C20.277977 16.373092 16.353969 18.999384 12 18.999384 C7.646031 18.999384 3.722023 16.373092 2.062 12.348"
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
        "circle": {
          "id": "circle",
          "path": {
            "d": "M12 9 C13.657 9 15 10.343 15 12 C15 13.657 13.657 15 12 15 C10.343 15 9 13.657 9 12 C9 10.343 10.343 9 12 9 Z"
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
                "d": "M2.062 12.348 C1.978659 12.123485 1.978659 11.876515 2.062 11.652 C3.722023 7.626908 7.646031 5.000616 12 5.000616 C16.353969 5.000616 20.277977 7.626908 21.938 11.652 C22.021341 11.876515 22.021341 12.123485 21.938 12.348 C20.277977 16.373092 16.353969 18.999384 12 18.999384 C7.646031 18.999384 3.722023 16.373092 2.062 12.348"
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
            "circle": {
              "id": "circle",
              "path": {
                "d": "M12 9 C13.657 9 15 10.343 15 12 C15 13.657 13.657 15 12 15 C10.343 15 9 13.657 9 12 C9 10.343 10.343 9 12 9 Z"
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
      "sourceIconId": "eye",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.142Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Eye({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: EyeProps) {
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
