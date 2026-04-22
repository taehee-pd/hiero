import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type GitBranchProps = {
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
  "id": "git-branch",
  "name": "gitBranch",
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
            "d": "M15 6 C10.029437 6 6 10.029437 6 15 L6 3"
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
            "d": "M18 3 C19.657 3 21 4.343 21 6 C21 7.657 19.657 9 18 9 C16.343 9 15 7.657 15 6 C15 4.343 16.343 3 18 3 Z"
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
            "d": "M6 15 C7.657 15 9 16.343 9 18 C9 19.657 7.657 21 6 21 C4.343 21 3 19.657 3 18 C3 16.343 4.343 15 6 15 Z"
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
                "d": "M15 6 C10.029437 6 6 10.029437 6 15 L6 3"
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
                "d": "M18 3 C19.657 3 21 4.343 21 6 C21 7.657 19.657 9 18 9 C16.343 9 15 7.657 15 6 C15 4.343 16.343 3 18 3 Z"
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
                "d": "M6 15 C7.657 15 9 16.343 9 18 C9 19.657 7.657 21 6 21 C4.343 21 3 19.657 3 18 C3 16.343 4.343 15 6 15 Z"
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
            "d": "M15 6 C10.029437 6 6 10.029437 6 15 L6 3"
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
            "d": "M18 3 C19.657 3 21 4.343 21 6 C21 7.657 19.657 9 18 9 C16.343 9 15 7.657 15 6 C15 4.343 16.343 3 18 3 Z"
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
            "d": "M6 15 C7.657 15 9 16.343 9 18 C9 19.657 7.657 21 6 21 C4.343 21 3 19.657 3 18 C3 16.343 4.343 15 6 15 Z"
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
                "d": "M15 6 C10.029437 6 6 10.029437 6 15 L6 3"
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
                "d": "M18 3 C19.657 3 21 4.343 21 6 C21 7.657 19.657 9 18 9 C16.343 9 15 7.657 15 6 C15 4.343 16.343 3 18 3 Z"
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
                "d": "M6 15 C7.657 15 9 16.343 9 18 C9 19.657 7.657 21 6 21 C4.343 21 3 19.657 3 18 C3 16.343 4.343 15 6 15 Z"
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
      "sourceIconId": "git-branch",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.204Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function GitBranch({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: GitBranchProps) {
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
