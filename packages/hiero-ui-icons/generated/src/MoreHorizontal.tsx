import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type MoreHorizontalProps = {
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
  "id": "more-horizontal",
  "name": "moreHorizontal",
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
        "circle": {
          "id": "circle",
          "path": {
            "d": "M12 11 C12.552 11 13 11.448 13 12 C13 12.552 12.552 13 12 13 C11.448 13 11 12.552 11 12 C11 11.448 11.448 11 12 11 Z"
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
        "circle-2": {
          "id": "circle-2",
          "path": {
            "d": "M19 11 C19.552 11 20 11.448 20 12 C20 12.552 19.552 13 19 13 C18.448 13 18 12.552 18 12 C18 11.448 18.448 11 19 11 Z"
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
        "circle-3": {
          "id": "circle-3",
          "path": {
            "d": "M5 11 C5.552 11 6 11.448 6 12 C6 12.552 5.552 13 5 13 C4.448 13 4 12.552 4 12 C4 11.448 4.448 11 5 11 Z"
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
            "circle": {
              "id": "circle",
              "path": {
                "d": "M12 11 C12.552 11 13 11.448 13 12 C13 12.552 12.552 13 12 13 C11.448 13 11 12.552 11 12 C11 11.448 11.448 11 12 11 Z"
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
            "circle-2": {
              "id": "circle-2",
              "path": {
                "d": "M19 11 C19.552 11 20 11.448 20 12 C20 12.552 19.552 13 19 13 C18.448 13 18 12.552 18 12 C18 11.448 18.448 11 19 11 Z"
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
            "circle-3": {
              "id": "circle-3",
              "path": {
                "d": "M5 11 C5.552 11 6 11.448 6 12 C6 12.552 5.552 13 5 13 C4.448 13 4 12.552 4 12 C4 11.448 4.448 11 5 11 Z"
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
        "circle": {
          "id": "circle",
          "path": {
            "d": "M12 11 C12.552 11 13 11.448 13 12 C13 12.552 12.552 13 12 13 C11.448 13 11 12.552 11 12 C11 11.448 11.448 11 12 11 Z"
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
        "circle-2": {
          "id": "circle-2",
          "path": {
            "d": "M19 11 C19.552 11 20 11.448 20 12 C20 12.552 19.552 13 19 13 C18.448 13 18 12.552 18 12 C18 11.448 18.448 11 19 11 Z"
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
        "circle-3": {
          "id": "circle-3",
          "path": {
            "d": "M5 11 C5.552 11 6 11.448 6 12 C6 12.552 5.552 13 5 13 C4.448 13 4 12.552 4 12 C4 11.448 4.448 11 5 11 Z"
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
            "circle": {
              "id": "circle",
              "path": {
                "d": "M12 11 C12.552 11 13 11.448 13 12 C13 12.552 12.552 13 12 13 C11.448 13 11 12.552 11 12 C11 11.448 11.448 11 12 11 Z"
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
            "circle-2": {
              "id": "circle-2",
              "path": {
                "d": "M19 11 C19.552 11 20 11.448 20 12 C20 12.552 19.552 13 19 13 C18.448 13 18 12.552 18 12 C18 11.448 18.448 11 19 11 Z"
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
            "circle-3": {
              "id": "circle-3",
              "path": {
                "d": "M5 11 C5.552 11 6 11.448 6 12 C6 12.552 5.552 13 5 13 C4.448 13 4 12.552 4 12 C4 11.448 4.448 11 5 11 Z"
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
      "sourceIconId": "more-horizontal",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.948Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function MoreHorizontal({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: MoreHorizontalProps) {
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
