import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type FolderInputProps = {
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
  "id": "folder-input",
  "name": "folderInput",
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
            "d": "M2 9 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L20 6 C21.104569 6 22 6.895431 22 8 L22 18 C22 19.104569 21.104569 20 20 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 17"
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
            "d": "M2 13 L12 13"
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
            "d": "M9 16 L12 13 L9 10"
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
                "d": "M2 9 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L20 6 C21.104569 6 22 6.895431 22 8 L22 18 C22 19.104569 21.104569 20 20 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 17"
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
                "d": "M2 13 L12 13"
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
                "d": "M9 16 L12 13 L9 10"
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
            "d": "M2 9 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L20 6 C21.104569 6 22 6.895431 22 8 L22 18 C22 19.104569 21.104569 20 20 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 17"
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
            "d": "M2 13 L12 13"
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
            "d": "M9 16 L12 13 L9 10"
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
                "d": "M2 9 L2 5 C2 3.895431 2.895431 3 4 3 L7.9 3 C8.579667 2.993336 9.216198 3.332317 9.59 3.9 L10.4 5.1 C10.769922 5.66172 11.397414 5.999889 12.07 6 L20 6 C21.104569 6 22 6.895431 22 8 L22 18 C22 19.104569 21.104569 20 20 20 L4 20 C2.895431 20 2 19.104569 2 18 L2 17"
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
                "d": "M2 13 L12 13"
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
                "d": "M9 16 L12 13 L9 10"
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
      "sourceIconId": "folder-input",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:57.923Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function FolderInput({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: FolderInputProps) {
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
