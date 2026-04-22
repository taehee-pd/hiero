import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type SaveProps = {
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
  "id": "save",
  "name": "save",
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
            "d": "M15.2 3 C15.727539 3.007514 16.230739 3.223171 16.6 3.6 L20.4 7.4 C20.776829 7.769261 20.992486 8.272461 21 8.8 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
            "d": "M17 21 L17 14 C17 13.447715 16.552285 13 16 13 L8 13 C7.447715 13 7 13.447715 7 14 L7 21"
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
            "d": "M7 3 L7 7 C7 7.552285 7.447715 8 8 8 L15 8"
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
                "d": "M15.2 3 C15.727539 3.007514 16.230739 3.223171 16.6 3.6 L20.4 7.4 C20.776829 7.769261 20.992486 8.272461 21 8.8 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
                "d": "M17 21 L17 14 C17 13.447715 16.552285 13 16 13 L8 13 C7.447715 13 7 13.447715 7 14 L7 21"
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
                "d": "M7 3 L7 7 C7 7.552285 7.447715 8 8 8 L15 8"
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
            "d": "M15.2 3 C15.727539 3.007514 16.230739 3.223171 16.6 3.6 L20.4 7.4 C20.776829 7.769261 20.992486 8.272461 21 8.8 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
            "d": "M17 21 L17 14 C17 13.447715 16.552285 13 16 13 L8 13 C7.447715 13 7 13.447715 7 14 L7 21"
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
            "d": "M7 3 L7 7 C7 7.552285 7.447715 8 8 8 L15 8"
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
                "d": "M15.2 3 C15.727539 3.007514 16.230739 3.223171 16.6 3.6 L20.4 7.4 C20.776829 7.769261 20.992486 8.272461 21 8.8 L21 19 C21 20.104569 20.104569 21 19 21 L5 21 C3.895431 21 3 20.104569 3 19 L3 5 C3 3.895431 3.895431 3 5 3 Z"
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
                "d": "M17 21 L17 14 C17 13.447715 16.552285 13 16 13 L8 13 C7.447715 13 7 13.447715 7 14 L7 21"
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
                "d": "M7 3 L7 7 C7 7.552285 7.447715 8 8 8 L15 8"
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
      "sourceIconId": "save",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.172Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function Save({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: SaveProps) {
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
