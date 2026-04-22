import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type RefreshCwProps = {
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
  "id": "refresh-cw",
  "name": "refreshCw",
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
            "d": "M3 12 C3 7.029437 7.029437 3 12 3 C14.516048 3.009465 16.931031 3.991224 18.74 5.74 L21 8"
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
            "d": "M21 3 L21 8 L16 8"
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
            "d": "M21 12 C21 16.970563 16.970563 21 12 21 C9.483952 20.990535 7.068969 20.008776 5.26 18.26 L3 16"
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
            "d": "M8 16 L3 16 L3 21"
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
                "d": "M3 12 C3 7.029437 7.029437 3 12 3 C14.516048 3.009465 16.931031 3.991224 18.74 5.74 L21 8"
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
                "d": "M21 3 L21 8 L16 8"
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
                "d": "M21 12 C21 16.970563 16.970563 21 12 21 C9.483952 20.990535 7.068969 20.008776 5.26 18.26 L3 16"
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
                "d": "M8 16 L3 16 L3 21"
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
            "d": "M3 12 C3 7.029437 7.029437 3 12 3 C14.516048 3.009465 16.931031 3.991224 18.74 5.74 L21 8"
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
            "d": "M21 3 L21 8 L16 8"
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
            "d": "M21 12 C21 16.970563 16.970563 21 12 21 C9.483952 20.990535 7.068969 20.008776 5.26 18.26 L3 16"
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
            "d": "M8 16 L3 16 L3 21"
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
                "d": "M3 12 C3 7.029437 7.029437 3 12 3 C14.516048 3.009465 16.931031 3.991224 18.74 5.74 L21 8"
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
                "d": "M21 3 L21 8 L16 8"
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
                "d": "M21 12 C21 16.970563 16.970563 21 12 21 C9.483952 20.990535 7.068969 20.008776 5.26 18.26 L3 16"
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
                "d": "M8 16 L3 16 L3 21"
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
      "sourceIconId": "refresh-cw",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T04:21:06.174Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function RefreshCw({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: RefreshCwProps) {
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
