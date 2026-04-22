import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type FileJsonProps = {
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
  "id": "file-json",
  "name": "fileJson",
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
            "d": "M6 22 C4.895431 22 4 21.104569 4 20 L4 4 C4 2.895431 4.895431 2 6 2 L14 2 C14.639365 1.998964 15.252715 2.253086 15.704 2.706 L19.292 6.294 C19.74614 6.745444 20.00104 7.359653 20 8 L20 20 C20 21.104569 19.104569 22 18 22 Z"
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
            "d": "M14 2 L14 7 C14 7.552285 14.447715 8 15 8 L20 8"
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
            "d": "M10 12 C9.447715 12 9 12.447715 9 13 L9 14 C9 14.552285 8.552285 15 8 15 C8.552285 15 9 15.447715 9 16 L9 17 C9 17.552285 9.447715 18 10 18"
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
            "d": "M14 18 C14.552285 18 15 17.552285 15 17 L15 16 C15 15.447715 15.447715 15 16 15 C15.447715 15 15 14.552285 15 14 L15 13 C15 12.447715 14.552285 12 14 12"
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
                "d": "M6 22 C4.895431 22 4 21.104569 4 20 L4 4 C4 2.895431 4.895431 2 6 2 L14 2 C14.639365 1.998964 15.252715 2.253086 15.704 2.706 L19.292 6.294 C19.74614 6.745444 20.00104 7.359653 20 8 L20 20 C20 21.104569 19.104569 22 18 22 Z"
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
                "d": "M14 2 L14 7 C14 7.552285 14.447715 8 15 8 L20 8"
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
                "d": "M10 12 C9.447715 12 9 12.447715 9 13 L9 14 C9 14.552285 8.552285 15 8 15 C8.552285 15 9 15.447715 9 16 L9 17 C9 17.552285 9.447715 18 10 18"
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
                "d": "M14 18 C14.552285 18 15 17.552285 15 17 L15 16 C15 15.447715 15.447715 15 16 15 C15.447715 15 15 14.552285 15 14 L15 13 C15 12.447715 14.552285 12 14 12"
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
            "d": "M6 22 C4.895431 22 4 21.104569 4 20 L4 4 C4 2.895431 4.895431 2 6 2 L14 2 C14.639365 1.998964 15.252715 2.253086 15.704 2.706 L19.292 6.294 C19.74614 6.745444 20.00104 7.359653 20 8 L20 20 C20 21.104569 19.104569 22 18 22 Z"
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
            "d": "M14 2 L14 7 C14 7.552285 14.447715 8 15 8 L20 8"
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
            "d": "M10 12 C9.447715 12 9 12.447715 9 13 L9 14 C9 14.552285 8.552285 15 8 15 C8.552285 15 9 15.447715 9 16 L9 17 C9 17.552285 9.447715 18 10 18"
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
            "d": "M14 18 C14.552285 18 15 17.552285 15 17 L15 16 C15 15.447715 15.447715 15 16 15 C15.447715 15 15 14.552285 15 14 L15 13 C15 12.447715 14.552285 12 14 12"
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
                "d": "M6 22 C4.895431 22 4 21.104569 4 20 L4 4 C4 2.895431 4.895431 2 6 2 L14 2 C14.639365 1.998964 15.252715 2.253086 15.704 2.706 L19.292 6.294 C19.74614 6.745444 20.00104 7.359653 20 8 L20 20 C20 21.104569 19.104569 22 18 22 Z"
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
                "d": "M14 2 L14 7 C14 7.552285 14.447715 8 15 8 L20 8"
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
                "d": "M10 12 C9.447715 12 9 12.447715 9 13 L9 14 C9 14.552285 8.552285 15 8 15 C8.552285 15 9 15.447715 9 16 L9 17 C9 17.552285 9.447715 18 10 18"
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
                "d": "M14 18 C14.552285 18 15 17.552285 15 17 L15 16 C15 15.447715 15.447715 15 16 15 C15.447715 15 15 14.552285 15 14 L15 13 C15 12.447715 14.552285 12 14 12"
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
      "sourceIconId": "file-json",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.169Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function FileJson({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: FileJsonProps) {
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
