import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type ShapesProps = {
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
  "id": "shapes",
  "name": "shapes",
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
            "d": "M8.3 10 C8.03715 10.014346 7.788475 9.880014 7.656374 9.652319 C7.524272 9.424623 7.531083 9.142067 7.674 8.921 L11.4 3 C11.519086 2.785557 11.741729 2.649092 11.986861 2.640293 C12.231993 2.631495 12.463847 2.751647 12.598 2.957 L16.3 8.9 C16.448722 9.113583 16.466671 9.392043 16.346598 9.622951 C16.226526 9.853859 15.98826 9.999088 15.728 10 Z"
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
        "rect": {
          "id": "rect",
          "path": {
            "d": "M4 14 L9 14 C9.552285 14 10 14.447715 10 15 L10 20 C10 20.552285 9.552285 21 9 21 L4 21 C3.447715 21 3 20.552285 3 20 L3 15 C3 14.447715 3.447715 14 4 14 Z"
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
            "d": "M17.5 14 C19.433 14 21 15.567 21 17.5 C21 19.433 19.433 21 17.5 21 C15.567 21 14 19.433 14 17.5 C14 15.567 15.567 14 17.5 14 Z"
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
                "d": "M8.3 10 C8.03715 10.014346 7.788475 9.880014 7.656374 9.652319 C7.524272 9.424623 7.531083 9.142067 7.674 8.921 L11.4 3 C11.519086 2.785557 11.741729 2.649092 11.986861 2.640293 C12.231993 2.631495 12.463847 2.751647 12.598 2.957 L16.3 8.9 C16.448722 9.113583 16.466671 9.392043 16.346598 9.622951 C16.226526 9.853859 15.98826 9.999088 15.728 10 Z"
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
            "rect": {
              "id": "rect",
              "path": {
                "d": "M4 14 L9 14 C9.552285 14 10 14.447715 10 15 L10 20 C10 20.552285 9.552285 21 9 21 L4 21 C3.447715 21 3 20.552285 3 20 L3 15 C3 14.447715 3.447715 14 4 14 Z"
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
                "d": "M17.5 14 C19.433 14 21 15.567 21 17.5 C21 19.433 19.433 21 17.5 21 C15.567 21 14 19.433 14 17.5 C14 15.567 15.567 14 17.5 14 Z"
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
            "d": "M8.3 10 C8.03715 10.014346 7.788475 9.880014 7.656374 9.652319 C7.524272 9.424623 7.531083 9.142067 7.674 8.921 L11.4 3 C11.519086 2.785557 11.741729 2.649092 11.986861 2.640293 C12.231993 2.631495 12.463847 2.751647 12.598 2.957 L16.3 8.9 C16.448722 9.113583 16.466671 9.392043 16.346598 9.622951 C16.226526 9.853859 15.98826 9.999088 15.728 10 Z"
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
        "rect": {
          "id": "rect",
          "path": {
            "d": "M4 14 L9 14 C9.552285 14 10 14.447715 10 15 L10 20 C10 20.552285 9.552285 21 9 21 L4 21 C3.447715 21 3 20.552285 3 20 L3 15 C3 14.447715 3.447715 14 4 14 Z"
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
            "d": "M17.5 14 C19.433 14 21 15.567 21 17.5 C21 19.433 19.433 21 17.5 21 C15.567 21 14 19.433 14 17.5 C14 15.567 15.567 14 17.5 14 Z"
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
                "d": "M8.3 10 C8.03715 10.014346 7.788475 9.880014 7.656374 9.652319 C7.524272 9.424623 7.531083 9.142067 7.674 8.921 L11.4 3 C11.519086 2.785557 11.741729 2.649092 11.986861 2.640293 C12.231993 2.631495 12.463847 2.751647 12.598 2.957 L16.3 8.9 C16.448722 9.113583 16.466671 9.392043 16.346598 9.622951 C16.226526 9.853859 15.98826 9.999088 15.728 10 Z"
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
            "rect": {
              "id": "rect",
              "path": {
                "d": "M4 14 L9 14 C9.552285 14 10 14.447715 10 15 L10 20 C10 20.552285 9.552285 21 9 21 L4 21 C3.447715 21 3 20.552285 3 20 L3 15 C3 14.447715 3.447715 14 4 14 Z"
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
                "d": "M17.5 14 C19.433 14 21 15.567 21 17.5 C21 19.433 19.433 21 17.5 21 C15.567 21 14 19.433 14 17.5 C14 15.567 15.567 14 17.5 14 Z"
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
      "sourceIconId": "shapes",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.959Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Shapes({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: ShapesProps) {
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
