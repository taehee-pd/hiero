import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type AlignCenterHorizontalProps = {
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
  "id": "align-center-horizontal",
  "name": "alignCenterHorizontal",
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
            "d": "M2 12 L22 12"
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
            "d": "M10 16 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 16"
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
            "d": "M10 8 L10 4 C10 2.895431 9.104569 2 8 2 L6 2 C4.895431 2 4 2.895431 4 4 L4 8"
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
        "path-4": {
          "id": "path-4",
          "path": {
            "d": "M20 16 L20 17 C20 18.104569 19.104569 19 18 19 L16 19 C14.895431 19 14 18.104569 14 17 L14 16"
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
        "path-5": {
          "id": "path-5",
          "path": {
            "d": "M14 8 L14 7 C14 5.9 14.9 5 16 5 L18 5 C19.104569 5 20 5.895431 20 7 L20 8"
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
                "d": "M2 12 L22 12"
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
                "d": "M10 16 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 16"
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
                "d": "M10 8 L10 4 C10 2.895431 9.104569 2 8 2 L6 2 C4.895431 2 4 2.895431 4 4 L4 8"
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
            "path-4": {
              "id": "path-4",
              "path": {
                "d": "M20 16 L20 17 C20 18.104569 19.104569 19 18 19 L16 19 C14.895431 19 14 18.104569 14 17 L14 16"
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
            "path-5": {
              "id": "path-5",
              "path": {
                "d": "M14 8 L14 7 C14 5.9 14.9 5 16 5 L18 5 C19.104569 5 20 5.895431 20 7 L20 8"
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
            "d": "M2 12 L22 12"
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
            "d": "M10 16 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 16"
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
            "d": "M10 8 L10 4 C10 2.895431 9.104569 2 8 2 L6 2 C4.895431 2 4 2.895431 4 4 L4 8"
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
        "path-4": {
          "id": "path-4",
          "path": {
            "d": "M20 16 L20 17 C20 18.104569 19.104569 19 18 19 L16 19 C14.895431 19 14 18.104569 14 17 L14 16"
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
        "path-5": {
          "id": "path-5",
          "path": {
            "d": "M14 8 L14 7 C14 5.9 14.9 5 16 5 L18 5 C19.104569 5 20 5.895431 20 7 L20 8"
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
                "d": "M2 12 L22 12"
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
                "d": "M10 16 L10 20 C10 21.104569 9.104569 22 8 22 L6 22 C4.895431 22 4 21.104569 4 20 L4 16"
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
                "d": "M10 8 L10 4 C10 2.895431 9.104569 2 8 2 L6 2 C4.895431 2 4 2.895431 4 4 L4 8"
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
            "path-4": {
              "id": "path-4",
              "path": {
                "d": "M20 16 L20 17 C20 18.104569 19.104569 19 18 19 L16 19 C14.895431 19 14 18.104569 14 17 L14 16"
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
            "path-5": {
              "id": "path-5",
              "path": {
                "d": "M14 8 L14 7 C14 5.9 14.9 5 16 5 L18 5 C19.104569 5 20 5.895431 20 7 L20 8"
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
      "sourceIconId": "align-center-horizontal",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.969Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function AlignCenterHorizontal({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: AlignCenterHorizontalProps) {
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
