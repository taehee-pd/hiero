import React from 'react';
import type { CSSProperties } from 'react';
import { HieroIcon } from '@/lib/runtime-react';
import type { Icon } from '@/lib/schema/types';

export type PenToolProps = {
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
  "id": "pen-tool",
  "name": "penTool",
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
            "d": "M15.707 21.293 C15.3165 21.683382 14.6835 21.683382 14.293 21.293 L12.707 19.707 C12.316618 19.3165 12.316618 18.6835 12.707 18.293 L18.293 12.707 C18.6835 12.316618 19.3165 12.316618 19.707 12.707 L21.293 14.293 C21.683382 14.6835 21.683382 15.3165 21.293 15.707 Z"
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
            "d": "M18 13 L16.625 6.126 C16.548637 5.744146 16.257548 5.441351 15.879 5.35 L3.235 2.028 C2.89626 1.9461 2.539314 2.04646 2.292887 2.292887 C2.04646 2.539314 1.9461 2.89626 2.028 3.235 L5.35 15.879 C5.441351 16.257548 5.744146 16.548637 6.126 16.625 L13 18"
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
            "d": "M2.3 2.3 L9.586 9.586"
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
            "d": "M11 9 C12.105 9 13 9.895 13 11 C13 12.105 12.105 13 11 13 C9.895 13 9 12.105 9 11 C9 9.895 9.895 9 11 9 Z"
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
                "d": "M15.707 21.293 C15.3165 21.683382 14.6835 21.683382 14.293 21.293 L12.707 19.707 C12.316618 19.3165 12.316618 18.6835 12.707 18.293 L18.293 12.707 C18.6835 12.316618 19.3165 12.316618 19.707 12.707 L21.293 14.293 C21.683382 14.6835 21.683382 15.3165 21.293 15.707 Z"
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
                "d": "M18 13 L16.625 6.126 C16.548637 5.744146 16.257548 5.441351 15.879 5.35 L3.235 2.028 C2.89626 1.9461 2.539314 2.04646 2.292887 2.292887 C2.04646 2.539314 1.9461 2.89626 2.028 3.235 L5.35 15.879 C5.441351 16.257548 5.744146 16.548637 6.126 16.625 L13 18"
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
                "d": "M2.3 2.3 L9.586 9.586"
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
                "d": "M11 9 C12.105 9 13 9.895 13 11 C13 12.105 12.105 13 11 13 C9.895 13 9 12.105 9 11 C9 9.895 9.895 9 11 9 Z"
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
            "d": "M15.707 21.293 C15.3165 21.683382 14.6835 21.683382 14.293 21.293 L12.707 19.707 C12.316618 19.3165 12.316618 18.6835 12.707 18.293 L18.293 12.707 C18.6835 12.316618 19.3165 12.316618 19.707 12.707 L21.293 14.293 C21.683382 14.6835 21.683382 15.3165 21.293 15.707 Z"
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
            "d": "M18 13 L16.625 6.126 C16.548637 5.744146 16.257548 5.441351 15.879 5.35 L3.235 2.028 C2.89626 1.9461 2.539314 2.04646 2.292887 2.292887 C2.04646 2.539314 1.9461 2.89626 2.028 3.235 L5.35 15.879 C5.441351 16.257548 5.744146 16.548637 6.126 16.625 L13 18"
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
            "d": "M2.3 2.3 L9.586 9.586"
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
            "d": "M11 9 C12.105 9 13 9.895 13 11 C13 12.105 12.105 13 11 13 C9.895 13 9 12.105 9 11 C9 9.895 9.895 9 11 9 Z"
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
                "d": "M15.707 21.293 C15.3165 21.683382 14.6835 21.683382 14.293 21.293 L12.707 19.707 C12.316618 19.3165 12.316618 18.6835 12.707 18.293 L18.293 12.707 C18.6835 12.316618 19.3165 12.316618 19.707 12.707 L21.293 14.293 C21.683382 14.6835 21.683382 15.3165 21.293 15.707 Z"
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
                "d": "M18 13 L16.625 6.126 C16.548637 5.744146 16.257548 5.441351 15.879 5.35 L3.235 2.028 C2.89626 1.9461 2.539314 2.04646 2.292887 2.292887 C2.04646 2.539314 1.9461 2.89626 2.028 3.235 L5.35 15.879 C5.441351 16.257548 5.744146 16.548637 6.126 16.625 L13 18"
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
                "d": "M2.3 2.3 L9.586 9.586"
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
                "d": "M11 9 C12.105 9 13 9.895 13 11 C13 12.105 12.105 13 11 13 C9.895 13 9 12.105 9 11 C9 9.895 9.895 9 11 9 Z"
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
      "sourceIconId": "pen-tool",
      "sourceLicense": "ISC",
      "importedAt": "2026-04-22T06:43:58.003Z"
    }
  }
} as const;
const typedIconData: Icon = iconData as unknown as Icon;

export function PenTool({
  size = 16,
  color = 'currentColor',
  className,
  style,
  label,
  reduceMotion = 'system',
  variant = "v-16",
  animate = true,
}: PenToolProps) {
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
