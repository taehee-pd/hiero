import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type LayoutGridProps = {
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
  "id": "layout-grid",
  "name": "layoutGrid",
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
        "rect": {
          "id": "rect",
          "path": {
            "d": "M4 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 9 C10 9.552285 9.552285 10 9 10 L4 10 C3.447715 10 3 9.552285 3 9 L3 4 C3 3.447715 3.447715 3 4 3 Z"
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
        "rect-2": {
          "id": "rect-2",
          "path": {
            "d": "M15 3 L20 3 C20.552285 3 21 3.447715 21 4 L21 9 C21 9.552285 20.552285 10 20 10 L15 10 C14.447715 10 14 9.552285 14 9 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
        "rect-3": {
          "id": "rect-3",
          "path": {
            "d": "M15 14 L20 14 C20.552285 14 21 14.447715 21 15 L21 20 C21 20.552285 20.552285 21 20 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 15 C14 14.447715 14.447715 14 15 14 Z"
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
        "rect-4": {
          "id": "rect-4",
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
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "rect": {
              "id": "rect",
              "path": {
                "d": "M4 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 9 C10 9.552285 9.552285 10 9 10 L4 10 C3.447715 10 3 9.552285 3 9 L3 4 C3 3.447715 3.447715 3 4 3 Z"
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
            "rect-2": {
              "id": "rect-2",
              "path": {
                "d": "M15 3 L20 3 C20.552285 3 21 3.447715 21 4 L21 9 C21 9.552285 20.552285 10 20 10 L15 10 C14.447715 10 14 9.552285 14 9 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
            "rect-3": {
              "id": "rect-3",
              "path": {
                "d": "M15 14 L20 14 C20.552285 14 21 14.447715 21 15 L21 20 C21 20.552285 20.552285 21 20 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 15 C14 14.447715 14.447715 14 15 14 Z"
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
            "rect-4": {
              "id": "rect-4",
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
        "rect": {
          "id": "rect",
          "path": {
            "d": "M4 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 9 C10 9.552285 9.552285 10 9 10 L4 10 C3.447715 10 3 9.552285 3 9 L3 4 C3 3.447715 3.447715 3 4 3 Z"
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
        "rect-2": {
          "id": "rect-2",
          "path": {
            "d": "M15 3 L20 3 C20.552285 3 21 3.447715 21 4 L21 9 C21 9.552285 20.552285 10 20 10 L15 10 C14.447715 10 14 9.552285 14 9 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
        "rect-3": {
          "id": "rect-3",
          "path": {
            "d": "M15 14 L20 14 C20.552285 14 21 14.447715 21 15 L21 20 C21 20.552285 20.552285 21 20 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 15 C14 14.447715 14.447715 14 15 14 Z"
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
        "rect-4": {
          "id": "rect-4",
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
        }
      },
      "defaultType": "default",
      "types": {
        "default": {
          "id": "default",
          "layers": {
            "rect": {
              "id": "rect",
              "path": {
                "d": "M4 3 L9 3 C9.552285 3 10 3.447715 10 4 L10 9 C10 9.552285 9.552285 10 9 10 L4 10 C3.447715 10 3 9.552285 3 9 L3 4 C3 3.447715 3.447715 3 4 3 Z"
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
            "rect-2": {
              "id": "rect-2",
              "path": {
                "d": "M15 3 L20 3 C20.552285 3 21 3.447715 21 4 L21 9 C21 9.552285 20.552285 10 20 10 L15 10 C14.447715 10 14 9.552285 14 9 L14 4 C14 3.447715 14.447715 3 15 3 Z"
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
            "rect-3": {
              "id": "rect-3",
              "path": {
                "d": "M15 14 L20 14 C20.552285 14 21 14.447715 21 15 L21 20 C21 20.552285 20.552285 21 20 21 L15 21 C14.447715 21 14 20.552285 14 20 L14 15 C14 14.447715 14.447715 14 15 14 Z"
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
            "rect-4": {
              "id": "rect-4",
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
      "sourceIconId": "layout-grid",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.995Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function LayoutGrid({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: LayoutGridProps) {
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
