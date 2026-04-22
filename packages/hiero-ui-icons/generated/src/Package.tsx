import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PackageProps = {
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
  "id": "package",
  "name": "package",
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
            "d": "M11 21.73 C11.618802 22.087266 12.381198 22.087266 13 21.73 L20 17.73 C20.618168 17.373101 20.999268 16.713798 21 16 L21 8 C20.999268 7.286202 20.618168 6.626899 20 6.27 L13 2.27 C12.381198 1.912734 11.618802 1.912734 11 2.27 L4 6.27 C3.381832 6.626899 3.000732 7.286202 3 8 L3 16 C3.000732 16.713798 3.381832 17.373101 4 17.73 Z"
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
            "d": "M12 22 L12 12"
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
        "polyline": {
          "id": "polyline",
          "path": {
            "d": "M3.29 7 L12 12 L20.71 7"
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
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M7.5 4.27 L16.5 9.42"
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
                "d": "M11 21.73 C11.618802 22.087266 12.381198 22.087266 13 21.73 L20 17.73 C20.618168 17.373101 20.999268 16.713798 21 16 L21 8 C20.999268 7.286202 20.618168 6.626899 20 6.27 L13 2.27 C12.381198 1.912734 11.618802 1.912734 11 2.27 L4 6.27 C3.381832 6.626899 3.000732 7.286202 3 8 L3 16 C3.000732 16.713798 3.381832 17.373101 4 17.73 Z"
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
                "d": "M12 22 L12 12"
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
            "polyline": {
              "id": "polyline",
              "path": {
                "d": "M3.29 7 L12 12 L20.71 7"
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
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M7.5 4.27 L16.5 9.42"
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
            "d": "M11 21.73 C11.618802 22.087266 12.381198 22.087266 13 21.73 L20 17.73 C20.618168 17.373101 20.999268 16.713798 21 16 L21 8 C20.999268 7.286202 20.618168 6.626899 20 6.27 L13 2.27 C12.381198 1.912734 11.618802 1.912734 11 2.27 L4 6.27 C3.381832 6.626899 3.000732 7.286202 3 8 L3 16 C3.000732 16.713798 3.381832 17.373101 4 17.73 Z"
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
            "d": "M12 22 L12 12"
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
        "polyline": {
          "id": "polyline",
          "path": {
            "d": "M3.29 7 L12 12 L20.71 7"
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
        "path-3": {
          "id": "path-3",
          "path": {
            "d": "M7.5 4.27 L16.5 9.42"
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
                "d": "M11 21.73 C11.618802 22.087266 12.381198 22.087266 13 21.73 L20 17.73 C20.618168 17.373101 20.999268 16.713798 21 16 L21 8 C20.999268 7.286202 20.618168 6.626899 20 6.27 L13 2.27 C12.381198 1.912734 11.618802 1.912734 11 2.27 L4 6.27 C3.381832 6.626899 3.000732 7.286202 3 8 L3 16 C3.000732 16.713798 3.381832 17.373101 4 17.73 Z"
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
                "d": "M12 22 L12 12"
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
            "polyline": {
              "id": "polyline",
              "path": {
                "d": "M3.29 7 L12 12 L20.71 7"
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
            "path-3": {
              "id": "path-3",
              "path": {
                "d": "M7.5 4.27 L16.5 9.42"
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
      "sourceIconId": "package",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.963Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Package({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PackageProps) {
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
